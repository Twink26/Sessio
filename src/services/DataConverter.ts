import { SessionData } from '../models/SessionData';
import { FileEdit } from '../models/FileEdit';
import { GitCommit } from '../models/GitCommit';
import { TerminalError } from '../models/TerminalError';
import { 
  StoredSession, 
  StoredFileEdit, 
  StoredGitCommit, 
  StoredTerminalError,
  CURRENT_SCHEMA_VERSION 
} from '../models/StoredSession';
import { v4 as uuidv4 } from 'uuid';

/**
 * Utility class for converting between runtime and storage data formats
 */
export class DataConverter {
  /**
   * Convert SessionData to StoredSession for JSON serialization
   */
  static toStoredSession(sessionData: SessionData, workspaceId: string): StoredSession {
    return {
      sessionId: sessionData.sessionId,
      workspaceId,
      startTime: sessionData.startTime.toISOString(),
      endTime: sessionData.endTime?.toISOString(),
      editedFiles: sessionData.editedFiles.map(this.toStoredFileEdit),
      gitCommits: sessionData.gitCommits.map(this.toStoredGitCommit),
      terminalErrors: sessionData.terminalErrors.map(this.toStoredTerminalError),
      aiSummary: sessionData.summary,
      notes: sessionData.notes,
      tags: sessionData.tags,
      productivityScore: sessionData.productivityScore,
      version: CURRENT_SCHEMA_VERSION
    };
  }

  /**
   * Convert StoredSession to SessionData for runtime use
   */
  static fromStoredSession(storedSession: StoredSession): SessionData {
    return {
      sessionId: storedSession.sessionId,
      startTime: new Date(storedSession.startTime),
      endTime: storedSession.endTime ? new Date(storedSession.endTime) : undefined,
      editedFiles: storedSession.editedFiles.map(this.fromStoredFileEdit),
      gitCommits: storedSession.gitCommits.map(this.fromStoredGitCommit),
      terminalErrors: storedSession.terminalErrors.map(this.fromStoredTerminalError),
      summary: storedSession.aiSummary,
      notes: storedSession.notes,
      tags: storedSession.tags,
      productivityScore: storedSession.productivityScore
    };
  }

  /**
   * Create a new session with generated ID
   */
  static createNewSession(): SessionData {
    return {
      sessionId: uuidv4(),
      startTime: new Date(),
      editedFiles: [],
      gitCommits: [],
      terminalErrors: []
    };
  }

  private static toStoredFileEdit(fileEdit: FileEdit): StoredFileEdit {
    return {
      filePath: fileEdit.filePath,
      timestamp: fileEdit.timestamp.toISOString(),
      changeType: fileEdit.changeType,
      lineCount: fileEdit.lineCount
    };
  }

  private static fromStoredFileEdit(storedFileEdit: StoredFileEdit): FileEdit {
    return {
      filePath: storedFileEdit.filePath,
      timestamp: new Date(storedFileEdit.timestamp),
      changeType: storedFileEdit.changeType as 'created' | 'modified' | 'deleted',
      lineCount: storedFileEdit.lineCount
    };
  }

  private static toStoredGitCommit(gitCommit: GitCommit): StoredGitCommit {
    return {
      hash: gitCommit.hash,
      message: gitCommit.message,
      author: gitCommit.author,
      timestamp: gitCommit.timestamp.toISOString(),
      filesChanged: gitCommit.filesChanged
    };
  }

  private static fromStoredGitCommit(storedGitCommit: StoredGitCommit): GitCommit {
    return {
      hash: storedGitCommit.hash,
      message: storedGitCommit.message,
      author: storedGitCommit.author,
      timestamp: new Date(storedGitCommit.timestamp),
      filesChanged: storedGitCommit.filesChanged
    };
  }

  private static toStoredTerminalError(terminalError: TerminalError): StoredTerminalError {
    return {
      message: terminalError.message,
      timestamp: terminalError.timestamp.toISOString(),
      terminalName: terminalError.terminalName,
      errorType: terminalError.errorType
    };
  }

  private static fromStoredTerminalError(storedTerminalError: StoredTerminalError): TerminalError {
    return {
      message: storedTerminalError.message,
      timestamp: new Date(storedTerminalError.timestamp),
      terminalName: storedTerminalError.terminalName,
      errorType: storedTerminalError.errorType as 'error' | 'exception' | 'failure'
    };
  }
}