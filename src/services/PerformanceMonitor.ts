import * as vscode from 'vscode';

/**
 * Performance monitoring and metrics collection service
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, PerformanceMetric> = new Map();
    private memoryUsageInterval: NodeJS.Timeout | undefined;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Session Recap Performance');
        this.startMemoryMonitoring();
    }

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Start timing an operation
     */
    startTimer(operationName: string): PerformanceTimer {
        const startTime = performance.now();
        const startMemory = process.memoryUsage();
        
        return {
            end: () => {
                const endTime = performance.now();
                const endMemory = process.memoryUsage();
                const duration = endTime - startTime;
                const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

                this.recordMetric(operationName, {
                    duration,
                    memoryDelta,
                    timestamp: new Date()
                });

                return duration;
            }
        };
    }

    /**
     * Record a performance metric
     */
    private recordMetric(operationName: string, data: PerformanceData): void {
        let metric = this.metrics.get(operationName);
        
        if (!metric) {
            metric = {
                operationName,
                totalCalls: 0,
                totalDuration: 0,
                averageDuration: 0,
                maxDuration: 0,
                minDuration: Infinity,
                totalMemoryDelta: 0,
                averageMemoryDelta: 0,
                lastExecuted: data.timestamp
            };
            this.metrics.set(operationName, metric);
        }

        // Update metrics
        metric.totalCalls++;
        metric.totalDuration += data.duration;
        metric.averageDuration = metric.totalDuration / metric.totalCalls;
        metric.maxDuration = Math.max(metric.maxDuration, data.duration);
        metric.minDuration = Math.min(metric.minDuration, data.duration);
        metric.totalMemoryDelta += data.memoryDelta;
        metric.averageMemoryDelta = metric.totalMemoryDelta / metric.totalCalls;
        metric.lastExecuted = data.timestamp;

        // Log slow operations (> 100ms)
        if (data.duration > 100) {
            this.outputChannel.appendLine(
                `[SLOW] ${operationName}: ${data.duration.toFixed(2)}ms, Memory: ${this.formatBytes(data.memoryDelta)}`
            );
        }
    }

    /**
     * Get performance metrics for an operation
     */
    getMetrics(operationName: string): PerformanceMetric | undefined {
        return this.metrics.get(operationName);
    }

    /**
     * Get all performance metrics
     */
    getAllMetrics(): PerformanceMetric[] {
        return Array.from(this.metrics.values());
    }

    /**
     * Start monitoring memory usage
     */
    private startMemoryMonitoring(): void {
        this.memoryUsageInterval = setInterval(() => {
            const memoryUsage = process.memoryUsage();
            
            // Log if memory usage exceeds 50MB (as per design requirements)
            if (memoryUsage.heapUsed > 50 * 1024 * 1024) {
                this.outputChannel.appendLine(
                    `[MEMORY WARNING] Heap usage: ${this.formatBytes(memoryUsage.heapUsed)}`
                );
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Get current memory usage
     */
    getCurrentMemoryUsage(): NodeJS.MemoryUsage {
        return process.memoryUsage();
    }

    /**
     * Format bytes to human readable format
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Log performance summary
     */
    logPerformanceSummary(): void {
        this.outputChannel.appendLine('\n=== Performance Summary ===');
        
        const metrics = this.getAllMetrics();
        if (metrics.length === 0) {
            this.outputChannel.appendLine('No performance metrics recorded');
            return;
        }

        metrics.forEach(metric => {
            this.outputChannel.appendLine(
                `${metric.operationName}:\n` +
                `  Calls: ${metric.totalCalls}\n` +
                `  Avg Duration: ${metric.averageDuration.toFixed(2)}ms\n` +
                `  Max Duration: ${metric.maxDuration.toFixed(2)}ms\n` +
                `  Min Duration: ${metric.minDuration.toFixed(2)}ms\n` +
                `  Avg Memory: ${this.formatBytes(metric.averageMemoryDelta)}\n`
            );
        });

        const currentMemory = this.getCurrentMemoryUsage();
        this.outputChannel.appendLine(
            `\nCurrent Memory Usage:\n` +
            `  Heap Used: ${this.formatBytes(currentMemory.heapUsed)}\n` +
            `  Heap Total: ${this.formatBytes(currentMemory.heapTotal)}\n` +
            `  RSS: ${this.formatBytes(currentMemory.rss)}\n`
        );
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.memoryUsageInterval) {
            clearInterval(this.memoryUsageInterval);
            this.memoryUsageInterval = undefined;
        }
        this.outputChannel.dispose();
    }
}

interface PerformanceTimer {
    end(): number;
}

interface PerformanceData {
    duration: number;
    memoryDelta: number;
    timestamp: Date;
}

interface PerformanceMetric {
    operationName: string;
    totalCalls: number;
    totalDuration: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
    totalMemoryDelta: number;
    averageMemoryDelta: number;
    lastExecuted: Date;
}