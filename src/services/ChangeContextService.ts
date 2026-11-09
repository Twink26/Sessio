import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { SessionData } from '../models/SessionData';

const exec = promisify(cp.exec);

const MAX_DIGEST_CHARS = 14_000;
const SENSITIVE_PATH = /(^|[\\/])(\.env|\.env\..*|credentials|secrets?|id_rsa)(\.|$|[\\/])/i;
const SKIP_PATH = /\.(png|jpe?g|gif|webp|ico|pdf|zip|lock|woff2?|ttf|mp4|exe|dll)$/i;

/**
 * Builds a compact digest of what actually changed so AI recaps can be specific.
 */
export class ChangeContextService {
  async buildDigest(session: SessionData): Promise<string> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const sections: string[] = [];

    if (session.editedFiles.length > 0) {
      sections.push('Edited files:');
      for (const file of session.editedFiles.slice(0, 40)) {
        sections.push(`- ${file.changeType}: ${file.filePath}${file.lineCount ? ` (${file.lineCount} lines)` : ''}`);
      }
    }

    if (session.gitCommits.length > 0) {
      sections.push('\nCommits:');
      for (const commit of session.gitCommits.slice(0, 12)) {
        const files = commit.filesChanged?.slice(0, 8).join(', ') || 'unknown files';
        sections.push(`- ${commit.message} [${files}]`);
      }
    }

    if (session.terminalErrors.length > 0) {
      sections.push('\nFailures / terminal errors:');
      for (const error of session.terminalErrors.slice(0, 8)) {
        sections.push(`- [${error.errorType}] ${error.message}`);
      }
    }

    if (workspaceRoot) {
      const gitDiff = await this.collectGitDiff(workspaceRoot, session.startTime, session.endTime);
      if (gitDiff) {
        sections.push('\nCode diffs:\n' + gitDiff);
      }

      const isCurrentSession = !session.endTime;
      if (isCurrentSession && (!gitDiff || gitDiff.length < 400)) {
        const snippets = await this.collectFileSnippets(session, workspaceRoot);
        if (snippets) {
          sections.push('\nFile contents (current versions of edited files):\n' + snippets);
        }
      }
    }

    const digest = sections.join('\n').trim();
    if (digest.length <= MAX_DIGEST_CHARS) {
      return digest;
    }

    return digest.slice(0, MAX_DIGEST_CHARS) + '\n...[truncated]';
  }

  private async collectGitDiff(workspaceRoot: string, since: Date, until?: Date): Promise<string> {
    const sinceIso = since.toISOString();
    const untilFlag = until ? ` --until="${until.toISOString()}"` : '';
    const commands = until
      ? [`git log --since="${sinceIso}"${untilFlag} --max-count=8 --pretty=format:"COMMIT %s" --unified=1 -p`]
      : [
          'git status --short',
          'git diff --stat',
          'git diff --unified=2',
          'git diff --cached --unified=2',
          `git log --since="${sinceIso}" --max-count=8 --pretty=format:"COMMIT %s" --unified=1 -p`
        ];

    const chunks: string[] = [];
    for (const command of commands) {
      const output = await this.runGit(command, workspaceRoot);
      if (output) {
        chunks.push(this.sanitizeDiff(output));
      }
    }

    return chunks.join('\n\n').trim();
  }

  private async runGit(command: string, cwd: string): Promise<string> {
    try {
      const { stdout } = await exec(command, {
        cwd,
        timeout: 8_000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true
      });
      return stdout?.trim() || '';
    } catch {
      return '';
    }
  }

  private async collectFileSnippets(session: SessionData, workspaceRoot: string): Promise<string> {
    const snippets: string[] = [];
    const files = session.editedFiles
      .filter(file => file.changeType !== 'deleted')
      .slice(0, 8);

    for (const file of files) {
      if (SENSITIVE_PATH.test(file.filePath) || SKIP_PATH.test(file.filePath)) {
        continue;
      }

      try {
        const absolutePath = path.isAbsolute(file.filePath)
          ? file.filePath
          : path.join(workspaceRoot, file.filePath);
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
        const text = Buffer.from(bytes).toString('utf8');
        if (!text.trim()) {
          continue;
        }
        const excerpt = text.length > 3500 ? `${text.slice(0, 3500)}\n...[truncated]` : text;
        snippets.push(`--- ${file.filePath} ---\n${excerpt}`);
      } catch {
        // File may have been deleted or is unreadable
      }
    }

    return snippets.join('\n\n');
  }

  private sanitizeDiff(diff: string): string {
    const lines = diff.split('\n');
    const kept: string[] = [];
    let skippingFile = false;

    for (const line of lines) {
      if (line.startsWith('diff --git') || line.startsWith('+++ ') || line.startsWith('--- ')) {
        skippingFile = SENSITIVE_PATH.test(line) || SKIP_PATH.test(line);
      }
      if (!skippingFile) {
        kept.push(line);
      }
    }

    return kept.join('\n');
  }
}
