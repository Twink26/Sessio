import * as vscode from 'vscode';
import { LoggingService, ErrorContext } from './LoggingService';

/**
 * Error categories for different types of failures
 */
export enum ErrorCategory {
    STORAGE = 'storage',
    GIT = 'git',
    TERMINAL = 'terminal',
    AI_SERVICE = 'ai_service',
    UI = 'ui',
    CONFIGURATION = 'configuration',
    NETWORK = 'network',
    UNKNOWN = 'unknown'
}

/**
 * Recovery action types
 */
export enum RecoveryAction {
    RETRY = 'retry',
    FALLBACK = 'fallback',
    DISABLE_FEATURE = 'disable_feature',
    USER_ACTION_REQUIRED = 'user_action_required',
    NONE = 'none'
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
    handled: boolean;
    recoveryAction: RecoveryAction;
    userMessage?: string;
    fallbackData?: any;
    retryable: boolean;
}

/**
 * User-friendly error messages and recovery suggestions
 */
interface ErrorMessageConfig {
    userMessage: string;
    recoveryAction: RecoveryAction;
    recoverySuggestion?: string;
    retryable: boolean;
}

/**
 * Centralized error handler with graceful degradation
 * Provides user-friendly error messages and recovery suggestions
 */
export class ErrorHandler {
    private loggingService: LoggingService;
    private errorMessages: Map<string, ErrorMessageConfig> = new Map();
    private retryAttempts: Map<string, number> = new Map();
    private readonly maxRetryAttempts = 3;

    constructor(loggingService: LoggingService) {
        this.loggingService = loggingService;
        this.initializeErrorMessages();
    }

    /**
     * Handle storage-related errors
     */
    handleStorageError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'Storage error occurred', error, context);

        const errorKey = this.getErrorKey(error);
        const config = this.getErrorConfig(ErrorCategory.STORAGE, errorKey);

        // Check for specific storage error types
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.FALLBACK,
                userMessage: 'Session data file not found. Starting with a fresh session.',
                fallbackData: null,
                retryable: false
            };
        }

        if (error.message.includes('EACCES') || error.message.includes('permission')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.USER_ACTION_REQUIRED,
                userMessage: 'Permission denied accessing session data. Please check file permissions.',
                retryable: false
            };
        }

        if (error.message.includes('ENOSPC') || error.message.includes('no space')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.USER_ACTION_REQUIRED,
                userMessage: 'Insufficient disk space to save session data. Please free up space.',
                retryable: true
            };
        }

        return {
            handled: true,
            recoveryAction: config.recoveryAction,
            userMessage: config.userMessage,
            retryable: config.retryable
        };
    }

    /**
     * Handle Git-related errors
     */
    handleGitError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'Git error occurred', error, context);

        if (error.message.includes('not a git repository')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.DISABLE_FEATURE,
                userMessage: 'Git repository not detected. Git commit tracking will be disabled.',
                fallbackData: { gitCommits: [] },
                retryable: false
            };
        }

        if (error.message.includes('git not found') || error.message.includes('command not found')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.DISABLE_FEATURE,
                userMessage: 'Git command not found. Please install Git to enable commit tracking.',
                fallbackData: { gitCommits: [] },
                retryable: false
            };
        }

        if (error.message.includes('timeout') || error.message.includes('network')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.RETRY,
                userMessage: 'Git operation timed out. Retrying...',
                retryable: true
            };
        }

        return {
            handled: true,
            recoveryAction: RecoveryAction.FALLBACK,
            userMessage: 'Git operation failed. Continuing without Git data.',
            fallbackData: { gitCommits: [] },
            retryable: false
        };
    }

    /**
     * Handle AI service errors
     */
    handleAIServiceError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'AI service error occurred', error, context);

        if (error.message.includes('API key') || error.message.includes('authentication')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.FALLBACK,
                userMessage: 'AI service authentication failed. Using basic summary instead.',
                retryable: false
            };
        }

        if (error.message.includes('rate limit') || error.message.includes('quota')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.FALLBACK,
                userMessage: 'AI service rate limit reached. Using basic summary instead.',
                retryable: true
            };
        }

        if (error.message.includes('network') || error.message.includes('timeout')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.RETRY,
                userMessage: 'AI service temporarily unavailable. Retrying...',
                retryable: true
            };
        }

        return {
            handled: true,
            recoveryAction: RecoveryAction.FALLBACK,
            userMessage: 'AI summary generation failed. Using basic summary instead.',
            retryable: false
        };
    }

    /**
     * Handle terminal monitoring errors
     */
    handleTerminalError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'Terminal monitoring error occurred', error, context);

        if (error.message.includes('permission') || error.message.includes('access denied')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.DISABLE_FEATURE,
                userMessage: 'Terminal access denied. Terminal error tracking will be disabled.',
                fallbackData: { terminalErrors: [] },
                retryable: false
            };
        }

        return {
            handled: true,
            recoveryAction: RecoveryAction.FALLBACK,
            userMessage: 'Terminal monitoring failed. Continuing without terminal error tracking.',
            fallbackData: { terminalErrors: [] },
            retryable: false
        };
    }

    /**
     * Handle UI-related errors
     */
    handleUIError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'UI error occurred', error, context);

        if (error.message.includes('webview') || error.message.includes('panel')) {
            return {
                handled: true,
                recoveryAction: RecoveryAction.RETRY,
                userMessage: 'UI panel failed to load. Attempting to recreate...',
                retryable: true
            };
        }

        return {
            handled: true,
            recoveryAction: RecoveryAction.FALLBACK,
            userMessage: 'UI error occurred. Some features may not display correctly.',
            retryable: false
        };
    }

    /**
     * Handle configuration errors
     */
    handleConfigurationError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'Configuration error occurred', error, context);

        return {
            handled: true,
            recoveryAction: RecoveryAction.FALLBACK,
            userMessage: 'Configuration error detected. Using default settings.',
            retryable: false
        };
    }

    /**
     * Handle network-related errors
     */
    handleNetworkError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'Network error occurred', error, context);

        return {
            handled: true,
            recoveryAction: RecoveryAction.RETRY,
            userMessage: 'Network error occurred. Retrying operation...',
            retryable: true
        };
    }

    /**
     * Handle unknown errors with generic fallback
     */
    handleUnknownError(error: Error, context: ErrorContext): ErrorHandlingResult {
        this.loggingService.error('ErrorHandler', 'Unknown error occurred', error, context);

        return {
            handled: true,
            recoveryAction: RecoveryAction.FALLBACK,
            userMessage: 'An unexpected error occurred. Some features may not work correctly.',
            retryable: false
        };
    }

    /**
     * Determine if an operation should be retried
     */
    shouldRetry(operationKey: string, error: Error): boolean {
        const attempts = this.retryAttempts.get(operationKey) || 0;
        
        if (attempts >= this.maxRetryAttempts) {
            this.retryAttempts.delete(operationKey);
            return false;
        }

        // Don't retry certain types of errors
        if (error.message.includes('permission') || 
            error.message.includes('not found') ||
            error.message.includes('authentication')) {
            return false;
        }

        this.retryAttempts.set(operationKey, attempts + 1);
        return true;
    }

    /**
     * Reset retry counter for an operation
     */
    resetRetryCounter(operationKey: string): void {
        this.retryAttempts.delete(operationKey);
    }

    /**
     * Show user-friendly error message
     */
    showUserError(message: string, actions?: string[]): void {
        if (actions && actions.length > 0) {
            vscode.window.showErrorMessage(message, ...actions).then(selection => {
                if (selection) {
                    this.loggingService.info('ErrorHandler', `User selected action: ${selection}`);
                }
            });
        } else {
            vscode.window.showErrorMessage(message);
        }
    }

    /**
     * Show user-friendly warning message
     */
    showUserWarning(message: string): void {
        vscode.window.showWarningMessage(message);
    }

    /**
     * Show user-friendly info message
     */
    showUserInfo(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    /**
     * Initialize error message configurations
     */
    private initializeErrorMessages(): void {
        this.errorMessages = new Map([
            // Storage errors
            ['storage_generic', {
                userMessage: 'Failed to access session data. Using temporary storage.',
                recoveryAction: RecoveryAction.FALLBACK,
                retryable: false
            }],
            ['storage_permission', {
                userMessage: 'Permission denied accessing session data. Please check file permissions.',
                recoveryAction: RecoveryAction.USER_ACTION_REQUIRED,
                recoverySuggestion: 'Check file permissions in the extension storage directory.',
                retryable: false
            }],
            
            // Git errors
            ['git_not_found', {
                userMessage: 'Git repository not detected. Git features will be disabled.',
                recoveryAction: RecoveryAction.DISABLE_FEATURE,
                retryable: false
            }],
            
            // AI service errors
            ['ai_api_key', {
                userMessage: 'AI service not configured. Using basic summaries.',
                recoveryAction: RecoveryAction.FALLBACK,
                recoverySuggestion: 'Configure your AI API key in settings.',
                retryable: false
            }],
            
            // UI errors
            ['ui_webview', {
                userMessage: 'UI panel failed to load. Attempting to recreate.',
                recoveryAction: RecoveryAction.RETRY,
                retryable: true
            }]
        ]);
    }

    /**
     * Get error configuration for a specific error
     */
    private getErrorConfig(category: ErrorCategory, errorKey: string): ErrorMessageConfig {
        const key = `${category}_${errorKey}`;
        return this.errorMessages.get(key) || this.errorMessages.get(`${category}_generic`) || {
            userMessage: 'An error occurred. Please try again.',
            recoveryAction: RecoveryAction.FALLBACK,
            retryable: false
        };
    }

    /**
     * Generate error key from error message
     */
    private getErrorKey(error: Error): string {
        const message = error.message.toLowerCase();
        
        if (message.includes('permission') || message.includes('access')) {
            return 'permission';
        }
        if (message.includes('not found')) {
            return 'not_found';
        }
        if (message.includes('network') || message.includes('timeout')) {
            return 'network';
        }
        if (message.includes('api key') || message.includes('authentication')) {
            return 'api_key';
        }
        
        return 'generic';
    }
}