import * as vscode from 'vscode';
import { SessionData } from '../models/SessionData';

declare const fetch: any;

/** Payload stored on the public sharing API */
export interface SharedSessionPayload {
  sessionId: string;
  startTime: string;
  endTime?: string;
  summary: string;
  editedFiles: Array<{
    filePath: string;
    changeType: string;
    lineCount?: number;
  }>;
  gitCommits: Array<{
    hash: string;
    message: string;
    author: string;
  }>;
  terminalErrors: Array<{
    message: string;
    errorType: string;
  }>;
  tags?: string[];
  notes?: string;
  productivityScore?: number;
}

export interface SharedSessionEntry {
  id: string;
  contributorId: string;
  displayName: string;
  submittedAt: string;
  session: SharedSessionPayload;
}

export interface SharedSessionsResponse {
  sessions: SharedSessionEntry[];
  count: number;
  aggregatedAt: string;
}

/**
 * HTTP client for the public Session Recap sharing API
 */
export class ShareApiClient {
  static getApiBaseUrl(): string | null {
    const url = vscode.workspace
      .getConfiguration('sessionRecap')
      .get<string>('shareApiUrl', 'http://localhost:3847')
      .trim();

    if (!url) {
      return null;
    }

    return url.replace(/\/+$/, '');
  }

  static toPayload(sessionData: SessionData): SharedSessionPayload {
    return {
      sessionId: sessionData.sessionId,
      startTime: sessionData.startTime.toISOString(),
      endTime: sessionData.endTime?.toISOString(),
      summary: sessionData.summary || 'No summary available',
      editedFiles: sessionData.editedFiles.map((file) => ({
        filePath: file.filePath,
        changeType: file.changeType,
        lineCount: file.lineCount
      })),
      gitCommits: sessionData.gitCommits.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author
      })),
      terminalErrors: sessionData.terminalErrors.map((error) => ({
        message: error.message,
        errorType: error.errorType
      })),
      tags: sessionData.tags,
      notes: sessionData.notes,
      productivityScore: sessionData.productivityScore
    };
  }

  static async submitSession(
    contributorId: string,
    displayName: string,
    sessionData: SessionData
  ): Promise<SharedSessionEntry> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Share API URL is not configured');
    }

    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contributorId,
        displayName,
        session: this.toPayload(sessionData)
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Share API error (${response.status}): ${body}`);
    }

    return response.json() as Promise<SharedSessionEntry>;
  }

  static async fetchSharedSessions(): Promise<SharedSessionsResponse> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Share API URL is not configured');
    }

    const response = await fetch(`${baseUrl}/api/sessions`);
    if (!response.ok) {
      throw new Error(`Share API error (${response.status})`);
    }

    return response.json() as Promise<SharedSessionsResponse>;
  }

  static async checkHealth(): Promise<boolean> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return false;
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
