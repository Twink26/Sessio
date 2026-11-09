import * as vscode from 'vscode';
import { ConfigurationService } from '../services/ConfigurationService';
import { ExtensionConfig } from '../interfaces/IConfigurationService';

// Mock VS Code API
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    onDidChangeConfiguration: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn()
  }))
}));

describe('ConfigurationService', () => {
  let configurationService: ConfigurationService;
  let mockConfiguration: any;
  let mockOnDidChangeConfiguration: jest.Mock;

  beforeEach(() => {
    mockConfiguration = {
      get: jest.fn(),
      update: jest.fn()
    };

    mockOnDidChangeConfiguration = jest.fn().mockReturnValue({
      dispose: jest.fn()
    });

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfiguration);
    (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockImplementation(mockOnDidChangeConfiguration);

    configurationService = new ConfigurationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    configurationService.dispose();
  });

  describe('getConfiguration', () => {
    it('should return configuration with default values when no settings are configured', () => {
      mockConfiguration.get.mockImplementation((key: string, defaultValue: any) => defaultValue);

      const config = configurationService.getConfiguration();

      expect(config).toEqual({
        enabled: true,
        maxCommitsToShow: 10,
        enableAISummary: true,
        aiProvider: 'local',
        openaiApiKey: '',
        aiBaseUrl: 'https://api.openai.com/v1',
        aiModel: 'gpt-4o-mini',
        aiMaxTokens: 900,
        aiTemperature: 0.4,
        enableTeamDashboard: false,
        privacySettings: {
          shareWithTeam: false,
          excludeFilePatterns: ['*.log', 'node_modules/**', '.git/**'],
          excludeCommitPatterns: ['WIP:', 'temp:', 'debug:']
        }
      });
    });

    it('should return configuration with custom values when settings are configured', () => {
      const customConfig = {
        enabled: false,
        maxCommitsToShow: 5,
        enableAISummary: false,
        aiProvider: 'openai',
        openaiApiKey: 'test-key',
        aiMaxTokens: 200,
        aiTemperature: 0.5,
        enableTeamDashboard: true,
        'privacySettings.shareWithTeam': true,
        'privacySettings.excludeFilePatterns': ['*.tmp'],
        'privacySettings.excludeCommitPatterns': ['test:']
      };

      mockConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        return customConfig[key as keyof typeof customConfig] ?? defaultValue;
      });

      const config = configurationService.getConfiguration();

      expect(config.enabled).toBe(false);
      expect(config.maxCommitsToShow).toBe(5);
      expect(config.aiProvider).toBe('openai');
      expect(config.privacySettings.shareWithTeam).toBe(true);
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration using VS Code API', async () => {
      mockConfiguration.update.mockResolvedValue(undefined);

      await configurationService.updateConfiguration('enabled', false);

      expect(mockConfiguration.update).toHaveBeenCalledWith('enabled', false, vscode.ConfigurationTarget.Global);
    });

    it('should handle update errors gracefully', async () => {
      const error = new Error('Update failed');
      mockConfiguration.update.mockRejectedValue(error);

      await expect(configurationService.updateConfiguration('enabled', false)).rejects.toThrow('Update failed');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate maxCommitsToShow correctly', () => {
      // Valid values
      expect(configurationService.validateConfiguration({ maxCommitsToShow: 1 }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ maxCommitsToShow: 25 }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ maxCommitsToShow: 50 }).isValid).toBe(true);

      // Invalid values
      expect(configurationService.validateConfiguration({ maxCommitsToShow: 0 }).isValid).toBe(false);
      expect(configurationService.validateConfiguration({ maxCommitsToShow: 51 }).isValid).toBe(false);
      expect(configurationService.validateConfiguration({ maxCommitsToShow: -1 }).isValid).toBe(false);
      expect(configurationService.validateConfiguration({ maxCommitsToShow: 1.5 }).isValid).toBe(false);
    });

    it('should validate aiProvider correctly', () => {
      // Valid values
      expect(configurationService.validateConfiguration({ aiProvider: 'openai' }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ aiProvider: 'local' }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ aiProvider: 'disabled' }).isValid).toBe(true);

      // Invalid values
      expect(configurationService.validateConfiguration({ aiProvider: 'invalid' as any }).isValid).toBe(false);
    });

    it('should validate aiMaxTokens correctly', () => {
      // Valid values
      expect(configurationService.validateConfiguration({ aiMaxTokens: 50 }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ aiMaxTokens: 500 }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ aiMaxTokens: 4000 }).isValid).toBe(true);

      // Invalid values
      expect(configurationService.validateConfiguration({ aiMaxTokens: 49 }).isValid).toBe(false);
      expect(configurationService.validateConfiguration({ aiMaxTokens: 4001 }).isValid).toBe(false);
      expect(configurationService.validateConfiguration({ aiMaxTokens: 100.5 }).isValid).toBe(false);
    });

    it('should validate aiTemperature correctly', () => {
      // Valid values
      expect(configurationService.validateConfiguration({ aiTemperature: 0 }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ aiTemperature: 1.0 }).isValid).toBe(true);
      expect(configurationService.validateConfiguration({ aiTemperature: 2.0 }).isValid).toBe(true);

      // Invalid values
      expect(configurationService.validateConfiguration({ aiTemperature: -0.1 }).isValid).toBe(false);
      expect(configurationService.validateConfiguration({ aiTemperature: 2.1 }).isValid).toBe(false);
    });

    it('should validate openaiApiKey when aiProvider is openai', () => {
      // Valid case
      expect(configurationService.validateConfiguration({ 
        aiProvider: 'openai', 
        openaiApiKey: 'valid-key' 
      }).isValid).toBe(true);

      // Invalid case - empty key
      expect(configurationService.validateConfiguration({ 
        aiProvider: 'openai', 
        openaiApiKey: '' 
      }).isValid).toBe(false);

      // Invalid case - whitespace only
      expect(configurationService.validateConfiguration({ 
        aiProvider: 'openai', 
        openaiApiKey: '   ' 
      }).isValid).toBe(false);
    });

    it('should validate excludeFilePatterns correctly', () => {
      // Valid values
      expect(configurationService.validateConfiguration({
        privacySettings: { 
          shareWithTeam: false,
          excludeFilePatterns: ['*.log', '*.tmp'],
          excludeCommitPatterns: []
        }
      }).isValid).toBe(true);

      // Invalid values - not an array
      expect(configurationService.validateConfiguration({
        privacySettings: { 
          shareWithTeam: false,
          excludeFilePatterns: 'not-array' as any,
          excludeCommitPatterns: []
        }
      }).isValid).toBe(false);

      // Invalid values - empty strings
      expect(configurationService.validateConfiguration({
        privacySettings: { 
          shareWithTeam: false,
          excludeFilePatterns: ['*.log', ''],
          excludeCommitPatterns: []
        }
      }).isValid).toBe(false);
    });

    it('should validate excludeCommitPatterns correctly', () => {
      // Valid values
      expect(configurationService.validateConfiguration({
        privacySettings: { 
          shareWithTeam: false,
          excludeFilePatterns: [],
          excludeCommitPatterns: ['WIP:', 'temp:']
        }
      }).isValid).toBe(true);

      // Invalid values - not an array
      expect(configurationService.validateConfiguration({
        privacySettings: { 
          shareWithTeam: false,
          excludeFilePatterns: [],
          excludeCommitPatterns: 'not-array' as any
        }
      }).isValid).toBe(false);

      // Invalid values - empty strings
      expect(configurationService.validateConfiguration({
        privacySettings: { 
          shareWithTeam: false,
          excludeFilePatterns: [],
          excludeCommitPatterns: ['WIP:', '']
        }
      }).isValid).toBe(false);
    });

    it('should return multiple validation errors', () => {
      const result = configurationService.validateConfiguration({
        maxCommitsToShow: 0,
        aiProvider: 'invalid' as any,
        aiTemperature: 3.0
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('maxCommitsToShow must be an integer between 1 and 50');
      expect(result.errors).toContain('aiProvider must be one of: openai, local, disabled');
      expect(result.errors).toContain('aiTemperature must be a number between 0 and 2');
    });

    it('should return valid result for empty configuration', () => {
      const result = configurationService.validateConfiguration({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('onConfigurationChanged', () => {
    it('should register configuration change listener', () => {
      const callback = jest.fn();
      
      configurationService.onConfigurationChanged(callback);

      expect(mockOnDidChangeConfiguration).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should fire callback when configuration changes', () => {
      const callback = jest.fn();
      let changeHandler: (event: any) => void = () => {};

      mockOnDidChangeConfiguration.mockImplementation((handler) => {
        changeHandler = handler;
        return { dispose: jest.fn() };
      });

      // Create a new service instance to capture the handler
      const service = new ConfigurationService();
      service.onConfigurationChanged(callback);

      // Simulate configuration change
      const mockEvent = {
        affectsConfiguration: jest.fn().mockReturnValue(true)
      };

      mockConfiguration.get.mockImplementation((key: string, defaultValue: any) => defaultValue);

      changeHandler(mockEvent);

      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('sessionRecap');
      
      service.dispose();
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', () => {
      const mockDispose = jest.fn();
      mockOnDidChangeConfiguration.mockReturnValue({ dispose: mockDispose });

      const service = new ConfigurationService();
      service.dispose();

      expect(mockDispose).toHaveBeenCalled();
    });
  });
});