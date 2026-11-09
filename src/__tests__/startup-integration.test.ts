import * as vscode from 'vscode';
import { SessionTracker } from '../services/SessionTracker';
import { SidebarPanelProvider } from '../providers/SidebarPanelProvider';
import { AISummaryService } from '../services/AISummaryService';
import { SessionData } from '../models/SessionData';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        })),
        registerWebviewViewProvider: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(() => Promise.resolve()),
        showInformationMessage: jest.fn(),
        showTextDocument: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string, defaultValue?: any) => {
                const config: any = {
                    'aiProvider': 'disabled',
                    'openaiApiKey': '',
                    'aiMaxTokens': 150,
                    'aiTemperature': 0.7
                };
                return config[key] ?? defaultValue;
            })
        })),
        workspaceFolders: [],
        openTextDocument: jest.fn(),
        onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
    },
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path }))
    }
}));

describe('Session Startup Integration', () => {
    let mockContext: vscode.ExtensionContext;
    let sessionTracker: SessionTracker;
    let sidebarProvider: SidebarPanelProvider;
    let aiSummaryService: AISummaryService;
    let outputChannel: vscode.OutputChannel;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/path' } as vscode.Uri,
            globalStorageUri: { fsPath: '/test/storage' } as vscode.Uri
        } as any;

        outputChannel = vscode.window.createOutputChannel('Session Recap');
        sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
        aiSummaryService = new AISummaryService(outputChannel);
        sessionTracker = new SessionTracker(mockContext, sidebarProvider);
    });

    afterEach(() => {
        if (sessionTracker && 'dispose' in sessionTracker) {
            (sessionTracker as any).dispose();
        }
    });

    test('should handle first-time startup with no previous session', async () => {
        // Arrange
        const updateContentSpy = jest.spyOn(sidebarProvider, 'updateContent');
        
        // Act
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
        
        // Assert
        expect(previousSession).toBeNull();
    });

    test('should handle startup with existing previous session', async () => {
        // Arrange
        const mockPreviousSession: SessionData = {
            sessionId: 'test-session',
            startTime: new Date('2023-01-01T10:00:00Z'),
            endTime: new Date('2023-01-01T11:00:00Z'),
            editedFiles: [
                {
                    filePath: 'test.ts',
                    timestamp: new Date('2023-01-01T10:30:00Z'),
                    changeType: 'modified'
                }
            ],
            gitCommits: [
                {
                    hash: 'abc123',
                    message: 'Test commit',
                    author: 'Test User',
                    timestamp: new Date('2023-01-01T10:45:00Z'),
                    filesChanged: ['test.ts']
                }
            ],
            terminalErrors: [],
            summary: 'Test session summary'
        };

        // Mock the session storage to return a previous session
        const mockLoadLastSession = jest.fn().mockResolvedValue(mockPreviousSession);
        (sessionTracker as any).sessionStorage.loadLastSession = mockLoadLastSession;

        // Act
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();

        // Assert
        expect(previousSession).toEqual(mockPreviousSession);
        expect(mockLoadLastSession).toHaveBeenCalled();
    });

    test('should generate AI summary for session without summary', async () => {
        // Arrange
        const mockSession: SessionData = {
            sessionId: 'test-session',
            startTime: new Date(),
            editedFiles: [
                {
                    filePath: 'test.ts',
                    timestamp: new Date(),
                    changeType: 'modified'
                }
            ],
            gitCommits: [],
            terminalErrors: []
        };

        // Act
        const fallbackSummary = aiSummaryService.generateFallbackSummary(mockSession);

        // Assert
        expect(fallbackSummary).toContain('modified test.ts');
    });

    test('should handle corrupted session data gracefully', async () => {
        // Arrange
        const mockLoadLastSession = jest.fn().mockRejectedValue(new Error('Corrupted data'));
        (sessionTracker as any).sessionStorage.loadLastSession = mockLoadLastSession;

        // Act
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();

        // Assert
        expect(previousSession).toBeNull();
        expect(mockLoadLastSession).toHaveBeenCalled();
    });

    test('should start tracking new session after loading previous session', () => {
        // Act
        sessionTracker.startTracking();
        const currentSession = sessionTracker.getCurrentSession();

        // Assert
        expect(currentSession).toBeDefined();
        expect(currentSession.sessionId).toBeDefined();
        expect(currentSession.startTime).toBeInstanceOf(Date);
        expect(currentSession.editedFiles).toEqual([]);
        expect(currentSession.gitCommits).toEqual([]);
        expect(currentSession.terminalErrors).toEqual([]);
    });

    test('should handle file click events from sidebar', () => {
        // Arrange
        const mockCallback = jest.fn();
        
        // Act
        sidebarProvider.onFileClick(mockCallback);
        
        // Simulate file click (this would normally come from webview)
        const testFilePath = '/test/file.ts';
        if ((sidebarProvider as any)._fileClickCallback) {
            (sidebarProvider as any)._fileClickCallback(testFilePath);
        }

        // Assert
        expect(mockCallback).toHaveBeenCalledWith(testFilePath);
    });
});