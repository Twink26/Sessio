/**
 * Serializable session data structure for JSON storage
 */
export interface StoredSession {
  sessionId: string;
  workspaceId: string;
  startTime: string; // ISO string
  endTime?: string;
  editedFiles: StoredFileEdit[];
  gitCommits: StoredGitCommit[];
  terminalErrors: StoredTerminalError[];
  aiSummary?: string;
  notes?: string;
  tags?: string[];
  productivityScore?: number;
  version: string; // for schema migration
}

/**
 * Serializable file edit data
 */
export interface StoredFileEdit {
  filePath: string;
  timestamp: string;
  changeType: string;
  lineCount?: number;
}

/**
 * Serializable Git commit data
 */
export interface StoredGitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: string[];
}

/**
 * Serializable terminal error data
 */
export interface StoredTerminalError {
  message: string;
  timestamp: string;
  terminalName: string;
  errorType: string;
}

/**
 * Current schema version for migration support
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';