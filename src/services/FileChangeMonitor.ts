import * as vscode from 'vscode';
import { IFileChangeMonitor } from '../interfaces/IFileChangeMonitor';
import { FileEdit } from '../models/FileEdit';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Monitors file system changes and tracks actual file modifications
 * Optimized with debouncing for high-frequency changes and memory management
 */
export class FileChangeMonitor implements IFileChangeMonitor {
  private editedFiles: FileEdit[] = [];
  private fileChangeCallbacks: ((file: FileEdit) => void)[] = [];
  private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];
  
  // Performance optimizations
  private performanceMonitor: PerformanceMonitor;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingChanges: Map<string, FileEdit> = new Map();
  private readonly debounceDelay = 500; // 500ms debounce delay
  private readonly maxTrackedFiles = 1000; // Limit to prevent memory issues
  private cleanupInterval: NodeJS.Timeout | undefined;

  // Patterns for files to exclude from tracking
  private readonly excludePatterns = [
    // Temporary files
    /\.tmp$/,
    /\.temp$/,
    /~$/,
    /\.swp$/,
    /\.swo$/,
    
    // System files
    /\.DS_Store$/,
    /Thumbs\.db$/,
    /desktop\.ini$/,
    
    // IDE/Editor files
    /\.vscode\/.*$/,
    /\.idea\/.*$/,
    
    // Build/Output directories
    /node_modules\/.*$/,
    /dist\/.*$/,
    /build\/.*$/,
    /out\/.*$/,
    /\.git\/.*$/,
    
    // Log files
    /\.log$/,
    /\.log\.\d+$/,
    
    // Lock files
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
  ];

  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeFileWatcher();
    this.startCleanupInterval();
  }

  /**
   * Initialize the file system watcher
   */
  private initializeFileWatcher(): void {
    // Watch all files in the workspace
    this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');

    // Listen for file creation
    this.disposables.push(
      this.fileSystemWatcher.onDidCreate((uri) => {
        this.handleFileChange(uri, 'created');
      })
    );

    // Listen for file modification
    this.disposables.push(
      this.fileSystemWatcher.onDidChange((uri) => {
        this.handleFileChange(uri, 'modified');
      })
    );

    // Listen for file deletion
    this.disposables.push(
      this.fileSystemWatcher.onDidDelete((uri) => {
        this.handleFileChange(uri, 'deleted');
      })
    );
  }

  /**
   * Handle file system change events with debouncing for performance
   */
  private handleFileChange(uri: vscode.Uri, changeType: 'created' | 'modified' | 'deleted'): void {
    const timer = this.performanceMonitor.startTimer('FileChangeMonitor.handleFileChange');
    
    const filePath = vscode.workspace.asRelativePath(uri);
    
    // Skip if file should be excluded
    if (this.shouldExcludeFile(filePath)) {
      timer.end();
      return;
    }

    // Create unique key for debouncing
    const debounceKey = `${filePath}:${changeType}`;
    
    // Clear existing timer for this file/change type
    const existingTimer = this.debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Create FileEdit object
    const fileEdit: FileEdit = {
      filePath,
      timestamp: new Date(),
      changeType,
    };

    // Store pending change
    this.pendingChanges.set(debounceKey, fileEdit);

    // Set debounced timer
    const debounceTimer = setTimeout(() => {
      this.processPendingChange(debounceKey, uri);
    }, this.debounceDelay);

    this.debounceTimers.set(debounceKey, debounceTimer);
    timer.end();
  }

  /**
   * Process a pending file change after debounce period
   */
  private async processPendingChange(debounceKey: string, uri: vscode.Uri): Promise<void> {
    const timer = this.performanceMonitor.startTimer('FileChangeMonitor.processPendingChange');
    
    const fileEdit = this.pendingChanges.get(debounceKey);
    if (!fileEdit) {
      timer.end();
      return;
    }

    // Add line count for created/modified files (not for deleted files)
    if (fileEdit.changeType !== 'deleted') {
      try {
        const lineCount = await this.getLineCount(uri);
        if (lineCount !== undefined) {
          fileEdit.lineCount = lineCount;
        }
      } catch (error) {
        // Ignore errors getting line count
      }
    }

    // Add to tracked files
    this.addEditedFile(fileEdit);

    // Notify callbacks
    this.fileChangeCallbacks.forEach(callback => {
      try {
        callback(fileEdit);
      } catch (error) {
        console.error('Error in file change callback:', error);
      }
    });

    // Cleanup
    this.debounceTimers.delete(debounceKey);
    this.pendingChanges.delete(debounceKey);
    
    timer.end();
  }

  /**
   * Check if a file should be excluded from tracking
   */
  private shouldExcludeFile(filePath: string): boolean {
    return this.excludePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Get line count for a file
   */
  private async getLineCount(uri: vscode.Uri): Promise<number | undefined> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      return document.lineCount;
    } catch (error) {
      // File might be binary or inaccessible
      return undefined;
    }
  }

  /**
   * Add a file edit to the tracked list with memory management
   */
  private addEditedFile(fileEdit: FileEdit): void {
    const timer = this.performanceMonitor.startTimer('FileChangeMonitor.addEditedFile');
    
    const now = fileEdit.timestamp.getTime();
    const timeWindow = 1000; // 1 second window to avoid duplicate events

    // Check if we already have a recent edit for this file
    const existingIndex = this.editedFiles.findIndex(
      existing => 
        existing.filePath === fileEdit.filePath && 
        existing.changeType === fileEdit.changeType &&
        Math.abs(now - existing.timestamp.getTime()) < timeWindow
    );

    if (existingIndex === -1) {
      // Memory management: remove oldest files if we exceed the limit
      if (this.editedFiles.length >= this.maxTrackedFiles) {
        // Remove the oldest 10% of files to make room
        const removeCount = Math.floor(this.maxTrackedFiles * 0.1);
        this.editedFiles.splice(0, removeCount);
      }
      
      // No recent duplicate, add the new edit
      this.editedFiles.push(fileEdit);
    } else {
      // Update the existing edit with the latest timestamp
      this.editedFiles[existingIndex] = fileEdit;
    }
    
    timer.end();
  }

  /**
   * Start cleanup interval for memory management
   */
  private startCleanupInterval(): void {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Perform cleanup of old data and timers
   */
  private performCleanup(): void {
    const timer = this.performanceMonitor.startTimer('FileChangeMonitor.performCleanup');
    
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old file edits
    const initialCount = this.editedFiles.length;
    this.editedFiles = this.editedFiles.filter(
      edit => now - edit.timestamp.getTime() < maxAge
    );

    // Clean up expired debounce timers
    for (const [key, timeout] of this.debounceTimers.entries()) {
      const pendingChange = this.pendingChanges.get(key);
      if (pendingChange && now - pendingChange.timestamp.getTime() > this.debounceDelay * 2) {
        clearTimeout(timeout);
        this.debounceTimers.delete(key);
        this.pendingChanges.delete(key);
      }
    }

    const removedCount = initialCount - this.editedFiles.length;
    if (removedCount > 0) {
      console.log(`FileChangeMonitor: Cleaned up ${removedCount} old file edits`);
    }
    
    timer.end();
  }

  /**
   * Register a callback for when files are changed
   */
  onFileChanged(callback: (file: FileEdit) => void): void {
    this.fileChangeCallbacks.push(callback);
  }

  /**
   * Get all files that have been edited in the current session
   */
  getEditedFiles(): FileEdit[] {
    return [...this.editedFiles]; // Return a copy to prevent external modification
  }

  /**
   * Reset the monitor state (clear tracked files)
   */
  reset(): void {
    this.editedFiles = [];
  }

  /**
   * Dispose of resources with cleanup
   */
  dispose(): void {
    const timer = this.performanceMonitor.startTimer('FileChangeMonitor.dispose');
    
    // Clear all debounce timers
    for (const timeout of this.debounceTimers.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Dispose of VS Code resources
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    
    if (this.fileSystemWatcher) {
      this.fileSystemWatcher.dispose();
      this.fileSystemWatcher = undefined;
    }

    // Clear tracked files to free memory
    this.editedFiles = [];
    this.fileChangeCallbacks = [];
    
    timer.end();
  }
}