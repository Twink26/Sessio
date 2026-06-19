import * as vscode from 'vscode';
import { LoggingService, LogLevel, ErrorContext } from './LoggingService';
import { ErrorHandler, ErrorCategory, ErrorHandlingResult } from './ErrorHandler';

/**
 * Centralized error handling and logging service
 * Combines logging and error handling with graceful degradation
 */
export class ErrorHandlingService {
    private loggingService: LoggingService;
    private errorHandler: ErrorHandler;

    constructor(outputChannel: vscode.OutputChannel, logLevel: LogLevel = LogLevel.INFO) {
        this.loggingService = new LoggingService(outputChannel, logLevel);
        this.errorHandler = new ErrorHandler(this.loggingService);
    }

    /**
     * Get the logging service instance
     */
    getLoggingService(): LoggingService {
        return this.loggingService;
    }

    /**
     * Get the error handler instance
     */
    getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    /**
     * Handle an error with automatic categorization and recovery
     */
    async handleError(
        error: Error, 
        context: ErrorContext, 
        category?: ErrorCategory
    ): Promise<ErrorHandlingResult> {
        // Auto-detect category if not provided
        if (!category) {
            category = this.categorizeError(error, context);
        }

        let result: ErrorHandlingResult;

        // Handle based on category
        switch (category) {
            case ErrorCategory.STORAGE:
                result = this.errorHandler.handleStorageError(error, context);
                break;
            case ErrorCategory.GIT:
                result = this.errorHandler.handleGitError(error, context);
                break;
            case ErrorCategory.AI_SERVICE:
                result = this.errorHandler.handleAIServiceError(error, context);
                break;
            case ErrorCategory.TERMINAL:
                result = this.errorHandler.handleTerminalError(error, context);
                break;
            case ErrorCategory.UI:
                result = this.errorHandler.handleUIError(error, context);
                break;
            case ErrorCategory.CONFIGURATION:
                result = this.errorHandler.handleConfigurationError(error, context);
                break;
            case ErrorCategory.NETWORK:
                result = this.errorHandler.handleNetworkError(error, context);
                break;
            default:
                result = this.errorHandler.handleUnknownError(error, context);
        }

        // Show user message if provided
        if (result.userMessage) {
            this.errorHandler.showUserError(result.userMessage);
        }

        return result;
    }

    /**
     * Execute an operation with automatic error handling and retry logic
     */
    async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        context: ErrorContext,
        fallbackValue?: T,
        category?: ErrorCategory
    ): Promise<T> {
        const operationKey = `${context.component}_${context.operation}`;
        
        try {
            const startTime = Date.now();
            const result = await operation();
            const duration = Date.now() - startTime;
            
            // Log successful operation
            this.loggingService.performance(context.component, context.operation, duration, context);
            
            // Reset retry counter on success
            this.errorHandler.resetRetryCounter(operationKey);
            
            return result;
        } catch (error) {
            const errorResult = await this.handleError(error as Error, context, category);
            
            // Handle retry logic
            if (errorResult.retryable && this.errorHandler.shouldRetry(operationKey, error as Error)) {
                this.loggingService.info(context.component, `Retrying operation: ${context.operation}`);
                
                // Wait before retry (exponential backoff)
                const retryDelay = Math.min(1000 * Math.pow(2, this.getRetryAttempt(operationKey)), 10000);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                return this.executeWithErrorHandling(operation, context, fallbackValue, category);
            }
            
            // Return fallback value if available
            if (errorResult.fallbackData !== undefined) {
                return errorResult.fallbackData as T;
            }
            
            if (fallbackValue !== undefined) {
                this.loggingService.warn(context.component, `Using fallback value for ${context.operation}`);
                return fallbackValue;
            }
            
            // Re-throw if no fallback available
            throw error;
        }
    }

    /**
     * Execute an operation with timeout and error handling
     */
    async executeWithTimeout<T>(
        operation: () => Promise<T>,
        timeoutMs: number,
        context: ErrorContext,
        fallbackValue?: T
    ): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        try {
            return await Promise.race([operation(), timeoutPromise]);
        } catch (error) {
            return this.executeWithErrorHandling(
                async () => { throw error; },
                context,
                fallbackValue,
                ErrorCategory.NETWORK
            );
        }
    }

    /**
     * Log and handle a warning
     */
    handleWarning(component: string, message: string, context?: Partial<ErrorContext>): void {
        this.loggingService.warn(component, message, context);
        
        // Show user warning for critical warnings
        if (message.includes('critical') || message.includes('important')) {
            this.errorHandler.showUserWarning(message);
        }
    }

    /**
     * Log information with optional user notification
     */
    logInfo(component: string, message: string, showUser: boolean = false, context?: Partial<ErrorContext>): void {
        this.loggingService.info(component, message, context);
        
        if (showUser) {
            this.errorHandler.showUserInfo(message);
        }
    }

    /**
     * Log debug information
     */
    logDebug(component: string, message: string, data?: any): void {
        this.loggingService.debug(component, message, data);
    }

    /**
     * Set the log level
     */
    setLogLevel(level: LogLevel): void {
        this.loggingService.setLogLevel(level);
    }

    /**
     * Get telemetry summary for reporting
     */
    getTelemetrySummary(): Record<string, any> {
        return this.loggingService.getTelemetrySummary();
    }

    /**
     * Show the output channel
     */
    showLogs(): void {
        this.loggingService.show();
    }

    /**
     * Dispose of the service
     */
    dispose(): void {
        this.loggingService.dispose();
    }

    /**
     * Categorize error based on error message and context
     */
    private categorizeError(error: Error, context: ErrorContext): ErrorCategory {
        const message = error.message.toLowerCase();
        const component = context.component.toLowerCase();

        // Component-based categorization
        if (component.includes('storage') || component.includes('session')) {
            return ErrorCategory.STORAGE;
        }
        if (component.includes('git')) {
            return ErrorCategory.GIT;
        }
        if (component.includes('ai') || component.includes('summary')) {
            return ErrorCategory.AI_SERVICE;
        }
        if (component.includes('terminal')) {
            return ErrorCategory.TERMINAL;
        }
        if (component.includes('sidebar') || component.includes('ui') || component.includes('webview')) {
            return ErrorCategory.UI;
        }
        if (component.includes('config')) {
            return ErrorCategory.CONFIGURATION;
        }

        // Message-based categorization
        if (message.includes('enoent') || message.includes('file') || message.includes('storage')) {
            return ErrorCategory.STORAGE;
        }
        if (message.includes('git') || message.includes('repository')) {
            return ErrorCategory.GIT;
        }
        if (message.includes('api') || message.includes('openai') || message.includes('ai')) {
            return ErrorCategory.AI_SERVICE;
        }
        if (message.includes('terminal')) {
            return ErrorCategory.TERMINAL;
        }
        if (message.includes('webview') || message.includes('panel') || message.includes('ui')) {
            return ErrorCategory.UI;
        }
        if (message.includes('config') || message.includes('setting')) {
            return ErrorCategory.CONFIGURATION;
        }
        if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
            return ErrorCategory.NETWORK;
        }

        return ErrorCategory.UNKNOWN;
    }

    /**
     * Get current retry attempt for an operation
     */
    private getRetryAttempt(operationKey: string): number {
        // This is a simplified implementation
        // In a real scenario, you'd track this in the ErrorHandler
        return 1;
    }
}