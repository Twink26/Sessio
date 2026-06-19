import * as vscode from 'vscode';
import { SessionData } from '../models/SessionData';
import { SessionStorage } from './SessionStorage';

/**
 * Service for managing session history and retrieving multiple sessions
 */
export class SessionHistoryService {
    private sessionStorage: SessionStorage;
    private maxHistorySize: number = 100; // Maximum number of sessions to keep

    constructor(context: vscode.ExtensionContext) {
        this.sessionStorage = new SessionStorage(context);
        this.loadMaxHistorySize();
    }

    /**
     * Load maximum history size from configuration
     */
    private loadMaxHistorySize(): void {
        const config = vscode.workspace.getConfiguration('sessionRecap');
        this.maxHistorySize = config.get<number>('maxHistorySize', 100);
    }

    /**
     * Get all sessions for the current workspace, sorted by start time (newest first)
     */
    async getAllSessions(): Promise<SessionData[]> {
        try {
            const sessionIds = await this.sessionStorage.getAllSessionIds();
            const workspaceId = this.getWorkspaceId();
            const sessions: SessionData[] = [];

            for (const sessionId of sessionIds) {
                try {
                    const session = await this.sessionStorage.loadSession(sessionId);
                    if (session) {
                        // Filter by workspace if needed
                        sessions.push(session);
                    }
                } catch (error) {
                    console.warn(`Failed to load session ${sessionId}:`, error);
                }
            }

            // Sort by start time (newest first)
            sessions.sort((a, b) => {
                const timeA = a.startTime.getTime();
                const timeB = b.startTime.getTime();
                return timeB - timeA;
            });

            // Limit to max history size
            return sessions.slice(0, this.maxHistorySize);
        } catch (error) {
            console.error('Failed to get all sessions:', error);
            return [];
        }
    }

    /**
     * Get sessions within a date range
     */
    async getSessionsInRange(startDate: Date, endDate: Date): Promise<SessionData[]> {
        const allSessions = await this.getAllSessions();
        return allSessions.filter(session => {
            const sessionTime = session.startTime.getTime();
            return sessionTime >= startDate.getTime() && sessionTime <= endDate.getTime();
        });
    }

    /**
     * Get sessions by tag
     */
    async getSessionsByTag(tag: string): Promise<SessionData[]> {
        const allSessions = await this.getAllSessions();
        return allSessions.filter(session => 
            session.tags && session.tags.includes(tag)
        );
    }

    /**
     * Search sessions by query (searches in summary, notes, file paths, commit messages)
     */
    async searchSessions(query: string): Promise<SessionData[]> {
        const allSessions = await this.getAllSessions();
        const lowerQuery = query.toLowerCase();

        return allSessions.filter(session => {
            // Search in summary
            if (session.summary && session.summary.toLowerCase().includes(lowerQuery)) {
                return true;
            }

            // Search in notes
            if (session.notes && session.notes.toLowerCase().includes(lowerQuery)) {
                return true;
            }

            // Search in file paths
            if (session.editedFiles.some(file => 
                file.filePath.toLowerCase().includes(lowerQuery)
            )) {
                return true;
            }

            // Search in commit messages
            if (session.gitCommits.some(commit => 
                commit.message.toLowerCase().includes(lowerQuery)
            )) {
                return true;
            }

            // Search in tags
            if (session.tags && session.tags.some(tag => 
                tag.toLowerCase().includes(lowerQuery)
            )) {
                return true;
            }

            return false;
        });
    }

    /**
     * Get session statistics
     */
    async getSessionStatistics(): Promise<SessionStatistics> {
        const allSessions = await this.getAllSessions();

        if (allSessions.length === 0) {
            return {
                totalSessions: 0,
                totalDuration: 0,
                totalFilesEdited: 0,
                totalCommits: 0,
                totalErrors: 0,
                averageSessionDuration: 0,
                averageFilesPerSession: 0,
                averageCommitsPerSession: 0,
                mostActiveDay: null,
                longestSession: null,
                shortestSession: null
            };
        }

        let totalDuration = 0;
        let totalFilesEdited = 0;
        let totalCommits = 0;
        let totalErrors = 0;
        const dayActivity: { [key: string]: number } = {};
        let longestSession: SessionData | null = null;
        let shortestSession: SessionData | null = null;
        let longestDuration = 0;
        let shortestDuration = Infinity;

        for (const session of allSessions) {
            // Calculate duration
            const duration = session.endTime 
                ? session.endTime.getTime() - session.startTime.getTime()
                : 0;
            totalDuration += duration;

            // Track longest/shortest
            if (duration > longestDuration) {
                longestDuration = duration;
                longestSession = session;
            }
            if (duration > 0 && duration < shortestDuration) {
                shortestDuration = duration;
                shortestSession = session;
            }

            // Count files, commits, errors
            totalFilesEdited += session.editedFiles.length;
            totalCommits += session.gitCommits.length;
            totalErrors += session.terminalErrors.length;

            // Track day activity
            const dayKey = session.startTime.toISOString().split('T')[0];
            dayActivity[dayKey] = (dayActivity[dayKey] || 0) + 1;
        }

        // Find most active day
        let mostActiveDay: string | null = null;
        let maxActivity = 0;
        for (const [day, count] of Object.entries(dayActivity)) {
            if (count > maxActivity) {
                maxActivity = count;
                mostActiveDay = day;
            }
        }

        return {
            totalSessions: allSessions.length,
            totalDuration: totalDuration,
            totalFilesEdited: totalFilesEdited,
            totalCommits: totalCommits,
            totalErrors: totalErrors,
            averageSessionDuration: totalDuration / allSessions.length,
            averageFilesPerSession: totalFilesEdited / allSessions.length,
            averageCommitsPerSession: totalCommits / allSessions.length,
            mostActiveDay: mostActiveDay,
            longestSession: longestSession,
            shortestSession: shortestSession
        };
    }

    /**
     * Get all unique tags from all sessions
     */
    async getAllTags(): Promise<string[]> {
        const allSessions = await this.getAllSessions();
        const tagSet = new Set<string>();

        for (const session of allSessions) {
            if (session.tags) {
                session.tags.forEach(tag => tagSet.add(tag));
            }
        }

        return Array.from(tagSet).sort();
    }

    /**
     * Get workspace identifier
     */
    private getWorkspaceId(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return Buffer.from(workspaceFolder.uri.fsPath).toString('base64');
        }
        return 'no-workspace';
    }

    /**
     * Clean up old sessions beyond max history size
     */
    async cleanupOldSessions(): Promise<number> {
        const allSessions = await this.getAllSessions();
        
        if (allSessions.length <= this.maxHistorySize) {
            return 0;
        }

        // Sort by start time (oldest first)
        const sortedSessions = [...allSessions].sort((a, b) => {
            return a.startTime.getTime() - b.startTime.getTime();
        });

        // Delete oldest sessions
        const sessionsToDelete = sortedSessions.slice(0, allSessions.length - this.maxHistorySize);
        let deletedCount = 0;

        for (const session of sessionsToDelete) {
            try {
                await this.sessionStorage.deleteSession(session.sessionId);
                deletedCount++;
            } catch (error) {
                console.warn(`Failed to delete session ${session.sessionId}:`, error);
            }
        }

        return deletedCount;
    }
}

/**
 * Session statistics interface
 */
export interface SessionStatistics {
    totalSessions: number;
    totalDuration: number; // milliseconds
    totalFilesEdited: number;
    totalCommits: number;
    totalErrors: number;
    averageSessionDuration: number; // milliseconds
    averageFilesPerSession: number;
    averageCommitsPerSession: number;
    mostActiveDay: string | null;
    longestSession: SessionData | null;
    shortestSession: SessionData | null;
}

