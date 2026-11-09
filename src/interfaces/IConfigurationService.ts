export interface IConfigurationService {
  getConfiguration(): ExtensionConfig;
  updateConfiguration(key: string, value: any): Promise<void>;
  onConfigurationChanged(callback: (config: ExtensionConfig) => void): void;
  validateConfiguration(config: Partial<ExtensionConfig>): ValidationResult;
}

export interface ExtensionConfig {
  enabled: boolean;
  maxCommitsToShow: number;
  enableAISummary: boolean;
  aiProvider: 'openai' | 'local' | 'disabled';
  openaiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  aiMaxTokens: number;
  aiTemperature: number;
  enableTeamDashboard: boolean;
  privacySettings: {
    shareWithTeam: boolean;
    excludeFilePatterns: string[];
    excludeCommitPatterns: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ConfigurationDefaults {
  enabled: boolean;
  maxCommitsToShow: number;
  enableAISummary: boolean;
  aiProvider: 'openai' | 'local' | 'disabled';
  openaiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  aiMaxTokens: number;
  aiTemperature: number;
  enableTeamDashboard: boolean;
  privacySettings: {
    shareWithTeam: boolean;
    excludeFilePatterns: string[];
    excludeCommitPatterns: string[];
  };
}