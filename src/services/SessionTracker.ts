import * as vscode from 'vscode';
import { ISessionTracker } from '../interfaces/ISessionTracker';
import { SessionData } from '../models/SessionData';
import { ISidebarPanelProvider } from '../interfaces/ISidebarPanelProvider';
import { IFileChangeMonitor } from '../interfaces/IFileChangeMonitor';
import { IGitActivityMonitor } from '../interfaces/IGitActivityMonitor';
import { ITerminalErrorMonitor } from '../interfaces/ITerminalErrorMonitor';
import { ISessionStorage } from '../interfaces/ISessionStorage';
import { FileChangeMonitor } from './FileChangeMonitor';
import { GitActivityMonitor } from './GitActivityMonitor';
import { TerminalErrorMonitor } from './TerminalErrorMonitor';
import { SessionStorage } from './SessionStorage';
import { PerformanceMonitor } from './PerformanceMonitor';
import { PerformanceOptimizer } from './PerformanceOptimizer';
import { ProductivityCalculator } from './ProductivityCalculator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Central coordinator for all session tracking activities
 * Integrates file, Git, and terminal monitors into unified session tracking
 * Optimized with performance monitoring and memory management
 */
export class SessionTracker implements ISessionTracker {
    private currentSession: SessionData;
    private previousSession: SessionData | null = null;
    private context: vscode.ExtensionContext;
    private sidebarProvider: ISidebarPanelProvider;
    
    // Monitoring services
    private fileChangeMonitor: IFileChangeMonitor;
    private gitActivityMonitor: IGitActivityMonitor;
    private terminalErrorMonitor: ITerminalErrorMonitor;
    private sessionStorage: ISessionStorage;
    private performanceMonitor: PerformanceMonitor;
    private performanceOptimizer: PerformanceOptimizer;
    
    // State management
    private isTracking: boolean = false;
    private disposables: vscode.Disposable[] = [];
    
    // Performance optimization
    private gitUpdateInterval: NodeJS.Timeout | undefined;
    private sidebarUpdateThrottle: NodeJS.Timeout | undefined;
    private readonly gitUpdateFrequency = 30000; // 30 seconds
    private readonly sidebarUpdateDelay = 1000; // 1 second throttle

    constructor(context: vscode.ExtensionContext, sidebarProvider: ISidebarPanelProvider) {
        this.context = context;
        this.sidebarProvider = sidebarProvider;
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.performanceOptimizer = PerformanceOptimizer.getInstance();
        
        // Initialize monitoring services
        this.fileChangeMonitor = new FileChangeMonitor();
        this.gitActivityMonitor = new GitActivityMonitor();
        this.terminalErrorMonitor = new TerminalErrorMonitor();
        this.sessionStorage = new SessionStorage(context);
        
        // Create new session
        this.currentSession = this.createNewSession();
        
        // Load previous session on initialization (async, but don't wait)
        this.loadPreviousSession().catch(error => {
            console.error('Failed to load previous session during initialization:', error);
        });
    }

    /**
     * Start tracking the current session with performance monitoring
     */
    startTracking(): void {
        const timer = this.performanceMonitor.startTimer('SessionTracker.startTracking');
        
        if (this.isTracking) {
            timer.end();
            return;
        }

        console.log('Session tracking started for session:', this.currentSession.sessionId);
        this.isTracking = true;

        // Set up file change monitoring with throttled updates
        this.fileChangeMonitor.onFileChanged((fileEdit) => {
            this.currentSession.editedFiles.push(fileEdit);
            this.throttledSidebarUpdate();
        });

        // Set up terminal error monitoring with throttled updates
        this.terminalErrorMonitor.onTerminalError((terminalError) => {
            // Only keep the most recent error as per requirements
            this.currentSession.terminalErrors = [terminalError];
            this.throttledSidebarUpdate();
        });

        // Periodically update Git commits
        this.gitUpdateInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.updateGitCommits();
            }
        }, this.gitUpdateFrequency);

        // Store the interval for cleanup
        this.disposables.push({
            dispose: () => {
                if (this.gitUpdateInterval) {
                    clearInterval(this.gitUpdateInterval);
                    this.gitUpdateInterval = undefined;
                }
            }
        });

        // Initial Git commits update
        this.updateGitCommits();
        
        timer.end();
    }

    /**
     * Stop tracking the current session
     */
    stopTracking(): void {
        if (!this.isTracking) {
            return;
        }

        console.log('Session tracking stopped for session:', this.currentSession.sessionId);
        this.isTracking = false;
        this.currentSession.endTime = new Date();

        // Final update of Git commits
        this.updateGitCommits();

        // Save the session
        this.saveSession().catch(error => {
            console.error('Failed to save session on stop:', error);
        });

        // Clean up disposables
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }

    /**
     * Get the current active session data
     */
    getCurrentSession(): SessionData {
        return {
            ...this.currentSession,
            editedFiles: [...this.currentSession.editedFiles],
            gitCommits: [...this.currentSession.gitCommits],
            terminalErrors: [...this.currentSession.terminalErrors]
        }; // Return a deep copy to prevent external modification
    }

    /**
     * Get the previous session data if available
     */
    getPreviousSession(): SessionData | null {
        return this.previousSession ? {
            ...this.previousSession,
            editedFiles: [...this.previousSession.editedFiles],
            gitCommits: [...this.previousSession.gitCommits],
            terminalErrors: [...this.previousSession.terminalErrors]
        } : null;
    }

    /**
     * Save the current session to persistent storage
     */
    async saveSession(): Promise<void> {
        try {
            console.log('Saving session:', this.currentSession.sessionId);
            
            // Update session with current monitor states
            this.currentSession.editedFiles = this.fileChangeMonitor.getEditedFiles();
            const lastError = this.terminalErrorMonitor.getLastError();
            this.currentSession.terminalErrors = lastError ? [lastError] : [];
            
            // Calculate productivity score if session has ended
            if (this.currentSession.endTime) {
                this.currentSession.productivityScore = ProductivityCalculator.calculateProductivityScore(this.currentSession);
            }
            
            // Save to storage
            await this.sessionStorage.saveSession(this.currentSession);
            
            console.log('Session saved successfully');
        } catch (error) {
            console.error('Failed to save session:', error);
            throw error;
        }
    }

    /**
     * Reset the current session and all monitors
     */
    reset(): void {
        console.log('Resetting session tracker');
        
        // Stop current tracking
        if (this.isTracking) {
            this.stopTracking();
        }

        // Reset all monitors
        this.fileChangeMonitor.reset();
        this.gitActivityMonitor = new GitActivityMonitor(); // Recreate for fresh state
        this.terminalErrorMonitor.reset();

        // Create new session
        this.currentSession = this.createNewSession();
        
        // Update sidebar
        this.updateSidebarContent();
    }

    /**
     * Load the previous session from storage
     */
    private async loadPreviousSession(): Promise<void> {
        try {
            this.previousSession = await this.sessionStorage.loadLastSession();
            console.log('Previous session loaded:', this.previousSession?.sessionId || 'none');
        } catch (error) {
            console.error('Failed to load previous session:', error);
            this.previousSession = null;
        }
    }

    /**
     * Ensure previous session is loaded and return it
     */
    async ensurePreviousSessionLoaded(): Promise<SessionData | null> {
        if (this.previousSession === null) {
            await this.loadPreviousSession();
        }
        return this.getPreviousSession();
    }

    /**
     * Update Git commits for the current session with performance monitoring
     */
    private async updateGitCommits(): Promise<void> {
        const timer = this.performanceMonitor.startTimer('SessionTracker.updateGitCommits');
        
        try {
            if (!this.gitActivityMonitor.isGitRepository()) {
                timer.end();
                return;
            }

            const commits = await this.gitActivityMonitor.getCommitsSince(this.currentSession.startTime);
            this.currentSession.gitCommits = commits;
            this.throttledSidebarUpdate();
        } catch (error) {
            console.error('Failed to update Git commits:', error);
        }
        
        timer.end();
    }

    /**
     * Update the sidebar panel with current session data (throttled)
     */
    private throttledSidebarUpdate(): void {
        // Clear existing throttle timer
        if (this.sidebarUpdateThrottle) {
            clearTimeout(this.sidebarUpdateThrottle);
        }

        // Set new throttle timer
        this.sidebarUpdateThrottle = setTimeout(() => {
            this.updateSidebarContent();
            this.sidebarUpdateThrottle = undefined;
        }, this.sidebarUpdateDelay);
    }

    /**
     * Update the sidebar panel with current session data
     */
    private updateSidebarContent(): void {
        const timer = this.performanceMonitor.startTimer('SessionTracker.updateSidebarContent');
        
        try {
            this.sidebarProvider.updateContent(this.currentSession);
        } catch (error) {
            console.error('Failed to update sidebar content:', error);
        }
        
        timer.end();
    }

    /**
     * Create a new session with unique ID and current timestamp
     */
    private createNewSession(): SessionData {
        return {
            sessionId: uuidv4(),
            startTime: new Date(),
            editedFiles: [],
            gitCommits: [],
            terminalErrors: []
        };
    }

    /**
     * Dispose of all resources and stop tracking with cleanup
     */
    dispose(): void {
        const timer = this.performanceMonitor.startTimer('SessionTracker.dispose');
        
        console.log('Disposing SessionTracker');
        
        // Stop tracking if active
        if (this.isTracking) {
            this.stopTracking();
        }

        // Clear throttle timers
        if (this.sidebarUpdateThrottle) {
            clearTimeout(this.sidebarUpdateThrottle);
            this.sidebarUpdateThrottle = undefined;
        }

        if (this.gitUpdateInterval) {
            clearInterval(this.gitUpdateInterval);
            this.gitUpdateInterval = undefined;
        }

        // Dispose of monitors
        if ('dispose' in this.fileChangeMonitor) {
            (this.fileChangeMonitor as any).dispose();
        }
        if ('dispose' in this.terminalErrorMonitor) {
            (this.terminalErrorMonitor as any).dispose();
        }
        if ('dispose' in this.gitActivityMonitor) {
            (this.gitActivityMonitor as any).dispose();
        }

        // Clean up disposables
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];

        // Clear session data to free memory
        this.currentSession.editedFiles = [];
        this.currentSession.gitCommits = [];
        this.currentSession.terminalErrors = [];
        
        if (this.previousSession) {
            this.previousSession.editedFiles = [];
            this.previousSession.gitCommits = [];
            this.previousSession.terminalErrors = [];
        }
        
        timer.end();
    }
}