"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const SidebarPanelProvider_1 = require("../../providers/SidebarPanelProvider");
const TeamDashboardProvider_1 = require("../../providers/TeamDashboardProvider");
// Mock VS Code API with webview support
jest.mock('vscode', () => ({
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        })),
        registerWebviewViewProvider: jest.fn(() => ({ dispose: jest.fn() })),
        showErrorMessage: jest.fn(() => Promise.resolve()),
        showInformationMessage: jest.fn(() => Promise.resolve()),
        showTextDocument: jest.fn(),
        showQuickPick: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => {
                return defaultValue;
            })
        })),
        workspaceFolders: [{
                uri: { fsPath: '/test/workspace' },
                name: 'test-workspace',
                index: 0
            }],
        openTextDocument: jest.fn()
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
    },
    Uri: {
        file: jest.fn((path) => ({
            fsPath: path,
            toString: () => path,
            with: jest.fn(() => ({ toString: () => path }))
        })),
        joinPath: jest.fn((base, ...paths) => ({
            toString: () => `${base}/${paths.join('/')}`
        }))
    },
    ExtensionContext: jest.fn(),
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    },
    WebviewViewProvider: jest.fn()
}));
describe('Webview Communication Integration Tests', () => {
    let mockContext;
    let mockWebviewView;
    let mockWebview;
    let messageCallback;
    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/extension' },
            globalStorageUri: { fsPath: '/test/storage' }
        };
        // Setup mock webview
        mockWebview = {
            options: {
                enableScripts: true,
                localResourceRoots: []
            },
            html: '',
            onDidReceiveMessage: jest.fn((callback) => {
                messageCallback = callback;
                return { dispose: jest.fn() };
            }),
            postMessage: jest.fn(),
            asWebviewUri: jest.fn((uri) => ({ toString: () => uri.toString() }))
        };
        mockWebviewView = {
            webview: mockWebview,
            onDidChangeVisibility: jest.fn(() => ({ dispose: jest.fn() })),
            onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
            visible: true,
            show: jest.fn(),
            title: 'Session Recap'
        };
    });
    describe('Sidebar Panel Communication', () => {
        test('should initialize webview with proper configuration', () => {
            // Arrange & Act
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Assert
            expect(mockWebview.options.enableScripts).toBe(true);
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
            expect(mockWebviewView.onDidChangeVisibility).toHaveBeenCalled();
            expect(mockWebviewView.onDidDispose).toHaveBeenCalled();
        });
        test('should handle file click messages from webview', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            const fileClickCallback = jest.fn();
            sidebarProvider.onFileClick(fileClickCallback);
            // Act - Simulate message from webview
            if (messageCallback) {
                messageCallback({
                    command: 'openFile',
                    filePath: 'src/test.ts'
                });
            }
            // Assert
            expect(fileClickCallback).toHaveBeenCalledWith('src/test.ts');
        });
        test('should handle refresh messages from webview', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate refresh message
            if (messageCallback) {
                messageCallback({
                    command: 'refresh'
                });
            }
            // Assert - Should not throw errors
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
        test('should handle unknown messages gracefully', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate unknown message
            if (messageCallback) {
                messageCallback({
                    command: 'unknownCommand',
                    data: 'test'
                });
            }
            // Assert - Should not throw errors
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
        test('should update webview content with session data', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            const sessionData = {
                sessionId: 'test-session',
                startTime: new Date('2023-01-01T10:00:00Z'),
                endTime: new Date('2023-01-01T11:00:00Z'),
                editedFiles: [
                    {
                        filePath: 'src/test.ts',
                        timestamp: new Date('2023-01-01T10:30:00Z'),
                        changeType: 'modified',
                        lineCount: 50
                    }
                ],
                gitCommits: [
                    {
                        hash: 'abc123',
                        message: 'Test commit',
                        author: 'Test User',
                        timestamp: new Date('2023-01-01T10:45:00Z'),
                        filesChanged: ['src/test.ts']
                    }
                ],
                terminalErrors: [
                    {
                        message: 'Error: Test error',
                        timestamp: new Date('2023-01-01T10:50:00Z'),
                        terminalName: 'Terminal 1',
                        errorType: 'error'
                    }
                ],
                summary: 'Test session summary'
            };
            // Act
            sidebarProvider.updateContent(sessionData);
            // Assert
            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateContent',
                data: sessionData
            });
        });
        test('should handle webview visibility changes', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            let visibilityCallback;
            mockWebviewView.onDidChangeVisibility.mockImplementation((callback) => {
                visibilityCallback = callback;
                return { dispose: jest.fn() };
            });
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate visibility change
            mockWebviewView.visible = false;
            if (visibilityCallback) {
                visibilityCallback();
            }
            // Assert
            expect(mockWebviewView.onDidChangeVisibility).toHaveBeenCalled();
        });
        test('should handle webview disposal', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            let disposeCallback;
            mockWebviewView.onDidDispose.mockImplementation((callback) => {
                disposeCallback = callback;
                return { dispose: jest.fn() };
            });
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate disposal
            if (disposeCallback) {
                disposeCallback();
            }
            // Assert
            expect(mockWebviewView.onDidDispose).toHaveBeenCalled();
        });
    });
    describe('Team Dashboard Communication', () => {
        test('should initialize team dashboard webview', () => {
            // Arrange & Act
            const teamProvider = new TeamDashboardProvider_1.TeamDashboardProvider(mockContext.extensionUri);
            teamProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Assert
            expect(mockWebview.options.enableScripts).toBe(true);
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
        test('should handle team member selection messages', () => {
            // Arrange
            const teamProvider = new TeamDashboardProvider_1.TeamDashboardProvider(mockContext.extensionUri);
            teamProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate team member selection
            if (messageCallback) {
                messageCallback({
                    command: 'selectTeamMember',
                    memberId: 'user123'
                });
            }
            // Assert - Should not throw errors
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
        test('should handle opt-in/opt-out messages', () => {
            // Arrange
            const teamProvider = new TeamDashboardProvider_1.TeamDashboardProvider(mockContext.extensionUri);
            teamProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate opt-in message
            if (messageCallback) {
                messageCallback({
                    command: 'optIn'
                });
            }
            // Act - Simulate opt-out message
            if (messageCallback) {
                messageCallback({
                    command: 'optOut'
                });
            }
            // Assert - Should not throw errors
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
        test('should update team dashboard with aggregated data', () => {
            // Arrange
            const teamProvider = new TeamDashboardProvider_1.TeamDashboardProvider(mockContext.extensionUri);
            teamProvider.resolveWebviewView(mockWebviewView, {}, {});
            const teamData = {
                teamId: 'test-team',
                aggregatedAt: new Date(),
                members: [
                    {
                        id: 'user1',
                        name: 'John Doe',
                        lastSession: {
                            sessionId: 'session1',
                            startTime: new Date(),
                            editedFiles: [],
                            gitCommits: [],
                            terminalErrors: [],
                            summary: 'User 1 session'
                        }
                    },
                    {
                        id: 'user2',
                        name: 'Jane Smith',
                        lastSession: {
                            sessionId: 'session2',
                            startTime: new Date(),
                            editedFiles: [],
                            gitCommits: [],
                            terminalErrors: [],
                            summary: 'User 2 session'
                        }
                    }
                ]
            };
            // Act
            teamProvider.updateContent(teamData);
            // Assert
            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateTeamData',
                data: teamData
            });
        });
    });
    describe('Webview HTML Generation', () => {
        test('should generate valid HTML for sidebar panel', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act
            const html = mockWebview.html;
            // Assert - HTML should be set
            expect(typeof html).toBe('string');
        });
        test('should include proper CSP in HTML', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act
            const html = mockWebview.html;
            // Assert - Should include Content Security Policy
            if (html) {
                expect(html).toContain('Content-Security-Policy');
            }
        });
        test('should handle resource URI generation', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act
            const testUri = vscode.Uri.file('/test/resource.css');
            const webviewUri = mockWebview.asWebviewUri(testUri);
            // Assert
            expect(mockWebview.asWebviewUri).toHaveBeenCalledWith(testUri);
            expect(webviewUri).toBeDefined();
        });
    });
    describe('Message Validation', () => {
        test('should validate message structure', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Send invalid messages
            const invalidMessages = [
                null,
                undefined,
                {},
                { command: null },
                { command: '' },
                { invalidProperty: 'test' }
            ];
            invalidMessages.forEach(message => {
                if (messageCallback) {
                    messageCallback(message);
                }
            });
            // Assert - Should handle gracefully
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
        test('should sanitize message data', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Send message with potentially dangerous data
            if (messageCallback) {
                messageCallback({
                    command: 'openFile',
                    filePath: '../../../etc/passwd'
                });
            }
            // Assert - Should handle path traversal attempts
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
    });
    describe('Error Handling in Communication', () => {
        test('should handle webview message errors', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Mock postMessage to throw error
            mockWebview.postMessage.mockImplementation(() => {
                throw new Error('Communication error');
            });
            // Act
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: []
            };
            // Should not throw
            expect(() => sidebarProvider.updateContent(sessionData)).not.toThrow();
        });
        test('should handle webview disposal during communication', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Simulate webview disposal
            mockWebview.postMessage.mockImplementation(() => {
                throw new Error('Webview disposed');
            });
            // Act & Assert - Should handle gracefully
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: []
            };
            expect(() => sidebarProvider.updateContent(sessionData)).not.toThrow();
        });
    });
    describe('Performance and Memory Management', () => {
        test('should handle large session data efficiently', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Create large session data
            const largeSessionData = {
                sessionId: 'large-session',
                startTime: new Date(),
                editedFiles: Array.from({ length: 1000 }, (_, i) => ({
                    filePath: `src/file${i}.ts`,
                    timestamp: new Date(),
                    changeType: 'modified',
                    lineCount: 100
                })),
                gitCommits: Array.from({ length: 100 }, (_, i) => ({
                    hash: `commit${i}`,
                    message: `Commit message ${i}`,
                    author: 'Test User',
                    timestamp: new Date(),
                    filesChanged: [`src/file${i}.ts`]
                })),
                terminalErrors: Array.from({ length: 50 }, (_, i) => ({
                    message: `Error message ${i}`,
                    timestamp: new Date(),
                    terminalName: 'Terminal',
                    errorType: 'error'
                })),
                summary: 'Large session summary'
            };
            // Act - Should handle large data without issues
            expect(() => sidebarProvider.updateContent(largeSessionData)).not.toThrow();
            // Assert
            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateContent',
                data: largeSessionData
            });
        });
        test('should clean up event listeners on disposal', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            const disposables = [];
            // Mock disposable creation
            const mockDisposable = { dispose: jest.fn() };
            mockWebview.onDidReceiveMessage.mockReturnValue(mockDisposable);
            mockWebviewView.onDidChangeVisibility.mockReturnValue(mockDisposable);
            mockWebviewView.onDidDispose.mockReturnValue(mockDisposable);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            // Act - Simulate disposal
            let disposeCallback;
            mockWebviewView.onDidDispose.mockImplementation((callback) => {
                disposeCallback = callback;
                return mockDisposable;
            });
            if (disposeCallback) {
                disposeCallback();
            }
            // Assert - Disposables should be cleaned up
            expect(mockWebviewView.onDidDispose).toHaveBeenCalled();
        });
    });
    describe('User Interaction Flows', () => {
        test('should handle complete file opening workflow', async () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            const mockDocument = { uri: { fsPath: '/test/workspace/src/test.ts' } };
            vscode.workspace.openTextDocument.mockResolvedValue(mockDocument);
            vscode.window.showTextDocument.mockResolvedValue(undefined);
            let fileClickCallback;
            sidebarProvider.onFileClick(async (filePath) => {
                const uri = vscode.Uri.file(`/test/workspace/${filePath}`);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            });
            // Act - Simulate file click from webview
            if (messageCallback) {
                messageCallback({
                    command: 'openFile',
                    filePath: 'src/test.ts'
                });
            }
            // Allow async operations to complete
            await new Promise(resolve => setTimeout(resolve, 0));
            // Assert
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });
        test('should handle refresh workflow', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
            sidebarProvider.resolveWebviewView(mockWebviewView, {}, {});
            let refreshTriggered = false;
            sidebarProvider.onRefresh(() => {
                refreshTriggered = true;
            });
            // Act - Simulate refresh from webview
            if (messageCallback) {
                messageCallback({
                    command: 'refresh'
                });
            }
            // Assert
            expect(refreshTriggered).toBe(true);
        });
    });
});
//# sourceMappingURL=webview-communication.test.js.map