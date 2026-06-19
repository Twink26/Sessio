import * as vscode from 'vscode';
import { ITerminalErrorMonitor } from '../interfaces/ITerminalErrorMonitor';
import { TerminalError } from '../models/TerminalError';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Monitors terminal output and captures error messages
 * Optimized with debouncing, memory management, and performance monitoring
 */
export class TerminalErrorMonitor implements ITerminalErrorMonitor {
  private lastError: TerminalError | null = null;
  private errorCallbacks: ((error: TerminalError) => void)[] = [];
  private disposables: vscode.Disposable[] = [];
  private terminalDataListeners: Map<vscode.Terminal, vscode.Disposable> = new Map();
  
  // Performance optimizations
  private performanceMonitor: PerformanceMonitor;
  private outputBuffer: Map<string, string[]> = new Map(); // Buffer output by terminal
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceDelay = 300; // 300ms debounce delay
  private readonly maxBufferSize = 100; // Max lines to buffer per terminal
  private readonly maxLineLength = 1000; // Max characters per line to process
  private cleanupInterval: NodeJS.Timeout | undefined;

  // Patterns to identify error messages in terminal output
  private readonly errorPatterns = [
    // Generic error patterns
    /\berror:/i,
    /\bexception:/i,
    /\bfailed\b/i,
    /\bfailure:/i,
    
    // Programming language specific errors
    /SyntaxError:/i,
    /TypeError:/i,
    /ReferenceError:/i,
    /RangeError:/i,
    /\bError:/i,
    
    // Build tool errors
    /build failed/i,
    /compilation failed/i,
    /test failed/i,
    /tests failed/i,
    
    // Package manager errors
    /npm ERR!/i,
    /yarn error/i,
    /pnpm ERR/i,
    
    // Git errors
    /fatal:/i,
    /git error/i,
    
    // Command line errors
    /command not found/i,
    /permission denied/i,
    /no such file or directory/i,
    
    // Exit codes indicating errors
    /exit code [1-9]/i,
    /exited with code [1-9]/i,
  ];

  // Patterns to exclude (warnings, info messages, etc.)
  private readonly excludePatterns = [
    /warning:/i,
    /warn:/i,
    /info:/i,
    /debug:/i,
    /deprecated/i,
    /notice:/i,
  ];

  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeTerminalMonitoring();
    this.startCleanupInterval();
  }

  /**
   * Initialize terminal monitoring
   */
  private initializeTerminalMonitoring(): void {
    // Listen for new terminals being created
    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        this.attachToTerminal(terminal);
      })
    );

    // Listen for terminals being closed
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.detachFromTerminal(terminal);
      })
    );

    // Attach to existing terminals
    vscode.window.terminals.forEach(terminal => {
      this.attachToTerminal(terminal);
    });
  }

  /**
   * Attach error monitoring to a specific terminal
   */
  private attachToTerminal(terminal: vscode.Terminal): void {
    // Avoid duplicate listeners
    if (this.terminalDataListeners.has(terminal)) {
      return;
    }

    // VS Code doesn't provide direct access to terminal output in the extension API
    // We need to use the onDidWriteData event if available, or fall back to other methods
    if ('onDidWriteData' in terminal) {
      const listener = (terminal as any).onDidWriteData((data: string) => {
        this.processTerminalOutput(data, terminal.name);
      });
      this.terminalDataListeners.set(terminal, listener);
    }
  }

  /**
   * Detach error monitoring from a specific terminal
   */
  private detachFromTerminal(terminal: vscode.Terminal): void {
    const listener = this.terminalDataListeners.get(terminal);
    if (listener) {
      listener.dispose();
      this.terminalDataListeners.delete(terminal);
    }
  }

  /**
   * Process terminal output and detect errors with debouncing and performance monitoring
   */
  private processTerminalOutput(data: string, terminalName: string): void {
    const timer = this.performanceMonitor.startTimer('TerminalErrorMonitor.processTerminalOutput');
    
    // Truncate very long data to prevent performance issues
    const truncatedData = data.length > 10000 ? data.substring(0, 10000) + '...[truncated]' : data;
    
    // Add to buffer for debounced processing
    this.addToBuffer(terminalName, truncatedData);
    
    // Debounce processing to avoid excessive CPU usage
    this.debounceProcessing(terminalName);
    
    timer.end();
  }

  /**
   * Add data to terminal buffer with memory management
   */
  private addToBuffer(terminalName: string, data: string): void {
    const lines = data.split(/\r?\n/);
    let buffer = this.outputBuffer.get(terminalName) || [];
    
    // Add new lines to buffer
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && trimmedLine.length <= this.maxLineLength) {
        buffer.push(trimmedLine);
      }
    }
    
    // Limit buffer size to prevent memory issues
    if (buffer.length > this.maxBufferSize) {
      buffer = buffer.slice(-this.maxBufferSize);
    }
    
    this.outputBuffer.set(terminalName, buffer);
  }

  /**
   * Debounce terminal output processing
   */
  private debounceProcessing(terminalName: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(terminalName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      this.processBufferedOutput(terminalName);
      this.debounceTimers.delete(terminalName);
    }, this.debounceDelay);

    this.debounceTimers.set(terminalName, timer);
  }

  /**
   * Process buffered terminal output for errors
   */
  private processBufferedOutput(terminalName: string): void {
    const timer = this.performanceMonitor.startTimer('TerminalErrorMonitor.processBufferedOutput');
    
    const buffer = this.outputBuffer.get(terminalName);
    if (!buffer || buffer.length === 0) {
      timer.end();
      return;
    }

    // Process lines in reverse order to find the most recent error first
    for (let i = buffer.length - 1; i >= 0; i--) {
      const line = buffer[i];
      
      // Check if line should be excluded (warnings, info, etc.)
      if (this.shouldExcludeLine(line)) {
        continue;
      }

      // Check if line contains an error pattern
      if (this.isErrorLine(line)) {
        const errorType = this.determineErrorType(line);
        const terminalError: TerminalError = {
          message: line,
          timestamp: new Date(),
          terminalName: terminalName || 'Unknown Terminal',
          errorType,
        };

        // Store as the most recent error (only keep the latest one)
        this.lastError = terminalError;

        // Notify callbacks
        this.notifyErrorCallbacks(terminalError);
        
        // Found the most recent error, stop processing
        break;
      }
    }

    // Clear processed buffer to free memory
    this.outputBuffer.set(terminalName, []);
    
    timer.end();
  }

  /**
   * Notify error callbacks with error handling
   */
  private notifyErrorCallbacks(terminalError: TerminalError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(terminalError);
      } catch (error) {
        console.error('Error in terminal error callback:', error);
      }
    });
  }

  /**
   * Check if a line should be excluded from error detection (optimized)
   */
  private shouldExcludeLine(line: string): boolean {
    const timer = this.performanceMonitor.startTimer('TerminalErrorMonitor.shouldExcludeLine');
    
    // Quick checks first (most common cases)
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('warning') || lowerLine.includes('warn') || 
        lowerLine.includes('info') || lowerLine.includes('debug')) {
      timer.end();
      return true;
    }
    
    // Full pattern matching for edge cases
    const result = this.excludePatterns.some(pattern => pattern.test(line));
    timer.end();
    return result;
  }

  /**
   * Check if a line contains an error pattern (optimized)
   */
  private isErrorLine(line: string): boolean {
    const timer = this.performanceMonitor.startTimer('TerminalErrorMonitor.isErrorLine');
    
    // Quick checks first (most common error indicators)
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('exception') || 
        lowerLine.includes('failed') || lowerLine.includes('fatal')) {
      timer.end();
      return true;
    }
    
    // Full pattern matching for other cases
    const result = this.errorPatterns.some(pattern => pattern.test(line));
    timer.end();
    return result;
  }

  /**
   * Determine the type of error based on the line content
   */
  private determineErrorType(line: string): 'error' | 'exception' | 'failure' {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('exception') || lowerLine.includes('syntaxerror') || 
        lowerLine.includes('typeerror') || lowerLine.includes('referenceerror')) {
      return 'exception';
    }
    
    if (lowerLine.includes('build failed') || lowerLine.includes('test failed') || 
        lowerLine.includes('tests failed') || lowerLine.includes('compilation failed') ||
        lowerLine.includes('failed to') || lowerLine.includes('command failed')) {
      return 'failure';
    }
    
    return 'error';
  }

  /**
   * Register a callback for when terminal errors occur
   */
  onTerminalError(callback: (error: TerminalError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Get the most recent terminal error
   */
  getLastError(): TerminalError | null {
    return this.lastError;
  }

  /**
   * Start cleanup interval for memory management
   */
  private startCleanupInterval(): void {
    // Clean up old buffers every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 2 * 60 * 1000);
  }

  /**
   * Perform cleanup of old buffers and timers
   */
  private performCleanup(): void {
    const timer = this.performanceMonitor.startTimer('TerminalErrorMonitor.performCleanup');
    
    // Clear output buffers to free memory
    this.outputBuffer.clear();
    
    // Clear any stale debounce timers
    for (const [terminalName, timeout] of this.debounceTimers.entries()) {
      // Check if terminal still exists
      const terminalExists = vscode.window.terminals.some(t => t.name === terminalName);
      if (!terminalExists) {
        clearTimeout(timeout);
        this.debounceTimers.delete(terminalName);
      }
    }
    
    timer.end();
  }

  /**
   * Reset the monitor state (clear tracked errors)
   */
  reset(): void {
    this.lastError = null;
    this.outputBuffer.clear();
    
    // Clear all debounce timers
    for (const timeout of this.debounceTimers.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimers.clear();
  }

  /**
   * Dispose of resources with cleanup
   */
  dispose(): void {
    const timer = this.performanceMonitor.startTimer('TerminalErrorMonitor.dispose');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Clear all debounce timers
    for (const timeout of this.debounceTimers.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimers.clear();

    // Clear buffers to free memory
    this.outputBuffer.clear();

    // Dispose of all event listeners
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];

    // Dispose of terminal data listeners
    this.terminalDataListeners.forEach(listener => listener.dispose());
    this.terminalDataListeners.clear();

    // Clear callbacks
    this.errorCallbacks = [];
    this.lastError = null;
    
    timer.end();
  }
}