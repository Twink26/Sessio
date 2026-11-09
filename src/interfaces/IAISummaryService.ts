import { SessionData } from '../models/SessionData';

/**
 * AI provider types supported by the extension
 */
export type AIProvider = 'openai' | 'local' | 'disabled';

/**
 * Configuration for AI summary service
 */
export interface AISummaryConfig {
  provider: AIProvider;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
  model?: string;
}

/**
 * Interface for AI summary service
 */
export interface IAISummaryService {
  /**
   * Generate a natural language summary from session data
   * @param sessionData The session data to summarize
   * @returns Promise resolving to the generated summary
   */
  generateSummary(sessionData: SessionData): Promise<string>;

  /**
   * Generate an AI summary when configured, otherwise a rule-based fallback
   */
  generateSummaryOrFallback(sessionData: SessionData): Promise<string>;

  /**
   * Check if the AI service is available and configured
   * @returns True if the service can generate summaries
   */
  isAvailable(): boolean;

  /**
   * Update the AI service configuration
   * @param config New configuration settings
   */
  updateConfig(config: AISummaryConfig): void;

  /**
   * Get the current AI provider being used
   * @returns The current AI provider
   */
  getCurrentProvider(): AIProvider;
}