import { FileEdit } from './FileEdit';
import { GitCommit } from './GitCommit';
import { TerminalError } from './TerminalError';

/**
 * Complete session data structure
 */
export interface SessionData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  editedFiles: FileEdit[];
  gitCommits: GitCommit[];
  terminalErrors: TerminalError[];
  summary?: string;
  changeDigest?: string; // Compact git/file change text used for detailed recaps
  notes?: string; // User-added notes
  tags?: string[]; // User-defined tags
  productivityScore?: number; // Calculated productivity score (0-100)
}