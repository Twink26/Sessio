import * as vscode from 'vscode';
import { IConfigurationService, ExtensionConfig, ValidationResult, ConfigurationDefaults } from '../interfaces/IConfigurationService';

export class ConfigurationService implements IConfigurationService {
  private static readonly CONFIGURATION_SECTION = 'sessionRecap';
  private configurationChangeEmitter = new vscode.EventEmitter<ExtensionConfig>();
  private disposables: vscode.Disposable[] = [];

  private readonly defaults: ConfigurationDefaults = {
    enabled: true,
    maxCommitsToShow: 10,
    enableAISummary: true,
    aiProvider: 'disabled',
    openaiApiKey: '',
    aiMaxTokens: 150,
    aiTemperature: 0.7,
    enableTeamDashboard: false,
    privacySettings: {
      shareWithTeam: false,
      excludeFilePatterns: ['*.log', 'node_modules/**', '.git/**'],
      excludeCommitPatterns: ['WIP:', 'temp:', 'debug:']
    }
  };

  constructor() {
    // Listen for configuration changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ConfigurationService.CONFIGURATION_SECTION)) {
        const config = this.getConfiguration();
        this.configurationChangeEmitter.fire(config);
      }
    });
    
    this.disposables.push(configChangeDisposable);
  }

  getConfiguration(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIGURATION_SECTION);
    
    return {
      enabled: config.get<boolean>('enabled', this.defaults.enabled),
      maxCommitsToShow: config.get<number>('maxCommitsToShow', this.defaults.maxCommitsToShow),
      enableAISummary: config.get<boolean>('enableAISummary', this.defaults.enableAISummary),
      aiProvider: config.get<'openai' | 'local' | 'disabled'>('aiProvider', this.defaults.aiProvider),
      openaiApiKey: config.get<string>('openaiApiKey', this.defaults.openaiApiKey),
      aiMaxTokens: config.get<number>('aiMaxTokens', this.defaults.aiMaxTokens),
      aiTemperature: config.get<number>('aiTemperature', this.defaults.aiTemperature),
      enableTeamDashboard: config.get<boolean>('enableTeamDashboard', this.defaults.enableTeamDashboard),
      privacySettings: {
        shareWithTeam: config.get<boolean>('privacySettings.shareWithTeam', this.defaults.privacySettings.shareWithTeam),
        excludeFilePatterns: config.get<string[]>('privacySettings.excludeFilePatterns', this.defaults.privacySettings.excludeFilePatterns),
        excludeCommitPatterns: config.get<string[]>('privacySettings.excludeCommitPatterns', this.defaults.privacySettings.excludeCommitPatterns)
      }
    };
  }

  async updateConfiguration(key: string, value: any): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIGURATION_SECTION);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  onConfigurationChanged(callback: (config: ExtensionConfig) => void): void {
    this.configurationChangeEmitter.event(callback);
  }

  validateConfiguration(config: Partial<ExtensionConfig>): ValidationResult {
    const errors: string[] = [];

    // Validate maxCommitsToShow
    if (config.maxCommitsToShow !== undefined) {
      if (!Number.isInteger(config.maxCommitsToShow) || config.maxCommitsToShow < 1 || config.maxCommitsToShow > 50) {
        errors.push('maxCommitsToShow must be an integer between 1 and 50');
      }
    }

    // Validate aiProvider
    if (config.aiProvider !== undefined) {
      const validProviders = ['openai', 'local', 'disabled'];
      if (!validProviders.includes(config.aiProvider)) {
        errors.push(`aiProvider must be one of: ${validProviders.join(', ')}`);
      }
    }

    // Validate aiMaxTokens
    if (config.aiMaxTokens !== undefined) {
      if (!Number.isInteger(config.aiMaxTokens) || config.aiMaxTokens < 50 || config.aiMaxTokens > 1000) {
        errors.push('aiMaxTokens must be an integer between 50 and 1000');
      }
    }

    // Validate aiTemperature
    if (config.aiTemperature !== undefined) {
      if (typeof config.aiTemperature !== 'number' || config.aiTemperature < 0 || config.aiTemperature > 2) {
        errors.push('aiTemperature must be a number between 0 and 2');
      }
    }

    // Validate openaiApiKey when aiProvider is openai
    if (config.aiProvider === 'openai' && config.openaiApiKey !== undefined) {
      if (typeof config.openaiApiKey !== 'string' || config.openaiApiKey.trim().length === 0) {
        errors.push('openaiApiKey is required when aiProvider is set to openai');
      }
    }

    // Validate excludeFilePatterns
    if (config.privacySettings?.excludeFilePatterns !== undefined) {
      if (!Array.isArray(config.privacySettings.excludeFilePatterns)) {
        errors.push('excludeFilePatterns must be an array of strings');
      } else {
        const invalidPatterns = config.privacySettings.excludeFilePatterns.filter(
          pattern => typeof pattern !== 'string' || pattern.trim().length === 0
        );
        if (invalidPatterns.length > 0) {
          errors.push('All excludeFilePatterns must be non-empty strings');
        }
      }
    }

    // Validate excludeCommitPatterns
    if (config.privacySettings?.excludeCommitPatterns !== undefined) {
      if (!Array.isArray(config.privacySettings.excludeCommitPatterns)) {
        errors.push('excludeCommitPatterns must be an array of strings');
      } else {
        const invalidPatterns = config.privacySettings.excludeCommitPatterns.filter(
          pattern => typeof pattern !== 'string' || pattern.trim().length === 0
        );
        if (invalidPatterns.length > 0) {
          errors.push('All excludeCommitPatterns must be non-empty strings');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.configurationChangeEmitter.dispose();
  }
}