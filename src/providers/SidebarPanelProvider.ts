import { ISidebarPanelProvider } from '../interfaces/ISidebarPanelProvider';

import * as vscode from 'vscode';
/**
 * Manages the VS Code webview panel for displaying session recap
 * This is a basic implementation that will be expanded in later tasks
 */
export class SidebarPanelProvider implements ISidebarPanelProvider, vscode.WebviewViewProvider {
    public static readonly viewType = 'sessionRecap';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _fileClickCallback?: (filePath: string) => void;
    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'fileClick':
                    if (this._fileClickCallback) {
                        this._fileClickCallback(data.filePath);
                    }
                    break;
                case 'errorClick':
                    // Show error details in VS Code information message
                    vscode.window.showInformationMessage('Terminal Error Details', { modal: false, detail: data.errorMessage });
                    break;
            }
        });
    }
    show() {
        if (this._view) {
            this._view.show?.(true);
        }
    }
    hide() {
        // WebviewView doesn't have a hide method, but we can clear content
        if (this._view) {
            this._view.webview.html = '';
        }
    }
    updateContent(sessionData: import('../models/SessionData').SessionData) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'updateSession', sessionData });
        }
    }
    onFileClick(callback: (filePath: string) => void) {
        this._fileClickCallback = callback;
    }
    _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Session Recap</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 0;
                        margin: 0;
                        height: 100vh;
                        overflow-y: auto;
                    }

                    .container {
                        padding: 12px;
                        max-height: 100vh;
                        overflow-y: auto;
                    }

                    .section {
                        margin-bottom: 20px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 16px;
                    }

                    .section:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }

                    .section-title {
                        font-weight: 600;
                        font-size: 14px;
                        margin-bottom: 12px;
                        color: var(--vscode-textLink-foreground);
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .section-icon {
                        width: 16px;
                        height: 16px;
                        opacity: 0.8;
                    }

                    .summary-content {
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 4px solid var(--vscode-textLink-foreground);
                        padding: 12px;
                        margin: 8px 0;
                        border-radius: 4px;
                        font-style: italic;
                        line-height: 1.4;
                    }

                    .file-item {
                        cursor: pointer;
                        padding: 8px 12px;
                        border-radius: 4px;
                        margin: 4px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: background-color 0.1s ease;
                        border: 1px solid transparent;
                    }

                    .file-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                        border-color: var(--vscode-focusBorder);
                    }

                    .file-item:active {
                        background-color: var(--vscode-list-activeSelectionBackground);
                    }

                    .file-icon {
                        width: 16px;
                        height: 16px;
                        opacity: 0.7;
                        flex-shrink: 0;
                    }

                    .file-path {
                        flex: 1;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 13px;
                        word-break: break-all;
                    }

                    .file-meta {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-left: 24px;
                        margin-top: 2px;
                    }

                    .commit-item {
                        padding: 8px 12px;
                        margin: 4px 0;
                        background-color: var(--vscode-input-background);
                        border-radius: 4px;
                        border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground);
                    }

                    .commit-hash {
                        font-family: var(--vscode-editor-font-family);
                        font-size: 12px;
                        color: var(--vscode-textLink-foreground);
                        font-weight: 600;
                    }

                    .commit-message {
                        margin: 4px 0;
                        font-size: 13px;
                        line-height: 1.3;
                    }

                    .commit-meta {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 6px;
                    }

                    .commit-files {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .error-item {
                        padding: 12px;
                        margin: 8px 0;
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border-left: 4px solid var(--vscode-inputValidation-errorBorder);
                        border-radius: 4px;
                        cursor: pointer;
                        transition: opacity 0.1s ease;
                    }

                    .error-item:hover {
                        opacity: 0.9;
                    }

                    .error-message {
                        font-family: var(--vscode-editor-font-family);
                        font-size: 13px;
                        line-height: 1.4;
                        margin-bottom: 6px;
                        word-break: break-word;
                    }

                    .error-meta {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .error-type {
                        text-transform: uppercase;
                        font-weight: 600;
                        padding: 2px 6px;
                        border-radius: 2px;
                        background-color: var(--vscode-inputValidation-errorBorder);
                        color: var(--vscode-inputValidation-errorForeground);
                        font-size: 10px;
                    }

                    .empty-state {
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                        text-align: center;
                        padding: 20px;
                        background-color: var(--vscode-input-background);
                        border-radius: 4px;
                        border: 1px dashed var(--vscode-panel-border);
                    }

                    .welcome-state {
                        text-align: center;
                        padding: 24px;
                        background: linear-gradient(135deg, var(--vscode-textBlockQuote-background), var(--vscode-input-background));
                        border-radius: 8px;
                        border: 1px solid var(--vscode-panel-border);
                    }

                    .welcome-icon {
                        font-size: 48px;
                        margin-bottom: 16px;
                        opacity: 0.6;
                    }

                    .welcome-title {
                        font-size: 16px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: var(--vscode-textLink-foreground);
                    }

                    .welcome-message {
                        color: var(--vscode-descriptionForeground);
                        line-height: 1.4;
                    }

                    .loading-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .loading-spinner {
                        width: 24px;
                        height: 24px;
                        border: 2px solid var(--vscode-panel-border);
                        border-top: 2px solid var(--vscode-textLink-foreground);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 16px;
                    }

                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }

                    .timestamp {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                    }

                    /* Responsive design for narrow panels */
                    @media (max-width: 300px) {
                        .container {
                            padding: 8px;
                        }
                        
                        .file-item, .commit-item, .error-item {
                            padding: 6px 8px;
                        }
                        
                        .commit-meta {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 4px;
                        }
                    }

                    /* Scrollbar styling */
                    ::-webkit-scrollbar {
                        width: 8px;
                    }

                    ::-webkit-scrollbar-track {
                        background: var(--vscode-scrollbarSlider-background);
                    }

                    ::-webkit-scrollbar-thumb {
                        background: var(--vscode-scrollbarSlider-hoverBackground);
                        border-radius: 4px;
                    }

                    ::-webkit-scrollbar-thumb:hover {
                        background: var(--vscode-scrollbarSlider-activeBackground);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div id="content">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div>Loading session data...</div>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateSession':
                                updateSessionDisplay(message.sessionData);
                                break;
                        }
                    });

                    function updateSessionDisplay(sessionData) {
                        const content = document.getElementById('content');
                        
                        // Handle welcome state for first-time users
                        if (sessionData.sessionId === 'welcome') {
                            content.innerHTML = \`
                                <div class="welcome-state">
                                    <div class="welcome-icon">👋</div>
                                    <div class="welcome-title">Welcome to Session Recap!</div>
                                    <div class="welcome-message">This is your first session. Start coding and your activity will be tracked here.</div>
                                </div>
                            \`;
                            return;
                        }

                        let html = '';

                        // Session Overview section
                        html += '<div class="section">';
                        html += '<div class="section-title">📊 Session Overview</div>';
                        const duration = sessionData.endTime 
                            ? Math.round((sessionData.endTime.getTime() - sessionData.startTime.getTime()) / 60000)
                            : 'In Progress';
                        const durationText = typeof duration === 'number' ? duration + ' minutes' : duration;
                        html += '<div style="margin-bottom: 8px;">';
                        html += '<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">Duration: <strong>' + durationText + '</strong></div>';
                        html += '<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">Started: ' + formatTimestamp(sessionData.startTime) + '</div>';
                        html += '</div>';
                        if (sessionData.productivityScore !== undefined) {
                            const scoreColor = sessionData.productivityScore >= 80 ? '#4caf50' : 
                                             sessionData.productivityScore >= 60 ? '#8bc34a' :
                                             sessionData.productivityScore >= 40 ? '#ff9800' : '#f44336';
                            html += '<div style="margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border-radius: 4px;">';
                            html += '<div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">Productivity Score</div>';
                            html += '<div style="display: flex; align-items: center; gap: 8px;">';
                            html += '<div style="flex: 1; height: 8px; background: var(--vscode-progressBar-background); border-radius: 4px; overflow: hidden;">';
                            html += '<div style="height: 100%; width: ' + sessionData.productivityScore + '%; background: ' + scoreColor + '; transition: width 0.3s;"></div>';
                            html += '</div>';
                            html += '<span style="font-weight: 600; font-size: 13px; color: ' + scoreColor + ';">' + sessionData.productivityScore + '</span>';
                            html += '</div>';
                            html += '</div>';
                        }
                        if (sessionData.tags && sessionData.tags.length > 0) {
                            html += '<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">';
                            sessionData.tags.forEach(tag => {
                                html += '<span style="font-size: 10px; padding: 2px 6px; background: var(--vscode-textLink-foreground); color: var(--vscode-editor-background); border-radius: 3px;">' + escapeHtml(tag) + '</span>';
                            });
                            html += '</div>';
                        }
                        html += '</div>';

                        // AI Summary section
                        html += '<div class="section">';
                        html += '<div class="section-title">📋 Session Summary</div>';
                        if (sessionData.summary) {
                            html += '<div class="summary-content">' + escapeHtml(sessionData.summary) + '</div>';
                        } else {
                            html += '<div class="empty-state">No AI summary available</div>';
                        }
                        html += '</div>';

                        // Notes section
                        if (sessionData.notes) {
                            html += '<div class="section">';
                            html += '<div class="section-title">📝 Notes</div>';
                            html += '<div style="padding: 8px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textLink-foreground); border-radius: 4px; font-size: 13px; line-height: 1.4; white-space: pre-wrap;">' + escapeHtml(sessionData.notes) + '</div>';
                            html += '</div>';
                        }

                        // Files section
                        html += '<div class="section">';
                        html += '<div class="section-title">📝 Edited Files</div>';
                        if (sessionData.editedFiles && sessionData.editedFiles.length > 0) {
                            sessionData.editedFiles.forEach(file => {
                                const changeIcon = getChangeTypeIcon(file.changeType);
                                const timestamp = formatTimestamp(file.timestamp);
                                html += \`
                                    <div class="file-item" onclick="openFile('\${escapeHtml(file.filePath)}')" title="Click to open file">
                                        <span class="file-icon">\${changeIcon}</span>
                                        <div>
                                            <div class="file-path">\${escapeHtml(file.filePath)}</div>
                                            <div class="file-meta">\${file.changeType} • \${timestamp}\${file.lineCount ? ' • ' + file.lineCount + ' lines' : ''}</div>
                                        </div>
                                    </div>
                                \`;
                            });
                        } else {
                            html += '<div class="empty-state">No files edited in last session</div>';
                        }
                        html += '</div>';

                        // Git commits section
                        html += '<div class="section">';
                        html += '<div class="section-title">🔄 Git Commits</div>';
                        if (sessionData.gitCommits && sessionData.gitCommits.length > 0) {
                            sessionData.gitCommits.forEach(commit => {
                                const timestamp = formatTimestamp(commit.timestamp);
                                const filesText = commit.filesChanged.length === 1 ? '1 file' : \`\${commit.filesChanged.length} files\`;
                                html += \`
                                    <div class="commit-item">
                                        <div class="commit-hash">\${commit.hash.substring(0, 7)}</div>
                                        <div class="commit-message">\${escapeHtml(commit.message)}</div>
                                        <div class="commit-meta">
                                            <span class="timestamp">\${timestamp} • \${escapeHtml(commit.author)}</span>
                                            <span class="commit-files">\${filesText}</span>
                                        </div>
                                    </div>
                                \`;
                            });
                        } else {
                            html += '<div class="empty-state">No commits since last session</div>';
                        }
                        html += '</div>';

                        // Terminal errors section
                        html += '<div class="section">';
                        html += '<div class="section-title">⚠️ Terminal Errors</div>';
                        if (sessionData.terminalErrors && sessionData.terminalErrors.length > 0) {
                            const lastError = sessionData.terminalErrors[sessionData.terminalErrors.length - 1];
                            const timestamp = formatTimestamp(lastError.timestamp);
                            html += \`
                                <div class="error-item" onclick="showErrorDetails('\${escapeHtml(lastError.message)}')" title="Click for more details">
                                    <div class="error-message">\${escapeHtml(lastError.message)}</div>
                                    <div class="error-meta">
                                        <span class="timestamp">\${timestamp} • \${escapeHtml(lastError.terminalName)}</span>
                                        <span class="error-type">\${lastError.errorType}</span>
                                    </div>
                                </div>
                            \`;
                        } else {
                            html += '<div class="empty-state">No terminal errors in last session</div>';
                        }
                        html += '</div>';

                        content.innerHTML = html;
                    }

                    function openFile(filePath) {
                        vscode.postMessage({
                            type: 'fileClick',
                            filePath: filePath
                        });
                    }

                    function showErrorDetails(errorMessage) {
                        vscode.postMessage({
                            type: 'errorClick',
                            errorMessage: errorMessage
                        });
                    }

                    function getChangeTypeIcon(changeType) {
                        switch (changeType) {
                            case 'created': return '✨';
                            case 'modified': return '📝';
                            case 'deleted': return '🗑️';
                            default: return '📄';
                        }
                    }

                    function formatTimestamp(timestamp) {
                        const date = new Date(timestamp);
                        const now = new Date();
                        const diffMs = now.getTime() - date.getTime();
                        const diffMins = Math.floor(diffMs / (1000 * 60));
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                        if (diffMins < 1) return 'just now';
                        if (diffMins < 60) return \`\${diffMins}m ago\`;
                        if (diffHours < 24) return \`\${diffHours}h ago\`;
                        if (diffDays < 7) return \`\${diffDays}d ago\`;
                        
                        return date.toLocaleDateString();
                    }

                    function escapeHtml(text) {
                        const div = document.createElement('div');
                        div.textContent = text;
                        return div.innerHTML;
                    }
                </script>
            </body>
            </html>`;
    }
}
