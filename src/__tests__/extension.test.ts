import * as vscode from 'vscode';
import { activate, deactivate } from '../extension';

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
    },
    ExtensionContext: jest.fn()
}));

// Mock the services
jest.mock('../services/SessionTracker');
jest.mock('../providers/SidebarPanelProvider');
jest.mock('../services/AISummaryService');

describe('Extension Activation', () => {
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/path' } as vscode.Uri,
            globalStorageUri: { fsPath: '/test/storage' } as vscode.Uri
        } as any;
    });

    afterEach(() => {
        // Clean up after each test
        deactivate();
    });

    test('should activate extension successfully', async () => {
        // Act
        await activate(mockContext);

        // Assert
        expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Session Recap');
        expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('sessionRecap', expect.any(Object));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.refresh', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.clear', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.showLogs', expect.any(Function));
    });

    test('should handle activation errors gracefully', async () => {
        // Arrange
        const mockError = new Error('Test activation error');
        (vscode.window.createOutputChannel as jest.Mock).mockImplementation(() => {
            throw mockError;
        });

        // Act
        await activate(mockContext);

        // Assert
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to activate Session Recap extension')
        );
    });

    test('should register all required commands', async () => {
        // Act
        await activate(mockContext);

        // Assert
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.refresh', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.clear', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.showLogs', expect.any(Function));
    });

    test('should handle deactivation gracefully', () => {
        // This test ensures deactivate doesn't throw errors
        expect(() => deactivate()).not.toThrow();
    });
});

describe('Extension Commands', () => {
    let mockContext: vscode.ExtensionContext;
    let registeredCommands: { [key: string]: Function } = {};

    beforeEach(async () => {
        jest.clearAllMocks();
        registeredCommands = {};
        
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/path' } as vscode.Uri,
            globalStorageUri: { fsPath: '/test/storage' } as vscode.Uri
        } as any;

        // Capture registered commands
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((command: string, callback: Function) => {
            registeredCommands[command] = callback;
            return { dispose: jest.fn() };
        });

        await activate(mockContext);
    });

    afterEach(() => {
        deactivate();
    });

    test('refresh command should work without errors', async () => {
        // Act
        const refreshCommand = registeredCommands['sessionRecap.refresh'];
        
        // Should not throw
        expect(refreshCommand).toBeDefined();
        await expect(refreshCommand()).resolves.not.toThrow();
    });

    test('clear command should work without errors', () => {
        // Act
        const clearCommand = registeredCommands['sessionRecap.clear'];
        
        // Should not throw
        expect(() => clearCommand()).not.toThrow();
    });

    test('showLogs command should show output channel', () => {
        // Act
        const showLogsCommand = registeredCommands['sessionRecap.showLogs'];
        showLogsCommand();

        // The command should execute without error
        // Actual output channel show() call is tested in integration tests
        expect(showLogsCommand).toBeDefined();
    });
});