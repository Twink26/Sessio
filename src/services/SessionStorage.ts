import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ISessionStorage } from '../interfaces/ISessionStorage';
import { SessionData } from '../models/SessionData';
import { StoredSession } from '../models/StoredSession';
import { DataConverter } from './DataConverter';
import { DataValidator, ValidationError } from './DataValidator';

/**
 * File-based session storage implementation
 */
export class SessionStorage implements ISessionStorage {
  private readonly storageDir: string;
  private readonly sessionFileExtension = '.session.json';

  constructor(private context: vscode.ExtensionContext) {
    // Use VS Code's global storage path for persistence across workspace changes
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'sessions');
  }

  /**
   * Initialize storage directory
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  /**
   * Get workspace identifier for session scoping
   */
  private getWorkspaceId(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return Buffer.from(workspaceFolder.uri.fsPath).toString('base64');
    }
    return 'no-workspace';
  }

  /**
   * Generate file path for a session
   */
  private getSessionFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}${this.sessionFileExtension}`);
  }

  /**
   * Save session data to persistent storage
   */
  async saveSession(sessionData: SessionData): Promise<void> {
    try {
      await this.ensureStorageDirectory();
      
      const workspaceId = this.getWorkspaceId();
      const storedSession = DataConverter.toStoredSession(sessionData, workspaceId);
      
      // Validate before saving
      DataValidator.validateStoredSession(storedSession);
      
      const filePath = this.getSessionFilePath(sessionData.sessionId);
      const jsonData = JSON.stringify(storedSession, null, 2);
      
      await fs.writeFile(filePath, jsonData, 'utf8');
      
    } catch (error) {
      throw new Error(`Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load the most recent session data for current workspace
   */
  async loadLastSession(): Promise<SessionData | null> {
    try {
      const sessionIds = await this.getAllSessionIds();
      if (sessionIds.length === 0) {
        return null;
      }

      const workspaceId = this.getWorkspaceId();
      
      // Find the most recent session for this workspace
      let latestSession: SessionData | null = null;
      let latestTime = 0;

      for (const sessionId of sessionIds) {
        try {
          const session = await this.loadSessionFile(sessionId);
          if (session && session.workspaceId === workspaceId) {
            const sessionTime = new Date(session.startTime).getTime();
            if (sessionTime > latestTime) {
              latestTime = sessionTime;
              latestSession = DataConverter.fromStoredSession(session);
            }
          }
        } catch (error) {
          // Skip corrupted session files
          console.warn(`Skipping corrupted session file: ${sessionId}`, error);
        }
      }

      return latestSession;
    } catch (error) {
      throw new Error(`Failed to load last session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load session data by session ID
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const storedSession = await this.loadSessionFile(sessionId);
      return storedSession ? DataConverter.fromStoredSession(storedSession) : null;
    } catch (error) {
      throw new Error(`Failed to load session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load and validate a session file
   */
  private async loadSessionFile(sessionId: string): Promise<StoredSession | null> {
    const filePath = this.getSessionFilePath(sessionId);
    
    try {
      const jsonData = await fs.readFile(filePath, 'utf8');
      const rawData = JSON.parse(jsonData);
      
      // Validate and migrate if necessary
      return DataValidator.migrateToCurrentVersion(rawData);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all stored session IDs
   */
  async getAllSessionIds(): Promise<string[]> {
    try {
      await this.ensureStorageDirectory();
      
      const files = await fs.readdir(this.storageDir, { withFileTypes: false }) as string[];
      return files
        .filter(file => file.endsWith(this.sessionFileExtension))
        .map(file => file.replace(this.sessionFileExtension, ''));
    } catch (error) {
      throw new Error(`Failed to get session IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to delete session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Clear all stored sessions
   */
  async clearAllSessions(): Promise<void> {
    try {
      const sessionIds = await this.getAllSessionIds();
      await Promise.all(sessionIds.map(id => this.deleteSession(id)));
    } catch (error) {
      throw new Error(`Failed to clear sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if storage is available and writable
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureStorageDirectory();
      
      // Test write access
      const testFile = path.join(this.storageDir, '.test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return true;
    } catch {
      return false;
    }
  }
}