import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionData } from '../models/SessionData';
import { SessionHistoryService } from './SessionHistoryService';
import { DataConverter } from './DataConverter';

/**
 * Service for exporting and importing session data
 */
export class ExportImportService {
    private sessionHistoryService: SessionHistoryService;

    constructor(context: vscode.ExtensionContext) {
        this.sessionHistoryService = new SessionHistoryService(context);
    }

    /**
     * Export sessions to JSON file
     */
    async exportToJSON(sessions: SessionData[], filePath?: string): Promise<string> {
        try {
            // Convert sessions to serializable format
            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                sessionCount: sessions.length,
                sessions: sessions.map(session => this.serializeSession(session))
            };

            const jsonContent = JSON.stringify(exportData, null, 2);

            // If file path not provided, ask user to select
            if (!filePath) {
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`session-export-${Date.now()}.json`),
                    filters: {
                        'JSON Files': ['json'],
                        'All Files': ['*']
                    },
                    saveLabel: 'Export Sessions'
                });

                if (!uri) {
                    throw new Error('Export cancelled by user');
                }

                filePath = uri.fsPath;
            }

            await fs.writeFile(filePath, jsonContent, 'utf8');
            return filePath;
        } catch (error) {
            throw new Error(`Failed to export sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Export sessions to CSV file
     */
    async exportToCSV(sessions: SessionData[], filePath?: string): Promise<string> {
        try {
            const csvRows: string[] = [];
            
            // CSV Header
            csvRows.push('Session ID,Start Time,End Time,Duration (minutes),Files Edited,Commits,Errors,Summary,Notes,Tags');

            // CSV Rows
            for (const session of sessions) {
                const duration = session.endTime 
                    ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000)
                    : 0;
                
                const row = [
                    session.sessionId,
                    session.startTime.toISOString(),
                    session.endTime?.toISOString() || '',
                    duration.toString(),
                    session.editedFiles.length.toString(),
                    session.gitCommits.length.toString(),
                    session.terminalErrors.length.toString(),
                    this.escapeCSV(session.summary || ''),
                    this.escapeCSV(session.notes || ''),
                    (session.tags || []).join(';')
                ];

                csvRows.push(row.join(','));
            }

            const csvContent = csvRows.join('\n');

            // If file path not provided, ask user to select
            if (!filePath) {
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`session-export-${Date.now()}.csv`),
                    filters: {
                        'CSV Files': ['csv'],
                        'All Files': ['*']
                    },
                    saveLabel: 'Export Sessions'
                });

                if (!uri) {
                    throw new Error('Export cancelled by user');
                }

                filePath = uri.fsPath;
            }

            await fs.writeFile(filePath, csvContent, 'utf8');
            return filePath;
        } catch (error) {
            throw new Error(`Failed to export sessions to CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Import sessions from JSON file
     */
    async importFromJSON(filePath?: string): Promise<SessionData[]> {
        try {
            // If file path not provided, ask user to select
            if (!filePath) {
                const uri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'JSON Files': ['json'],
                        'All Files': ['*']
                    },
                    openLabel: 'Import Sessions'
                });

                if (!uri || uri.length === 0) {
                    throw new Error('Import cancelled by user');
                }

                filePath = uri[0].fsPath;
            }

            const jsonContent = await fs.readFile(filePath, 'utf8');
            const importData = JSON.parse(jsonContent);

            if (!importData.sessions || !Array.isArray(importData.sessions)) {
                throw new Error('Invalid import file format: missing sessions array');
            }

            // Deserialize sessions
            const sessions: SessionData[] = [];
            for (const serializedSession of importData.sessions) {
                try {
                    const session = this.deserializeSession(serializedSession);
                    sessions.push(session);
                } catch (error) {
                    console.warn(`Failed to deserialize session:`, error);
                }
            }

            return sessions;
        } catch (error) {
            throw new Error(`Failed to import sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Serialize session for export
     */
    private serializeSession(session: SessionData): any {
        return {
            sessionId: session.sessionId,
            startTime: session.startTime.toISOString(),
            endTime: session.endTime?.toISOString(),
            editedFiles: session.editedFiles.map(file => ({
                filePath: file.filePath,
                timestamp: file.timestamp.toISOString(),
                changeType: file.changeType,
                lineCount: file.lineCount
            })),
            gitCommits: session.gitCommits.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author,
                timestamp: commit.timestamp.toISOString(),
                filesChanged: commit.filesChanged
            })),
            terminalErrors: session.terminalErrors.map(error => ({
                message: error.message,
                timestamp: error.timestamp.toISOString(),
                terminalName: error.terminalName,
                errorType: error.errorType
            })),
            summary: session.summary,
            notes: session.notes,
            tags: session.tags,
            productivityScore: session.productivityScore
        };
    }

    /**
     * Deserialize session from import
     */
    private deserializeSession(data: any): SessionData {
        return {
            sessionId: data.sessionId,
            startTime: new Date(data.startTime),
            endTime: data.endTime ? new Date(data.endTime) : undefined,
            editedFiles: (data.editedFiles || []).map((file: any) => ({
                filePath: file.filePath,
                timestamp: new Date(file.timestamp),
                changeType: file.changeType,
                lineCount: file.lineCount
            })),
            gitCommits: (data.gitCommits || []).map((commit: any) => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author,
                timestamp: new Date(commit.timestamp),
                filesChanged: commit.filesChanged || []
            })),
            terminalErrors: (data.terminalErrors || []).map((error: any) => ({
                message: error.message,
                timestamp: new Date(error.timestamp),
                terminalName: error.terminalName,
                errorType: error.errorType
            })),
            summary: data.summary,
            notes: data.notes,
            tags: data.tags,
            productivityScore: data.productivityScore
        };
    }

    /**
     * Escape CSV field
     */
    private escapeCSV(field: string): string {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }
}

