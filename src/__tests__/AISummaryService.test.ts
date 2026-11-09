import * as vscode from 'vscode';
import { AISummaryService } from '../services/AISummaryService';
import { SessionData } from '../models/SessionData';
import { FileEdit } from '../models/FileEdit';
import { GitCommit } from '../models/GitCommit';
import { TerminalError } from '../models/TerminalError';

// Mock VS Code API
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
  },
  OutputChannel: jest.fn()
}));

// Mock fetch for OpenAI API calls
(global as any).fetch = jest.fn();

describe('AISummaryService', () => {
  let service: AISummaryService;
  let mockOutputChannel: jest.Mocked<vscode.OutputChannel>;
  let mockConfig: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock output channel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      replace: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'test'
    };

    // Mock configuration
    mockConfig = jest.fn();
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: mockConfig
    });

    // Default configuration
    mockConfig.mockImplementation((key: string, defaultValue?: any) => {
      const config: { [key: string]: any } = {
        'aiProvider': 'disabled',
        'openaiApiKey': '',
        'aiMaxTokens': 150,
        'aiTemperature': 0.7
      };
      return config[key] ?? defaultValue;
    });

    service = new AISummaryService(mockOutputChannel);
  });

  describe('constructor', () => {
    it('should initialize with configuration from VS Code settings', () => {
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
      expect(service.getCurrentProvider()).toBe('disabled');
    });
  });

  describe('isAvailable', () => {
    it('should return false when provider is disabled', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return false when OpenAI provider has no API key', () => {
      service.updateConfig({ provider: 'openai' });
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when OpenAI provider has API key', () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      expect(service.isAvailable()).toBe(true);
    });

    it('should return true when local provider is selected', () => {
      service.updateConfig({ provider: 'local' });
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ provider: 'openai', apiKey: 'new-key' });
      expect(service.getCurrentProvider()).toBe('openai');
    });

    it('should merge with existing configuration', () => {
      service.updateConfig({ provider: 'openai' });
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      expect(service.getCurrentProvider()).toBe('openai');
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('generateSummary', () => {
    const mockSessionData: SessionData = {
      sessionId: 'test-session',
      startTime: new Date('2023-01-01T10:00:00Z'),
      editedFiles: [
        {
          filePath: '/test/file1.ts',
          timestamp: new Date('2023-01-01T10:30:00Z'),
          changeType: 'modified',
          lineCount: 50
        } as FileEdit
      ],
      gitCommits: [
        {
          hash: 'abc123',
          message: 'Add new feature',
          author: 'Test User',
          timestamp: new Date('2023-01-01T11:00:00Z'),
          filesChanged: ['/test/file1.ts']
        } as GitCommit
      ],
      terminalErrors: [
        {
          message: 'TypeError: Cannot read property',
          timestamp: new Date('2023-01-01T10:45:00Z'),
          terminalName: 'Terminal 1',
          errorType: 'error'
        } as TerminalError
      ]
    };

    it('should throw error when service is not available', async () => {
      await expect(service.generateSummary(mockSessionData))
        .rejects.toThrow('AI summary service is not available or disabled');
    });

    it('should generate OpenAI summary successfully', async () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'You modified 1 file, made 1 commit, and encountered a TypeError.'
              }
            }
          ]
        })
      };
      
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateSummary(mockSessionData);
      
      expect(result).toBe('You modified 1 file, made 1 commit, and encountered a TypeError.');
      expect((global as any).fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          }
        })
      );
    });

    it('should handle OpenAI API errors', async () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      };
      
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.generateSummary(mockSessionData))
        .rejects.toThrow('Failed to generate OpenAI summary');
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('OpenAI API Error')
      );
    });

    it('should handle OpenAI API network errors', async () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      
      ((global as any).fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.generateSummary(mockSessionData))
        .rejects.toThrow('Failed to generate OpenAI summary');
    });

    it('should handle empty OpenAI response', async () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: []
        })
      };
      
      ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.generateSummary(mockSessionData))
        .rejects.toThrow('Failed to generate OpenAI summary');
    });

    it('should generate local AI summary', async () => {
      service.updateConfig({ provider: 'local' });

      const result = await service.generateSummary(mockSessionData);
      
      expect(result).toContain('modified file1.ts');
      expect(result).toContain('made 1 commit');
    });

    it('should fall back locally when OpenAI fails', async () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      ((global as any).fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.generateSummaryOrFallback(mockSessionData);

      expect(result).toContain('modified file1.ts');
      expect(result).toContain('made 1 commit');
    });

    it('should log errors to output channel', async () => {
      service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
      
      ((global as any).fetch as jest.Mock).mockRejectedValue(new Error('Test error'));

      await expect(service.generateSummary(mockSessionData))
        .rejects.toThrow();
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('AI Summary Error')
      );
    });
  });

  describe('generateFallbackSummary', () => {
    it('should generate summary with files only', () => {
      const sessionData: SessionData = {
        sessionId: 'test',
        startTime: new Date(),
        editedFiles: [
          { filePath: '/test.ts', timestamp: new Date(), changeType: 'modified' } as FileEdit
        ],
        gitCommits: [],
        terminalErrors: []
      };

      const result = service.generateFallbackSummary(sessionData);
      expect(result).toBe('In your last session, you modified test.ts.');
    });

    it('should generate summary with multiple files', () => {
      const sessionData: SessionData = {
        sessionId: 'test',
        startTime: new Date(),
        editedFiles: [
          { filePath: '/test1.ts', timestamp: new Date(), changeType: 'modified' } as FileEdit,
          { filePath: '/test2.ts', timestamp: new Date(), changeType: 'created' } as FileEdit
        ],
        gitCommits: [],
        terminalErrors: []
      };

      const result = service.generateFallbackSummary(sessionData);
      expect(result).toBe('In your last session, you modified test1.ts, test2.ts.');
    });

    it('should generate summary with commits only', () => {
      const sessionData: SessionData = {
        sessionId: 'test',
        startTime: new Date(),
        editedFiles: [],
        gitCommits: [
          { hash: 'abc', message: 'test', author: 'user', timestamp: new Date(), filesChanged: [] } as GitCommit
        ],
        terminalErrors: []
      };

      const result = service.generateFallbackSummary(sessionData);
      expect(result).toBe('In your last session, you made 1 commit.');
    });

    it('should generate summary with multiple commits', () => {
      const sessionData: SessionData = {
        sessionId: 'test',
        startTime: new Date(),
        editedFiles: [],
        gitCommits: [
          { hash: 'abc', message: 'test1', author: 'user', timestamp: new Date(), filesChanged: [] } as GitCommit,
          { hash: 'def', message: 'test2', author: 'user', timestamp: new Date(), filesChanged: [] } as GitCommit
        ],
        terminalErrors: []
      };

      const result = service.generateFallbackSummary(sessionData);
      expect(result).toBe('In your last session, you made 2 commits.');
    });

    it('should generate summary with all activity types', () => {
      const sessionData: SessionData = {
        sessionId: 'test',
        startTime: new Date(),
        editedFiles: [
          { filePath: '/test.ts', timestamp: new Date(), changeType: 'modified' } as FileEdit
        ],
        gitCommits: [
          { hash: 'abc', message: 'test', author: 'user', timestamp: new Date(), filesChanged: [] } as GitCommit
        ],
        terminalErrors: [
          { message: 'error', timestamp: new Date(), terminalName: 'term', errorType: 'error' } as TerminalError
        ]
      };

      const result = service.generateFallbackSummary(sessionData);
      expect(result).toBe('In your last session, you modified test.ts, made 1 commit, encountered terminal errors.');
    });

    it('should handle empty session data', () => {
      const sessionData: SessionData = {
        sessionId: 'test',
        startTime: new Date(),
        editedFiles: [],
        gitCommits: [],
        terminalErrors: []
      };

      const result = service.generateFallbackSummary(sessionData);
      expect(result).toBe('No significant activity detected in the last session.');
    });
  });
});