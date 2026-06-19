import * as vscode from 'vscode';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Performance optimization service that manages system-wide performance improvements
 * Handles memory management, cleanup, and performance monitoring coordination
 */
export class PerformanceOptimizer {
    private static instance: PerformanceOptimizer;
    private performanceMonitor: PerformanceMonitor;
    private memoryCleanupInterval: NodeJS.Timeout | undefined;
    private performanceReportInterval: NodeJS.Timeout | undefined;
    private gcSuggestionThreshold = 100 * 1024 * 1024; // 100MB
    private lastGcSuggestion = 0;
    private readonly gcCooldown = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.startOptimizationServices();
    }

    static getInstance(): PerformanceOptimizer {
        if (!PerformanceOptimizer.instance) {
            PerformanceOptimizer.instance = new PerformanceOptimizer();
        }
        return PerformanceOptimizer.instance;
    }

    /**
     * Start optimization services
     */
    private startOptimizationServices(): void {
        // Memory cleanup every 10 minutes
        this.memoryCleanupInterval = setInterval(() => {
            this.performMemoryCleanup();
        }, 10 * 60 * 1000);

        // Performance report every 30 minutes
        this.performanceReportInterval = setInterval(() => {
            this.generatePerformanceReport();
        }, 30 * 60 * 1000);
    }

    /**
     * Perform memory cleanup and optimization
     */
    private performMemoryCleanup(): void {
        const timer = this.performanceMonitor.startTimer('PerformanceOptimizer.performMemoryCleanup');
        
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
        
        console.log(`Memory cleanup - Heap used: ${heapUsedMB.toFixed(2)}MB`);
        
        // Suggest garbage collection if memory usage is high
        if (memoryUsage.heapUsed > this.gcSuggestionThreshold) {
            this.suggestGarbageCollection();
        }
        
        timer.end();
    }

    /**
     * Suggest garbage collection if conditions are met
     */
    private suggestGarbageCollection(): void {
        const now = Date.now();
        
        // Avoid frequent GC suggestions
        if (now - this.lastGcSuggestion < this.gcCooldown) {
            return;
        }
        
        this.lastGcSuggestion = now;
        
        // Suggest GC if available (Node.js with --expose-gc flag)
        if (global.gc) {
            console.log('Suggesting garbage collection due to high memory usage');
            try {
                global.gc();
            } catch (error) {
                console.error('Failed to trigger garbage collection:', error);
            }
        } else {
            console.log('High memory usage detected, but garbage collection not available');
        }
    }

    /**
     * Generate performance report
     */
    private generatePerformanceReport(): void {
        const timer = this.performanceMonitor.startTimer('PerformanceOptimizer.generatePerformanceReport');
        
        console.log('=== Performance Optimization Report ===');
        
        // Memory usage
        const memoryUsage = process.memoryUsage();
        console.log(`Memory Usage:
  Heap Used: ${(memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)}MB
  Heap Total: ${(memoryUsage.heapTotal / (1024 * 1024)).toFixed(2)}MB
  RSS: ${(memoryUsage.rss / (1024 * 1024)).toFixed(2)}MB
  External: ${(memoryUsage.external / (1024 * 1024)).toFixed(2)}MB`);

        // Performance metrics summary
        const metrics = this.performanceMonitor.getAllMetrics();
        const slowOperations = metrics.filter(m => m.averageDuration > 50);
        
        if (slowOperations.length > 0) {
            console.log('\nSlow Operations (>50ms average):');
            slowOperations.forEach(metric => {
                console.log(`  ${metric.operationName}: ${metric.averageDuration.toFixed(2)}ms avg (${metric.totalCalls} calls)`);
            });
        }

        // Memory-intensive operations
        const memoryIntensive = metrics.filter(m => m.averageMemoryDelta > 1024 * 1024); // >1MB
        if (memoryIntensive.length > 0) {
            console.log('\nMemory-Intensive Operations (>1MB average):');
            memoryIntensive.forEach(metric => {
                console.log(`  ${metric.operationName}: ${(metric.averageMemoryDelta / (1024 * 1024)).toFixed(2)}MB avg`);
            });
        }

        // Recommendations
        this.generateOptimizationRecommendations(metrics, memoryUsage);
        
        timer.end();
    }

    /**
     * Generate optimization recommendations based on metrics
     */
    private generateOptimizationRecommendations(metrics: any[], memoryUsage: NodeJS.MemoryUsage): void {
        const recommendations: string[] = [];
        
        // Memory recommendations
        const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
        if (heapUsedMB > 50) {
            recommendations.push('Consider reducing memory usage - currently above 50MB threshold');
        }
        
        // Performance recommendations
        const verySlowOps = metrics.filter(m => m.averageDuration > 100);
        if (verySlowOps.length > 0) {
            recommendations.push(`${verySlowOps.length} operations are very slow (>100ms) - consider optimization`);
        }
        
        // Frequency recommendations
        const frequentOps = metrics.filter(m => m.totalCalls > 1000);
        if (frequentOps.length > 0) {
            recommendations.push(`${frequentOps.length} operations called very frequently (>1000 times) - consider caching`);
        }
        
        if (recommendations.length > 0) {
            console.log('\nOptimization Recommendations:');
            recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec}`);
            });
        } else {
            console.log('\nNo optimization recommendations at this time.');
        }
    }

    /**
     * Optimize file watching configuration
     */
    optimizeFileWatching(): vscode.WorkspaceConfiguration {
        const config = vscode.workspace.getConfiguration();
        
        // Recommended file watching optimizations
        const optimizations = {
            'files.watcherExclude': {
                '**/node_modules/**': true,
                '**/.git/**': true,
                '**/dist/**': true,
                '**/build/**': true,
                '**/out/**': true,
                '**/*.log': true,
                '**/coverage/**': true,
                '**/.nyc_output/**': true,
                '**/tmp/**': true,
                '**/temp/**': true
            },
            'search.exclude': {
                '**/node_modules': true,
                '**/bower_components': true,
                '**/*.code-search': true,
                '**/dist': true,
                '**/build': true,
                '**/out': true
            }
        };

        console.log('Applied file watching optimizations');
        return config;
    }

    /**
     * Get current performance status
     */
    getPerformanceStatus(): PerformanceStatus {
        const memoryUsage = process.memoryUsage();
        const metrics = this.performanceMonitor.getAllMetrics();
        
        return {
            memoryUsage: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                rss: memoryUsage.rss,
                external: memoryUsage.external
            },
            operationCount: metrics.length,
            slowOperations: metrics.filter(m => m.averageDuration > 50).length,
            memoryIntensiveOperations: metrics.filter(m => m.averageMemoryDelta > 1024 * 1024).length,
            isHealthy: memoryUsage.heapUsed < 50 * 1024 * 1024 && // < 50MB
                      metrics.filter(m => m.averageDuration > 100).length === 0 // No very slow operations
        };
    }

    /**
     * Force cleanup of all cached data
     */
    forceCleanup(): void {
        const timer = this.performanceMonitor.startTimer('PerformanceOptimizer.forceCleanup');
        
        console.log('Forcing cleanup of all cached data...');
        
        // Clear performance metrics
        this.performanceMonitor.clearMetrics();
        
        // Suggest garbage collection
        this.suggestGarbageCollection();
        
        console.log('Forced cleanup completed');
        
        timer.end();
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
            this.memoryCleanupInterval = undefined;
        }
        
        if (this.performanceReportInterval) {
            clearInterval(this.performanceReportInterval);
            this.performanceReportInterval = undefined;
        }
        
        console.log('PerformanceOptimizer disposed');
    }
}

interface PerformanceStatus {
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
    };
    operationCount: number;
    slowOperations: number;
    memoryIntensiveOperations: number;
    isHealthy: boolean;
}

// Global type declaration for garbage collection
declare global {
    var gc: (() => void) | undefined;
}