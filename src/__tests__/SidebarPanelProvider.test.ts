import * as vscode from 'vscode';
import { SidebarPanelProvider } from '../providers/SidebarPanelProvider';
import { SessionData } from '../models/SessionData';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        showInformationMessage: jest.fn()
    },
    Uri: {
        file: jest.fn()
    }
}));

describe('SidebarPanelProvider', () => {
    let provider: SidebarPanelProvider;
    let mockWebviewView: any;
    let mockWebview: any;
    let extensionUri: vscode.Uri;

    beforeEach(() => {
        extensionUri = { fsPath: '/test/path' } as vscode.Uri;
        provider = new SidebarPanelProvider(extensionUri);

        mockWebview = {
            html: '',
            options: {},
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn()
        };

        mockWebviewView = {
            webview: mockWebview,
            show: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('resolveWebviewView', () => {
        it('should set up webview options and HTML content', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            expect(mockWebview.options).toEqual({
                enableScripts: true,
                localResourceRoots: [extensionUri]
            });
            expect(mockWebview.html).toContain('Session Recap');
            expect(mockWebview.html).toContain('Loading session data...');
        });

        it('should register message handler', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
    });

    describe('show', () => {
        it('should show the webview when available', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            provider.show();
            expect(mockWebviewView.show).toHaveBeenCalledWith(true);
        });

        it('should not throw when webview is not available', () => {
            expect(() => provider.show()).not.toThrow();
        });
    });

    describe('hide', () => {
        it('should clear webview HTML when hiding', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            provider.hide();
            expect(mockWebview.html).toBe('');
        });
    });

    describe('updateContent', () => {
        it('should post message to webview with session data', () => {
            const sessionData: SessionData = {
                sessionId: 'test-session',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Test summary'
            };

            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler({ type: 'ready' });
            provider.updateContent(sessionData);

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                type: 'updateSession',
                sessionData
            });
        });

        it('should replay session data after the webview reports ready', () => {
            const sessionData: SessionData = {
                sessionId: 'test-session',
                startTime: new Date(),
                endTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Test summary'
            };

            provider.updateContent(sessionData);
            expect(mockWebview.postMessage).not.toHaveBeenCalled();

            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler({ type: 'ready' });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                type: 'updateSession',
                sessionData
            });
        });
    });

    describe('onFileClick', () => {
        it('should register file click callback', () => {
            const callback = jest.fn();
            provider.onFileClick(callback);

            // Simulate webview setup and message handling
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Simulate file click message
            messageHandler({ type: 'fileClick', filePath: '/test/file.ts' });

            expect(callback).toHaveBeenCalledWith('/test/file.ts');
        });
    });

    describe('message handling', () => {
        it('should handle error click messages', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            messageHandler({ 
                type: 'errorClick', 
                errorMessage: 'Test error message' 
            });

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Terminal Error Details',
                { modal: false, detail: 'Test error message' }
            );
        });

        it('should ignore unknown message types', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            expect(() => {
                messageHandler({ type: 'unknown', data: 'test' });
            }).not.toThrow();
        });
    });

    describe('HTML generation', () => {
        it('should generate valid HTML with proper structure', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const html = mockWebview.html;

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html lang="en">');
            expect(html).toContain('<head>');
            expect(html).toContain('<body>');
            expect(html).toContain('<script>');
            expect(html).toContain('acquireVsCodeApi()');
        });

        it('should include responsive CSS styles', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const html = mockWebview.html;

            expect(html).toContain('@media (max-width: 300px)');
            expect(html).toContain('overflow-y: auto');
            expect(html).toContain('::-webkit-scrollbar');
        });

        it('should include interactive elements', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            const html = mockWebview.html;

            expect(html).toContain('onclick="openFile');
            expect(html).toContain('onclick="showErrorDetails');
            expect(html).toContain('cursor: pointer');
        });
    });
});