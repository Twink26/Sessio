import { ConfigurationHelper } from '../utils/ConfigurationHelper';
import { ConfigurationService } from '../services/ConfigurationService';
import { ExtensionConfig } from '../interfaces/IConfigurationService';

// Mock the ConfigurationService
jest.mock('../services/ConfigurationService');

describe('ConfigurationHelper', () => {
  let configHelper: ConfigurationHelper;
  let mockConfigService: jest.Mocked<ConfigurationService>;
  let mockConfig: ExtensionConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      maxCommitsToShow: 10,
      enableAISummary: true,
      aiProvider: 'openai',
      openaiApiKey: 'test-key',
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-4o-mini',
      aiMaxTokens: 150,
      aiTemperature: 0.7,
      enableTeamDashboard: false,
      privacySettings: {
        shareWithTeam: false,
        excludeFilePatterns: ['*.log', 'node_modules/**'],
        excludeCommitPatterns: ['WIP:', 'temp:']
      }
    };

    mockConfigService = {
      getConfiguration: jest.fn().mockReturnValue(mockConfig),
      onConfigurationChanged: jest.fn(),
      updateConfiguration: jest.fn(),
      validateConfiguration: jest.fn(),
      dispose: jest.fn()
    } as any;

    (ConfigurationService as jest.MockedClass<typeof ConfigurationService>).mockImplementation(() => mockConfigService);

    // Reset singleton instance
    (ConfigurationHelper as any).instance = undefined;
    configHelper = ConfigurationHelper.getInstance();
  });

  afterEach(() => {
    configHelper.dispose();
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigurationHelper.getInstance();
      const instance2 = ConfigurationHelper.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('configuration access methods', () => {
    it('should return current configuration', () => {
      expect(configHelper.getConfig()).toEqual(mockConfig);
    });

    it('should check if extension is enabled', () => {
      expect(configHelper.isEnabled()).toBe(true);
      
      mockConfig.enabled = false;
      expect(configHelper.isEnabled()).toBe(false);
    });

    it('should check if AI summary is enabled', () => {
      expect(configHelper.isAISummaryEnabled()).toBe(true);
      
      mockConfig.enableAISummary = false;
      expect(configHelper.isAISummaryEnabled()).toBe(false);
      
      mockConfig.enableAISummary = true;
      mockConfig.aiProvider = 'disabled';
      expect(configHelper.isAISummaryEnabled()).toBe(false);
    });

    it('should check if team dashboard is enabled', () => {
      expect(configHelper.isTeamDashboardEnabled()).toBe(false);
      
      mockConfig.enableTeamDashboard = true;
      expect(configHelper.isTeamDashboardEnabled()).toBe(true);
    });

    it('should get max commits to show', () => {
      expect(configHelper.getMaxCommitsToShow()).toBe(10);
    });

    it('should get AI provider', () => {
      expect(configHelper.getAIProvider()).toBe('openai');
    });

    it('should get OpenAI API key when provider is openai', () => {
      expect(configHelper.getOpenAIApiKey()).toBe('test-key');
      
      mockConfig.aiProvider = 'local';
      expect(configHelper.getOpenAIApiKey()).toBeNull();
      
      mockConfig.aiProvider = 'openai';
      mockConfig.openaiApiKey = '';
      expect(configHelper.getOpenAIApiKey()).toBeNull();
    });

    it('should get AI parameters', () => {
      const params = configHelper.getAIParameters();
      expect(params).toEqual({
        maxTokens: 150,
        temperature: 0.7
      });
    });

    it('should check if should share with team', () => {
      expect(configHelper.shouldShareWithTeam()).toBe(false);
      
      mockConfig.privacySettings.shareWithTeam = true;
      expect(configHelper.shouldShareWithTeam()).toBe(true);
    });

    it('should get exclude file patterns', () => {
      expect(configHelper.getExcludeFilePatterns()).toEqual(['*.log', 'node_modules/**']);
    });

    it('should get exclude commit patterns', () => {
      expect(configHelper.getExcludeCommitPatterns()).toEqual(['WIP:', 'temp:']);
    });
  });

  describe('file exclusion logic', () => {
    it('should exclude files based on patterns', () => {
      expect(configHelper.shouldExcludeFile('error.log')).toBe(true);
      expect(configHelper.shouldExcludeFile('node_modules/package/index.js')).toBe(true);
      expect(configHelper.shouldExcludeFile('src/main.ts')).toBe(false);
    });

    it('should handle complex glob patterns', () => {
      mockConfig.privacySettings.excludeFilePatterns = ['*.test.js', 'build/**', 'temp?'];
      
      expect(configHelper.shouldExcludeFile('component.test.js')).toBe(true);
      expect(configHelper.shouldExcludeFile('build/output/main.js')).toBe(true);
      expect(configHelper.shouldExcludeFile('temp1')).toBe(true);
      expect(configHelper.shouldExcludeFile('temp12')).toBe(false);
      expect(configHelper.shouldExcludeFile('src/component.js')).toBe(false);
    });
  });

  describe('commit exclusion logic', () => {
    it('should exclude commits based on patterns', () => {
      expect(configHelper.shouldExcludeCommit('WIP: working on feature')).toBe(true);
      expect(configHelper.shouldExcludeCommit('temp: testing changes')).toBe(true);
      expect(configHelper.shouldExcludeCommit('feat: add new component')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(configHelper.shouldExcludeCommit('wip: working on feature')).toBe(true);
      expect(configHelper.shouldExcludeCommit('TEMP: testing changes')).toBe(true);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', async () => {
      await configHelper.updateConfiguration('enabled', false);
      expect(mockConfigService.updateConfiguration).toHaveBeenCalledWith('enabled', false);
    });

    it('should validate configuration', () => {
      const partialConfig = { maxCommitsToShow: 5 };
      const mockResult = { isValid: true, errors: [] };
      mockConfigService.validateConfiguration.mockReturnValue(mockResult);

      const result = configHelper.validateConfiguration(partialConfig);
      expect(mockConfigService.validateConfiguration).toHaveBeenCalledWith(partialConfig);
      expect(result).toBe(mockResult);
    });
  });

  describe('configuration change handling', () => {
    it('should register for configuration changes', () => {
      expect(mockConfigService.onConfigurationChanged).toHaveBeenCalled();
    });

    it('should update current config when configuration changes', () => {
      const changeCallback = mockConfigService.onConfigurationChanged.mock.calls[0][0];
      const newConfig = { ...mockConfig, enabled: false };
      
      changeCallback(newConfig);
      
      expect(configHelper.getConfig()).toEqual(newConfig);
      expect(configHelper.isEnabled()).toBe(false);
    });
  });

  describe('disposal', () => {
    it('should dispose configuration service', () => {
      configHelper.dispose();
      expect(mockConfigService.dispose).toHaveBeenCalled();
    });
  });
});