import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { IGitActivityMonitor } from '../interfaces/IGitActivityMonitor';
import { GitCommit } from '../models/GitCommit';
import { PerformanceMonitor } from './PerformanceMonitor';

const exec = promisify(cp.exec);

/**
 * Monitors Git repository activity using child process git commands
 * Optimized with caching and performance monitoring
 */
export class GitActivityMonitor implements IGitActivityMonitor {
  private workspaceRoot: string | undefined;
  private performanceMonitor: PerformanceMonitor;
  
  // Caching for performance optimization
  private isGitRepoCache: boolean | undefined;
  private currentBranchCache: { value: string | null; timestamp: number } | undefined;
  private commitsCache: Map<string, { commits: GitCommit[]; timestamp: number }> = new Map();
  private readonly cacheTimeout = 30000; // 30 seconds cache timeout
  private readonly maxCacheEntries = 10; // Limit cache size

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  /**
   * Check if the current workspace is a Git repository (cached)
   */
  isGitRepository(): boolean {
    const timer = this.performanceMonitor.startTimer('GitActivityMonitor.isGitRepository');
    
    if (!this.workspaceRoot) {
      timer.end();
      return false;
    }

    // Use cached result if available
    if (this.isGitRepoCache !== undefined) {
      timer.end();
      return this.isGitRepoCache;
    }

    try {
      // Check if .git directory exists
      const gitPath = path.join(this.workspaceRoot, '.git');
      this.isGitRepoCache = fs.existsSync(gitPath);
      timer.end();
      return this.isGitRepoCache;
    } catch (error) {
      this.isGitRepoCache = false;
      timer.end();
      return false;
    }
  }

  /**
   * Get the current Git branch name (cached)
   */
  async getCurrentBranch(): Promise<string | null> {
    const timer = this.performanceMonitor.startTimer('GitActivityMonitor.getCurrentBranch');
    
    if (!this.isGitRepository() || !this.workspaceRoot) {
      timer.end();
      return null;
    }

    // Check cache
    const now = Date.now();
    if (this.currentBranchCache && (now - this.currentBranchCache.timestamp) < this.cacheTimeout) {
      timer.end();
      return this.currentBranchCache.value;
    }

    try {
      const { stdout } = await exec('git rev-parse --abbrev-ref HEAD', {
        cwd: this.workspaceRoot,
        timeout: 5000
      });
      
      const branchName = stdout?.trim() || null;
      
      // Cache the result
      this.currentBranchCache = {
        value: branchName,
        timestamp: now
      };
      
      timer.end();
      return branchName;
    } catch (error) {
      console.error('Failed to get current Git branch:', error);
      
      // Cache the null result to avoid repeated failures
      this.currentBranchCache = {
        value: null,
        timestamp: now
      };
      
      timer.end();
      return null;
    }
  }

  /**
   * Get commits made since the specified timestamp (cached)
   */
  async getCommitsSince(timestamp: Date): Promise<GitCommit[]> {
    const timer = this.performanceMonitor.startTimer('GitActivityMonitor.getCommitsSince');
    
    if (!this.isGitRepository() || !this.workspaceRoot) {
      timer.end();
      return [];
    }

    // Create cache key based on timestamp
    const cacheKey = timestamp.toISOString();
    const now = Date.now();
    
    // Check cache
    const cachedResult = this.commitsCache.get(cacheKey);
    if (cachedResult && (now - cachedResult.timestamp) < this.cacheTimeout) {
      timer.end();
      return [...cachedResult.commits]; // Return copy to prevent modification
    }

    try {
      // Format timestamp for git log --since parameter
      const sinceDate = timestamp.toISOString();
      
      // Get commits with detailed information
      const gitLogCommand = `git log --since="${sinceDate}" --pretty=format:"%H|%s|%an|%ai" --name-only --max-count=20`;
      
      const { stdout } = await exec(gitLogCommand, {
        cwd: this.workspaceRoot,
        timeout: 10000
      });

      let commits: GitCommit[] = [];
      if (stdout?.trim()) {
        commits = this.parseGitLogOutput(stdout);
      }

      // Cache the result
      this.cacheCommits(cacheKey, commits, now);
      
      timer.end();
      return commits;
    } catch (error) {
      console.error('Failed to get Git commits:', error);
      
      // Cache empty result to avoid repeated failures
      this.cacheCommits(cacheKey, [], now);
      
      timer.end();
      return [];
    }
  }

  /**
   * Cache commits with memory management
   */
  private cacheCommits(cacheKey: string, commits: GitCommit[], timestamp: number): void {
    // Remove oldest entries if cache is full
    if (this.commitsCache.size >= this.maxCacheEntries) {
      const oldestKey = this.commitsCache.keys().next().value;
      if (oldestKey) {
        this.commitsCache.delete(oldestKey);
      }
    }

    this.commitsCache.set(cacheKey, {
      commits: [...commits], // Store copy to prevent modification
      timestamp
    });
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    
    // Clear expired branch cache
    if (this.currentBranchCache && (now - this.currentBranchCache.timestamp) > this.cacheTimeout) {
      this.currentBranchCache = undefined;
    }

    // Clear expired commits cache
    for (const [key, value] of this.commitsCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.commitsCache.delete(key);
      }
    }
  }

  /**
   * Parse git log output into GitCommit objects (optimized)
   */
  private parseGitLogOutput(output: string): GitCommit[] {
    const timer = this.performanceMonitor.startTimer('GitActivityMonitor.parseGitLogOutput');
    
    const commits: GitCommit[] = [];
    const commitBlocks = output.split('\n\n').filter(block => block.trim());

    for (const block of commitBlocks) {
      try {
        const lines = block.split('\n');
        const commitInfo = lines[0];
        
        if (!commitInfo || !commitInfo.includes('|')) {
          continue;
        }

        const parts = commitInfo.split('|');
        if (parts.length < 4) {
          continue;
        }

        const [hash, message, author, timestamp] = parts;
        
        if (!hash || !message || !author || !timestamp) {
          continue;
        }

        // Get files changed (remaining lines after the commit info)
        const filesChanged = lines.slice(1)
          .filter(line => line.trim() && !line.includes('|'))
          .map(line => line.trim())
          .slice(0, 50); // Limit files per commit to prevent memory issues

        const commit: GitCommit = {
          hash: hash.trim(),
          message: message.trim(),
          author: author.trim(),
          timestamp: new Date(timestamp.trim()),
          filesChanged
        };

        commits.push(commit);
      } catch (error) {
        console.error('Failed to parse commit block:', error);
        continue;
      }
    }

    // Sort commits by timestamp (newest first) and limit to 10
    const result = commits
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
    
    timer.end();
    return result;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.isGitRepoCache = undefined;
    this.currentBranchCache = undefined;
    this.commitsCache.clear();
  }

  /**
   * Dispose of resources and clear caches
   */
  dispose(): void {
    const timer = this.performanceMonitor.startTimer('GitActivityMonitor.dispose');
    
    this.clearCache();
    
    timer.end();
  }
}