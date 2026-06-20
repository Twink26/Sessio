import { ITeamDashboardProvider } from '../interfaces/ITeamDashboardProvider';

import * as vscode from 'vscode';
/**
 * Manages the VS Code webview panel for displaying team dashboard
 */
export class TeamDashboardProvider implements ITeamDashboardProvider, vscode.WebviewViewProvider {
    public static readonly viewType = 'teamDashboard';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _optInCallback?: () => void;
    private _authenticateCallback?: () => void;
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
                case 'optIn':
                    if (this._optInCallback) {
                        this._optInCallback();
                    }
                    break;
                case 'authenticate':
                    if (this._authenticateCallback) {
                        this._authenticateCallback();
                    }
                    break;
                case 'memberClick':
                    // Show member details in VS Code information message
                    vscode.window.showInformationMessage(`Team Member: ${data.memberName}`, { modal: false, detail: `Last active: ${data.lastActive}\nStatus: ${data.isOnline ? 'Online' : 'Offline'}` });
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
    updateContent(teamData: import('../interfaces/ITeamDataAggregator').TeamSessionData) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'updateTeamData', teamData });
        }
    }
    showAuthenticationRequired() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'showAuthRequired' });
        }
    }
    showPermissionDenied() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'showPermissionDenied' });
        }
    }
    showOptInRequired() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'showOptInRequired' });
        }
    }
    onOptIn(callback: () => void) {
        this._optInCallback = callback;
    }
    onAuthenticate(callback: () => void) {
        this._authenticateCallback = callback;
    }
    _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Team Dashboard</title>
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

                    .header {
                        margin-bottom: 20px;
                        padding-bottom: 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }

                    .header-title {
                        font-weight: 600;
                        font-size: 16px;
                        color: var(--vscode-textLink-foreground);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 4px;
                    }

                    .header-subtitle {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .team-member {
                        margin-bottom: 16px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        overflow: hidden;
                        background-color: var(--vscode-input-background);
                    }

                    .member-header {
                        padding: 12px;
                        background-color: var(--vscode-textBlockQuote-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        transition: background-color 0.1s ease;
                    }

                    .member-header:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .member-info {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .member-avatar {
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background-color: var(--vscode-textLink-foreground);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--vscode-editor-background);
                        font-weight: 600;
                        font-size: 12px;
                    }

                    .member-details {
                        flex: 1;
                    }

                    .member-name {
                        font-weight: 600;
                        font-size: 14px;
                    }

                    .member-status {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 2px;
                    }

                    .status-indicator {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        display: inline-block;
                        margin-right: 4px;
                    }

                    .status-online {
                        background-color: var(--vscode-gitDecoration-addedResourceForeground);
                    }

                    .status-offline {
                        background-color: var(--vscode-descriptionForeground);
                    }

                    .opt-in-status {
                        font-size: 10px;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-weight: 600;
                        text-transform: uppercase;
                    }

                    .opted-in {
                        background-color: var(--vscode-gitDecoration-addedResourceForeground);
                        color: var(--vscode-editor-background);
                    }

                    .not-opted-in {
                        background-color: var(--vscode-inputValidation-warningBackground);
                        color: var(--vscode-inputValidation-warningForeground);
                    }

                    .member-session {
                        padding: 12px;
                    }

                    .session-summary {
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 3px solid var(--vscode-textLink-foreground);
                        padding: 8px 12px;
                        margin-bottom: 12px;
                        border-radius: 0 4px 4px 0;
                        font-style: italic;
                        font-size: 13px;
                        line-height: 1.4;
                    }

                    .session-stats {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 8px;
                        margin-bottom: 8px;
                    }

                    .stat-item {
                        text-align: center;
                        padding: 6px;
                        background-color: var(--vscode-editor-background);
                        border-radius: 4px;
                        border: 1px solid var(--vscode-panel-border);
                    }

                    .stat-number {
                        font-weight: 600;
                        font-size: 16px;
                        color: var(--vscode-textLink-foreground);
                    }

                    .stat-label {
                        font-size: 10px;
                        color: var(--vscode-descriptionForeground);
                        text-transform: uppercase;
                        margin-top: 2px;
                    }

                    .no-data {
                        text-align: center;
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                        padding: 20px;
                        background-color: var(--vscode-input-background);
                        border-radius: 4px;
                        border: 1px dashed var(--vscode-panel-border);
                    }

                    .message-state {
                        text-align: center;
                        padding: 24px;
                        background: linear-gradient(135deg, var(--vscode-textBlockQuote-background), var(--vscode-input-background));
                        border-radius: 8px;
                        border: 1px solid var(--vscode-panel-border);
                    }

                    .message-icon {
                        font-size: 48px;
                        margin-bottom: 16px;
                        opacity: 0.6;
                    }

                    .message-title {
                        font-size: 16px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: var(--vscode-textLink-foreground);
                    }

                    .message-text {
                        color: var(--vscode-descriptionForeground);
                        line-height: 1.4;
                        margin-bottom: 16px;
                    }

                    .action-button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        transition: background-color 0.1s ease;
                    }

                    .action-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
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
                        
                        .session-stats {
                            grid-template-columns: 1fr;
                        }
                        
                        .member-header {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 8px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="header-title">
                            👥 Team Dashboard
                        </div>
                        <div class="header-subtitle">Real opt-in session summaries from the public feed</div>
                    </div>
                    
                    <div id="content">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div>Loading team data...</div>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateTeamData':
                                updateTeamDisplay(message.teamData);
                                break;
                            case 'showAuthRequired':
                                showAuthenticationRequired();
                                break;
                            case 'showPermissionDenied':
                                showPermissionDenied();
                                break;
                            case 'showOptInRequired':
                                showOptInRequired();
                                break;
                        }
                    });

                    function updateTeamDisplay(teamData) {
                        const content = document.getElementById('content');
                        
                        if (!teamData || !teamData.members || teamData.members.length === 0) {
                            content.innerHTML = \`
                                <div class="no-data">
                                    <div>No team data available</div>
                                </div>
                            \`;
                            return;
                        }

                        let html = '';

                        teamData.members.forEach(memberSession => {
                            const member = memberSession.member;
                            const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
                            const statusClass = member.isOnline ? 'status-online' : 'status-offline';
                            const statusText = member.isOnline ? 'Online' : 'Offline';
                            const optInClass = memberSession.hasOptedIn ? 'opted-in' : 'not-opted-in';
                            const optInText = memberSession.hasOptedIn ? 'Sharing' : 'Private';
                            
                            html += \`
                                <div class="team-member">
                                    <div class="member-header" onclick="showMemberDetails('\${escapeHtml(member.name)}', '\${formatTimestamp(member.lastActive)}', \${member.isOnline})">
                                        <div class="member-info">
                                            <div class="member-avatar">\${initials}</div>
                                            <div class="member-details">
                                                <div class="member-name">\${escapeHtml(member.name)}</div>
                                                <div class="member-status">
                                                    <span class="status-indicator \${statusClass}"></span>
                                                    \${statusText} • \${formatTimestamp(member.lastActive)}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="opt-in-status \${optInClass}">\${optInText}</div>
                                    </div>
                                    
                                    <div class="member-session">
                                        \${renderMemberSession(memberSession)}
                                    </div>
                                </div>
                            \`;
                        });

                        content.innerHTML = html;
                    }

                    function renderMemberSession(memberSession) {
                        if (!memberSession.hasOptedIn) {
                            return \`
                                <div class="no-data">
                                    Member has not opted in to data sharing
                                </div>
                            \`;
                        }

                        if (!memberSession.sessionData) {
                            return \`
                                <div class="no-data">
                                    No session data available
                                </div>
                            \`;
                        }

                        const session = memberSession.sessionData;
                        const filesCount = session.editedFiles ? session.editedFiles.length : 0;
                        const commitsCount = session.gitCommits ? session.gitCommits.length : 0;
                        const errorsCount = session.terminalErrors ? session.terminalErrors.length : 0;

                        return \`
                            \${session.summary ? \`<div class="session-summary">\${escapeHtml(session.summary)}</div>\` : ''}
                            
                            <div class="session-stats">
                                <div class="stat-item">
                                    <div class="stat-number">\${filesCount}</div>
                                    <div class="stat-label">Files</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">\${commitsCount}</div>
                                    <div class="stat-label">Commits</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">\${errorsCount}</div>
                                    <div class="stat-label">Errors</div>
                                </div>
                            </div>
                            
                            <div class="timestamp">
                                Last updated: \${formatTimestamp(memberSession.lastUpdated)}
                            </div>
                        \`;
                    }

                    function showAuthenticationRequired() {
                        const content = document.getElementById('content');
                        content.innerHTML = \`
                            <div class="message-state">
                                <div class="message-icon">🔐</div>
                                <div class="message-title">Authentication Required</div>
                                <div class="message-text">Please authenticate to access team dashboard features.</div>
                                <button class="action-button" onclick="authenticate()">Authenticate</button>
                            </div>
                        \`;
                    }

                    function showPermissionDenied() {
                        const content = document.getElementById('content');
                        content.innerHTML = \`
                            <div class="message-state">
                                <div class="message-icon">🚫</div>
                                <div class="message-title">Access Denied</div>
                                <div class="message-text">You don't have permission to view team dashboard data.</div>
                            </div>
                        \`;
                    }

                    function showOptInRequired() {
                        const content = document.getElementById('content');
                        content.innerHTML = \`
                            <div class="message-state">
                                <div class="message-icon">👥</div>
                                <div class="message-title">Share your sessions publicly</div>
                                <div class="message-text">Opt in to post your real session summaries to the public Session Recap feed. No fake teammates — only submissions from people who choose to share.</div>
                                <button class="action-button" onclick="optIn()">Opt In to Public Sharing</button>
                            </div>
                        \`;
                    }

                    function showMemberDetails(memberName, lastActive, isOnline) {
                        vscode.postMessage({
                            type: 'memberClick',
                            memberName: memberName,
                            lastActive: lastActive,
                            isOnline: isOnline
                        });
                    }

                    function optIn() {
                        vscode.postMessage({
                            type: 'optIn'
                        });
                    }

                    function authenticate() {
                        vscode.postMessage({
                            type: 'authenticate'
                        });
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
