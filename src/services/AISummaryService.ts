import * as vscode from 'vscode';
import { SessionData } from '../models/SessionData';
import { IAISummaryService, AIProvider, AISummaryConfig } from '../interfaces/IAISummaryService';

// Declare fetch for Node.js environment
declare const fetch: any;

/**
 * Service for generating AI-powered summaries of coding sessions
 */
export class AISummaryService implements IAISummaryService {
  private config: AISummaryConfig;
  private summariesEnabled: boolean;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.config = this.loadConfigFromSettings();
    this.summariesEnabled = this.loadSummariesEnabled();
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('sessionRecap')) {
        this.config = this.loadConfigFromSettings();
        this.summariesEnabled = this.loadSummariesEnabled();
      }
    });
  }

  /**
   * Generate a natural language summary from session data
   */
  async generateSummary(sessionData: SessionData): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('AI summary service is not available or disabled');
    }

    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.generateOpenAISummary(sessionData);
        case 'local':
          return await this.generateLocalSummary(sessionData);
        case 'disabled':
        default:
          throw new Error('AI summary service is disabled');
      }
    } catch (error) {
      const errorMessage = `AI Summary Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.outputChannel.appendLine(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Generate an AI summary when possible, otherwise a rule-based fallback.
   */
  async generateSummaryOrFallback(sessionData: SessionData): Promise<string> {
    if (this.isAvailable()) {
      try {
        return await this.generateSummary(sessionData);
      } catch (error) {
        this.outputChannel.appendLine(
          `Falling back to local summary: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return this.generateFallbackSummary(sessionData);
  }

  /**
   * Check if the AI service is available and configured
   */
  isAvailable(): boolean {
    if (!this.summariesEnabled || this.config.provider === 'disabled') {
      return false;
    }

    if (this.config.provider === 'openai') {
      return !!this.config.apiKey?.trim();
    }

    if (this.config.provider === 'local') {
      return true;
    }

    return false;
  }

  /**
   * Update the AI service configuration
   */
  updateConfig(config: AISummaryConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current AI provider being used
   */
  getCurrentProvider(): AIProvider {
    return this.config.provider;
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfigFromSettings(): AISummaryConfig {
    const config = vscode.workspace.getConfiguration('sessionRecap');
    
    return {
      provider: config.get<AIProvider>('aiProvider', 'local'),
      apiKey: config.get<string>('openaiApiKey'),
      maxTokens: config.get<number>('aiMaxTokens', 800),
      temperature: config.get<number>('aiTemperature', 0.4),
      baseUrl: config.get<string>('aiBaseUrl', 'https://api.openai.com/v1'),
      model: config.get<string>('aiModel', 'gpt-4o-mini')
    };
  }

  private loadSummariesEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('sessionRecap');
    return config.get<boolean>('enableAISummary', true);
  }

  /**
   * Generate summary using OpenAI API
   */
  private async generateOpenAISummary(sessionData: SessionData): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const fetchFn = (globalThis as { fetch?: typeof fetch }).fetch;
    if (!fetchFn) {
      throw new Error('Fetch API is not available in this environment');
    }

    const prompt = this.buildPrompt(sessionData);
    const controller = new AbortController();
    const timeoutMs = 25_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const endpoint = this.getCompletionsUrl();
    const model = this.config.model?.trim() || 'gpt-4o-mini';

    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://github.com/Twink26/Sessio',
          'X-Title': 'Sessio Session Recap'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: [
                'You write a detailed recap of a developer coding session.',
                'Use only the evidence provided (files, diffs, commits, errors, notes).',
                'Do not invent features that are not in the evidence.',
                'Write in this structure with short bullet points:',
                '## What you worked on',
                '## Features added or attempted',
                '## Code you wrote or changed',
                '## What failed or is still broken',
                '## Suggested next steps',
                'Name concrete files, functions, and user-visible behavior whenever possible.'
              ].join('\n')
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens ?? 900,
          temperature: this.config.temperature ?? 0.4
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let details = '';
        try {
          details = (await response.text()).slice(0, 300);
        } catch {
          details = '';
        }
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutMessage = `OpenAI API request timed out after ${timeoutMs / 1000} seconds`;
        this.outputChannel.appendLine(timeoutMessage);
        throw new Error(`Failed to generate OpenAI summary: ${timeoutMessage}`);
      }

      const errorMessage = `OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.outputChannel.appendLine(errorMessage);
      throw new Error(`Failed to generate OpenAI summary: ${errorMessage}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate summary using local AI (placeholder implementation)
   */
  private async generateLocalSummary(sessionData: SessionData): Promise<string> {
    // This is a placeholder for local AI implementation
    // In a real implementation, this would interface with a local model
    
    return this.generateFallbackSummary(sessionData);
  }

  /**
   * Generate a rule-based fallback summary when AI is unavailable
   */
  generateFallbackSummary(sessionData: SessionData): string {
    const parts: string[] = [];

    // Files summary
    if (sessionData.editedFiles.length > 0) {
      const fileNames = sessionData.editedFiles.slice(0, 3).map(file => this.getFileName(file.filePath));
      if (sessionData.editedFiles.length === 1) {
        parts.push(`modified ${fileNames[0]}`);
      } else if (sessionData.editedFiles.length <= 3) {
        parts.push(`modified ${fileNames.join(', ')}`);
      } else {
        parts.push(`modified ${sessionData.editedFiles.length} files including ${fileNames.join(', ')}`);
      }
    }

    // Git commits summary
    if (sessionData.gitCommits.length > 0) {
      const commitCount = sessionData.gitCommits.length;
      const commitWord = commitCount === 1 ? 'commit' : 'commits';
      parts.push(`made ${commitCount} ${commitWord}`);
    }

    // Terminal errors summary
    if (sessionData.terminalErrors.length > 0) {
      parts.push('encountered terminal errors');
    }

    if (parts.length === 0) {
      return 'No significant activity detected in the last session.';
    }

    return `In your last session, you ${parts.join(', ')}. Set sessionRecap.aiProvider to openai and add an API key for a detailed recap of features, code changes, and failures.`;
  }

  /**
   * Build a prompt for AI summary generation
   */
  private buildPrompt(sessionData: SessionData): string {
    const prompt = [
      'Write a detailed recap of this coding session so the developer can pick up tomorrow.',
      'Cover features they added or tried to add, what they actually wrote, and what failed.'
    ];

    if (sessionData.notes) {
      prompt.push(`\nDeveloper notes:\n${sessionData.notes}`);
    }

    if (sessionData.changeDigest) {
      prompt.push(`\nSession evidence (diffs, files, commits, errors):\n${sessionData.changeDigest}`);
    } else {
      if (sessionData.editedFiles.length > 0) {
        prompt.push(`\nFiles modified (${sessionData.editedFiles.length}):`);
        sessionData.editedFiles.slice(0, 25).forEach(file => {
          prompt.push(`- ${file.filePath} (${file.changeType}${file.lineCount ? `, ${file.lineCount} lines` : ''})`);
        });
      }

      if (sessionData.gitCommits.length > 0) {
        prompt.push(`\nGit commits (${sessionData.gitCommits.length}):`);
        sessionData.gitCommits.slice(0, 12).forEach(commit => {
          prompt.push(`- ${commit.message} [${(commit.filesChanged || []).slice(0, 8).join(', ')}]`);
        });
      }

      if (sessionData.terminalErrors.length > 0) {
        prompt.push(`\nTerminal errors:`);
        sessionData.terminalErrors.slice(0, 8).forEach(error => {
          prompt.push(`- [${error.errorType}] ${error.message}`);
        });
      }
    }

    prompt.push('\nIf evidence is thin, say what is known and what cannot be inferred.');
    return prompt.join('\n');
  }

  private getCompletionsUrl(): string {
    const base = (this.config.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(base)) {
      return base;
    }
    return `${base}/chat/completions`;
  }

  private getFileName(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    return segments[segments.length - 1] || filePath;
  }
}

