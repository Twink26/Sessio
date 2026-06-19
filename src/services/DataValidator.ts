import { StoredSession, CURRENT_SCHEMA_VERSION } from '../models/StoredSession';

/**
 * Validation errors for session data
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Service for validating session data integrity and schema compatibility
 */
export class DataValidator {
  /**
   * Validate a stored session object
   */
  static validateStoredSession(data: any): StoredSession {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Session data must be an object');
    }

    // Check required fields
    if (!data.sessionId || typeof data.sessionId !== 'string') {
      throw new ValidationError('sessionId is required and must be a string', 'sessionId');
    }

    if (!data.workspaceId || typeof data.workspaceId !== 'string') {
      throw new ValidationError('workspaceId is required and must be a string', 'workspaceId');
    }

    if (!data.startTime || typeof data.startTime !== 'string') {
      throw new ValidationError('startTime is required and must be a string', 'startTime');
    }

    if (!data.version || typeof data.version !== 'string') {
      throw new ValidationError('version is required and must be a string', 'version');
    }

    // Validate timestamp format
    const startDate = new Date(data.startTime);
    if (isNaN(startDate.getTime())) {
      throw new ValidationError('startTime must be a valid ISO date string', 'startTime');
    }

    if (data.endTime) {
      const endDate = new Date(data.endTime);
      if (isNaN(endDate.getTime())) {
        throw new ValidationError('endTime must be a valid ISO date string', 'endTime');
      }
    }

    // Validate arrays
    if (!Array.isArray(data.editedFiles)) {
      throw new ValidationError('editedFiles must be an array', 'editedFiles');
    }

    if (!Array.isArray(data.gitCommits)) {
      throw new ValidationError('gitCommits must be an array', 'gitCommits');
    }

    if (!Array.isArray(data.terminalErrors)) {
      throw new ValidationError('terminalErrors must be an array', 'terminalErrors');
    }

    // Validate file edits
    data.editedFiles.forEach((fileEdit: any, index: number) => {
      this.validateFileEdit(fileEdit, `editedFiles[${index}]`);
    });

    // Validate git commits
    data.gitCommits.forEach((commit: any, index: number) => {
      this.validateGitCommit(commit, `gitCommits[${index}]`);
    });

    // Validate terminal errors
    data.terminalErrors.forEach((error: any, index: number) => {
      this.validateTerminalError(error, `terminalErrors[${index}]`);
    });

    return data as StoredSession;
  }

  /**
   * Check if the schema version is compatible
   */
  static isSchemaCompatible(version: string): boolean {
    // For now, we only support the current version
    // In the future, this could handle migration logic
    return version === CURRENT_SCHEMA_VERSION;
  }

  /**
   * Migrate session data to current schema version
   */
  static migrateToCurrentVersion(data: any): StoredSession {
    if (!data.version) {
      // Assume legacy format, add version
      data.version = CURRENT_SCHEMA_VERSION;
    }

    if (!this.isSchemaCompatible(data.version)) {
      throw new ValidationError(`Unsupported schema version: ${data.version}. Current version: ${CURRENT_SCHEMA_VERSION}`);
    }

    return this.validateStoredSession(data);
  }

  private static validateFileEdit(fileEdit: any, fieldPath: string): void {
    if (!fileEdit || typeof fileEdit !== 'object') {
      throw new ValidationError(`${fieldPath} must be an object`);
    }

    if (!fileEdit.filePath || typeof fileEdit.filePath !== 'string') {
      throw new ValidationError(`${fieldPath}.filePath is required and must be a string`);
    }

    if (!fileEdit.timestamp || typeof fileEdit.timestamp !== 'string') {
      throw new ValidationError(`${fieldPath}.timestamp is required and must be a string`);
    }

    if (!fileEdit.changeType || typeof fileEdit.changeType !== 'string') {
      throw new ValidationError(`${fieldPath}.changeType is required and must be a string`);
    }

    const validChangeTypes = ['created', 'modified', 'deleted'];
    if (!validChangeTypes.includes(fileEdit.changeType)) {
      throw new ValidationError(`${fieldPath}.changeType must be one of: ${validChangeTypes.join(', ')}`);
    }

    const fileEditDate = new Date(fileEdit.timestamp);
    if (isNaN(fileEditDate.getTime())) {
      throw new ValidationError(`${fieldPath}.timestamp must be a valid ISO date string`);
    }
  }

  private static validateGitCommit(commit: any, fieldPath: string): void {
    if (!commit || typeof commit !== 'object') {
      throw new ValidationError(`${fieldPath} must be an object`);
    }

    const requiredStringFields = ['hash', 'message', 'author', 'timestamp'];
    for (const field of requiredStringFields) {
      if (!commit[field] || typeof commit[field] !== 'string') {
        throw new ValidationError(`${fieldPath}.${field} is required and must be a string`);
      }
    }

    if (!Array.isArray(commit.filesChanged)) {
      throw new ValidationError(`${fieldPath}.filesChanged must be an array`);
    }

    const commitDate = new Date(commit.timestamp);
    if (isNaN(commitDate.getTime())) {
      throw new ValidationError(`${fieldPath}.timestamp must be a valid ISO date string`);
    }
  }

  private static validateTerminalError(error: any, fieldPath: string): void {
    if (!error || typeof error !== 'object') {
      throw new ValidationError(`${fieldPath} must be an object`);
    }

    const requiredStringFields = ['message', 'timestamp', 'terminalName', 'errorType'];
    for (const field of requiredStringFields) {
      if (!error[field] || typeof error[field] !== 'string') {
        throw new ValidationError(`${fieldPath}.${field} is required and must be a string`);
      }
    }

    const validErrorTypes = ['error', 'exception', 'failure'];
    if (!validErrorTypes.includes(error.errorType)) {
      throw new ValidationError(`${fieldPath}.errorType must be one of: ${validErrorTypes.join(', ')}`);
    }

    const errorDate = new Date(error.timestamp);
    if (isNaN(errorDate.getTime())) {
      throw new ValidationError(`${fieldPath}.timestamp must be a valid ISO date string`);
    }
  }
}