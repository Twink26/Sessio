import * as vscode from 'vscode';

/**
 * Log levels for the logging service
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

/**
 * Interface for telemetry data
 */
export interface TelemetryData {
    event: string;
    properties?: Record<string, string>;
    measurements?: Record<string, number>;
}

/**
 * Interface for error context information
 */
export interface ErrorContext {
    component: string;
    operation: string;
    sessionId?: string;
    workspaceId?: string;
    additionalData?: Record<string, any>;
}

/**
 * Centralized logging service for the Session Recap extension
 * Provides structured logging with appropriate levels and telemetry collection
 */
export class LoggingService {
    private outputChannel: vscode.OutputChannel;
    private currentLogLevel: LogLevel;
    private telemetryData: TelemetryData[] = [];
    private readonly maxTelemetryEntries = 1000;

    constructor(outputChannel: vscode.OutputChannel, logLevel: LogLevel = LogLevel.INFO) {
        this.outputChannel = outputChannel;
        this.currentLogLevel = logLevel;
    }

    /**
     * Set the current log level
     */
    setLogLevel(level: LogLevel): void {
        const oldLevel = this.currentLogLevel;
        this.currentLogLevel = level;
        
        // Always log level changes regardless of current level
        const timestamp = new Date().toISOString();
        const logEntry = `[INFO] ${timestamp} [LoggingService] Log level set to ${LogLevel[level]}`;
        this.outputChannel.appendLine(logEntry);
        
        if (oldLevel >= LogLevel.DEBUG) {
            console.log(logEntry);
        }
    }

    /**
     * Log an error message with context
     */
    error(component: string, message: string, error?: Error, context?: ErrorContext): void {
        if (this.currentLogLevel >= LogLevel.ERROR) {
            const timestamp = new Date().toISOString();
            const errorMessage = error ? `${message}: ${error.message}` : message;
            const logEntry = `[ERROR] ${timestamp} [${component}] ${errorMessage}`;
            
            this.outputChannel.appendLine(logEntry);
            
            // Also log to console for development
            console.error(logEntry, error);

            // Collect telemetry for errors
            this.collectTelemetry({
                event: 'error',
                properties: {
                    component,
                    message: errorMessage,
                    errorType: error?.constructor.name || 'Unknown',
                    operation: context?.operation || 'unknown',
                    sessionId: context?.sessionId || 'none',
                    workspaceId: context?.workspaceId || 'none'
                },
                measurements: {
                    timestamp: Date.now()
                }
            });
        }
    }

    /**
     * Log a warning message
     */
    warn(component: string, message: string, context?: Partial<ErrorContext>): void {
        if (this.currentLogLevel >= LogLevel.WARN) {
            const timestamp = new Date().toISOString();
            const logEntry = `[WARN] ${timestamp} [${component}] ${message}`;
            
            this.outputChannel.appendLine(logEntry);
            console.warn(logEntry);

            // Collect telemetry for warnings
            this.collectTelemetry({
                event: 'warning',
                properties: {
                    component,
                    message,
                    operation: context?.operation || 'unknown'
                },
                measurements: {
                    timestamp: Date.now()
                }
            });
        }
    }

    /**
     * Log an info message
     */
    info(component: string, message: string, context?: Partial<ErrorContext>): void {
        if (this.currentLogLevel >= LogLevel.INFO) {
            const timestamp = new Date().toISOString();
            const logEntry = `[INFO] ${timestamp} [${component}] ${message}`;
            
            this.outputChannel.appendLine(logEntry);
            
            // Only log to console in debug mode
            if (this.currentLogLevel >= LogLevel.DEBUG) {
                console.log(logEntry);
            }
        }
    }

    /**
     * Log a debug message
     */
    debug(component: string, message: string, data?: any): void {
        if (this.currentLogLevel >= LogLevel.DEBUG) {
            const timestamp = new Date().toISOString();
            const logEntry = `[DEBUG] ${timestamp} [${component}] ${message}`;
            
            this.outputChannel.appendLine(logEntry);
            
            if (data) {
                const dataString = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
                this.outputChannel.appendLine(`[DEBUG] ${timestamp} [${component}] Data: ${dataString}`);
            }
            
            console.debug(logEntry, data);
        }
    }

    /**
     * Log performance metrics
     */
    performance(component: string, operation: string, duration: number, context?: Partial<ErrorContext>): void {
        const message = `${operation} completed in ${duration}ms`;
        this.info(component, message, context);

        // Collect performance telemetry
        this.collectTelemetry({
            event: 'performance',
            properties: {
                component,
                operation,
                sessionId: context?.sessionId || 'none'
            },
            measurements: {
                duration,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Collect telemetry data for analysis
     */
    private collectTelemetry(data: TelemetryData): void {
        this.telemetryData.push(data);

        // Limit telemetry data size
        if (this.telemetryData.length > this.maxTelemetryEntries) {
            this.telemetryData = this.telemetryData.slice(-this.maxTelemetryEntries);
        }
    }

    /**
     * Get collected telemetry data
     */
    getTelemetryData(): TelemetryData[] {
        return [...this.telemetryData];
    }

    /**
     * Clear telemetry data
     */
    clearTelemetryData(): void {
        this.telemetryData = [];
        this.info('LoggingService', 'Telemetry data cleared');
    }

    /**
     * Get telemetry summary for reporting
     */
    getTelemetrySummary(): Record<string, any> {
        const summary = {
            totalEvents: this.telemetryData.length,
            errorCount: 0,
            warningCount: 0,
            performanceEvents: 0,
            componentBreakdown: {} as Record<string, number>,
            averagePerformance: {} as Record<string, number>
        };

        const performanceData: Record<string, number[]> = {};

        for (const entry of this.telemetryData) {
            // Count event types
            if (entry.event === 'error') {
                summary.errorCount++;
            } else if (entry.event === 'warning') {
                summary.warningCount++;
            } else if (entry.event === 'performance') {
                summary.performanceEvents++;
            }

            // Component breakdown
            const component = entry.properties?.component || 'unknown';
            summary.componentBreakdown[component] = (summary.componentBreakdown[component] || 0) + 1;

            // Performance data collection
            if (entry.event === 'performance' && entry.measurements?.duration) {
                const operation = entry.properties?.operation || 'unknown';
                if (!performanceData[operation]) {
                    performanceData[operation] = [];
                }
                performanceData[operation].push(entry.measurements.duration);
            }
        }

        // Calculate average performance
        for (const [operation, durations] of Object.entries(performanceData)) {
            const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
            summary.averagePerformance[operation] = Math.round(average * 100) / 100;
        }

        return summary;
    }

    /**
     * Show the output channel to the user
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose of the logging service
     */
    dispose(): void {
        this.info('LoggingService', 'Logging service disposed');
        this.clearTelemetryData();
    }
}