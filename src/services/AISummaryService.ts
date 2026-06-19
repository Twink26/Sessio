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
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.config = this.loadConfigFromSettings();
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
   * Check if the AI service is available and configured
   */
  isAvailable(): boolean {
    if (this.config.provider === 'disabled') {
      return false;
    }

    if (this.config.provider === 'openai') {
      return !!this.config.apiKey;
    }

    if (this.config.provider === 'local') {
      // For local provider, we assume it's always available
      // In a real implementation, this might check for local model availability
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
      provider: config.get<AIProvider>('aiProvider', 'disabled'),
      apiKey: config.get<string>('openaiApiKey'),
      maxTokens: config.get<number>('aiMaxTokens', 150),
      temperature: config.get<number>('aiTemperature', 0.7)
    };
  }

  /**
   * Generate summary using OpenAI API
   */
  private async generateOpenAISummary(sessionData: SessionData): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.buildPrompt(sessionData);
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes coding sessions for developers. Keep summaries concise (2-3 sentences) and focus on what was accomplished.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      const errorMessage = `OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.outputChannel.appendLine(errorMessage);
      throw new Error(`Failed to generate OpenAI summary: ${errorMessage}`);
    }
  }

  /**
   * Generate summary using local AI (placeholder implementation)
   */
  private async generateLocalSummary(sessionData: SessionData): Promise<string> {
    // This is a placeholder for local AI implementation
    // In a real implementation, this would interface with a local model
    
    const summary = this.generateFallbackSummary(sessionData);
    return `[Local AI] ${summary}`;
  }

  /**
   * Generate a rule-based fallback summary when AI is unavailable
   */
  generateFallbackSummary(sessionData: SessionData): string {
    const parts: string[] = [];

    // Files summary
    if (sessionData.editedFiles.length > 0) {
      const fileCount = sessionData.editedFiles.length;
      const fileWord = fileCount === 1 ? 'file' : 'files';
      parts.push(`Modified ${fileCount} ${fileWord}`);
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

    return `In your last session, you ${parts.join(', ')}.`;
  }

  /**
   * Build a prompt for AI summary generation
   */
  private buildPrompt(sessionData: SessionData): string {
    const prompt = ['Please summarize this coding session:'];

    // Add file changes
    if (sessionData.editedFiles.length > 0) {
      prompt.push(`\nFiles modified (${sessionData.editedFiles.length}):`);
      sessionData.editedFiles.slice(0, 10).forEach(file => {
        prompt.push(`- ${file.filePath} (${file.changeType})`);
      });
      if (sessionData.editedFiles.length > 10) {
        prompt.push(`... and ${sessionData.editedFiles.length - 10} more files`);
      }
    }

    // Add Git commits
    if (sessionData.gitCommits.length > 0) {
      prompt.push(`\nGit commits (${sessionData.gitCommits.length}):`);
      sessionData.gitCommits.slice(0, 5).forEach(commit => {
        prompt.push(`- ${commit.message}`);
      });
      if (sessionData.gitCommits.length > 5) {
        prompt.push(`... and ${sessionData.gitCommits.length - 5} more commits`);
      }
    }

    // Add terminal errors
    if (sessionData.terminalErrors.length > 0) {
      prompt.push(`\nTerminal errors encountered:`);
      sessionData.terminalErrors.slice(0, 3).forEach(error => {
        prompt.push(`- ${error.message}`);
      });
    }

    prompt.push('\nProvide a concise 2-3 sentence summary focusing on what was accomplished.');

    return prompt.join('\n');
  }
}

