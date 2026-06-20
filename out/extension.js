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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const SessionTracker_1 = require("./services/SessionTracker");
const SidebarPanelProvider_1 = require("./providers/SidebarPanelProvider");
const AISummaryService_1 = require("./services/AISummaryService");
const TeamDashboardProvider_1 = require("./providers/TeamDashboardProvider");
const TeamDataAggregator_1 = require("./services/TeamDataAggregator");
const TeamDashboardService_1 = require("./services/TeamDashboardService");
const ConfigurationService_1 = require("./services/ConfigurationService");
const ErrorHandlingService_1 = require("./services/ErrorHandlingService");
const PerformanceMonitor_1 = require("./services/PerformanceMonitor");
const LoggingService_1 = require("./services/LoggingService");
const SessionHistoryService_1 = require("./services/SessionHistoryService");
const ExportImportService_1 = require("./services/ExportImportService");
const ProductivityCalculator_1 = require("./services/ProductivityCalculator");
const ShareApiClient_1 = require("./services/ShareApiClient");
let sessionTracker;
let sidebarProvider;
let aiSummaryService;
let teamDashboardProvider;
let teamDataAggregator;
let teamDashboardService;
let configurationService;
let errorHandlingService;
let performanceMonitor;
let outputChannel;
let sessionHistoryService;
let exportImportService;
/**
 * Extension activation function
 * Called when VS Code starts up (onStartupFinished activation event)
 */
async function activate(context) {
    const activationTimer = PerformanceMonitor_1.PerformanceMonitor.getInstance().startTimer('Extension.activate');
    try {
        // Initialize performance monitoring first
        performanceMonitor = PerformanceMonitor_1.PerformanceMonitor.getInstance();
        context.subscriptions.push(performanceMonitor);
        // Create output channel for logging
        outputChannel = vscode.window.createOutputChannel('Session Recap');
        context.subscriptions.push(outputChannel);
        // Initialize error handling service with appropriate log level
        const config = vscode.workspace.getConfiguration('sessionRecap');
        const logLevel = config.get('logLevel', 'info');
        const logLevelEnum = LoggingService_1.LogLevel[logLevel.toUpperCase()] || LoggingService_1.LogLevel.INFO;
        errorHandlingService = new ErrorHandlingService_1.ErrorHandlingService(outputChannel, logLevelEnum);
        context.subscriptions.push(errorHandlingService);
        errorHandlingService.logInfo('Extension', 'Session Recap extension is now active', true);
        // Initialize configuration service with error handling
        await errorHandlingService.executeWithErrorHandling(async () => {
            configurationService = new ConfigurationService_1.ConfigurationService();
            context.subscriptions.push(configurationService);
        }, { component: 'Extension', operation: 'initializeConfiguration' });
        // Initialize the sidebar panel provider with error handling
        await errorHandlingService.executeWithErrorHandling(async () => {
            sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(context.extensionUri);
            context.subscriptions.push(vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider));
        }, { component: 'Extension', operation: 'initializeSidebar' });
        // Initialize team dashboard components with error handling
        await errorHandlingService.executeWithErrorHandling(async () => {
            teamDashboardProvider = new TeamDashboardProvider_1.TeamDashboardProvider(context.extensionUri);
            teamDataAggregator = new TeamDataAggregator_1.TeamDataAggregator(context, configurationService, outputChannel);
            teamDashboardService = new TeamDashboardService_1.TeamDashboardService(teamDataAggregator, teamDashboardProvider, outputChannel);
            context.subscriptions.push(vscode.window.registerWebviewViewProvider('teamDashboard', teamDashboardProvider));
        }, { component: 'Extension', operation: 'initializeTeamDashboard' });
        // Initialize AI summary service with error handling
        await errorHandlingService.executeWithErrorHandling(async () => {
            aiSummaryService = new AISummaryService_1.AISummaryService(outputChannel);
        }, { component: 'Extension', operation: 'initializeAIService' });
        // Initialize session tracker with error handling
        await errorHandlingService.executeWithErrorHandling(async () => {
            sessionTracker = new SessionTracker_1.SessionTracker(context, sidebarProvider);
        }, { component: 'Extension', operation: 'initializeSessionTracker' });
        // Initialize session history service
        await errorHandlingService.executeWithErrorHandling(async () => {
            sessionHistoryService = new SessionHistoryService_1.SessionHistoryService(context);
            exportImportService = new ExportImportService_1.ExportImportService(context);
        }, { component: 'Extension', operation: 'initializeHistoryService' });
        // Set up file click handler for sidebar
        if (sidebarProvider) {
            sidebarProvider.onFileClick((filePath) => {
                openFile(filePath);
            });
        }
        // Load and display previous session data with AI summary
        await errorHandlingService.executeWithErrorHandling(async () => {
            await loadAndDisplayPreviousSession();
        }, { component: 'Extension', operation: 'loadPreviousSession' });
        // Initialize team dashboard
        await errorHandlingService.executeWithErrorHandling(async () => {
            await initializeTeamDashboard();
        }, { component: 'Extension', operation: 'initializeTeamDashboard' });
        // Start tracking the new session
        if (sessionTracker) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                sessionTracker.startTracking();
            }, { component: 'Extension', operation: 'startTracking' });
        }
        // Register commands
        registerCommands(context);
        errorHandlingService.logInfo('Extension', 'Session Recap extension initialization complete', true);
        // Complete activation timing
        const activationDuration = activationTimer.end();
        errorHandlingService.logInfo('Extension', `Activation completed in ${activationDuration.toFixed(2)}ms`);
        // Log performance summary if activation was slow
        if (activationDuration > 500) {
            performanceMonitor.logPerformanceSummary();
        }
    }
    catch (error) {
        const errorMessage = `Failed to activate Session Recap extension: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
        if (outputChannel) {
            outputChannel.appendLine(`Activation Error: ${errorMessage}`);
        }
        if (errorHandlingService) {
            errorHandlingService.getErrorHandler().showUserError('Session Recap extension failed to start. Some features may not work correctly.', ['Show Logs', 'Retry']);
        }
    }
}
exports.activate = activate;
/**
 * Extension deactivation function
 * Called when VS Code is shutting down
 */
async function deactivate() {
    if (errorHandlingService) {
        errorHandlingService.logInfo('Extension', 'Session Recap extension is deactivating');
    }
    try {
        if (sessionTracker && errorHandlingService) {
            // Save current session before deactivation with error handling
            await errorHandlingService.executeWithErrorHandling(async () => {
                const currentSession = sessionTracker.getCurrentSession();
                await sessionTracker.saveSession();
                // Share session data with team if enabled
                if (teamDashboardService && currentSession) {
                    await teamDashboardService.shareSessionData(currentSession);
                }
            }, { component: 'Extension', operation: 'saveSessionOnDeactivate' }, undefined // no fallback value needed
            );
            // Stop tracking
            sessionTracker.stopTracking();
            // Dispose of session tracker if it has a dispose method
            if ('dispose' in sessionTracker) {
                sessionTracker.dispose();
            }
        }
        // Dispose team dashboard service
        if (teamDashboardService) {
            teamDashboardService.dispose();
        }
        // Log final performance summary
        if (performanceMonitor) {
            performanceMonitor.logPerformanceSummary();
            performanceMonitor.dispose();
        }
        // Dispose error handling service last
        if (errorHandlingService) {
            errorHandlingService.logInfo('Extension', 'Session Recap extension deactivated');
            errorHandlingService.dispose();
        }
        if (outputChannel) {
            outputChannel.appendLine('Session Recap extension deactivated');
        }
    }
    catch (error) {
        console.error('Error during extension deactivation:', error);
        if (errorHandlingService) {
            errorHandlingService.getLoggingService().error('Extension', 'Deactivation error', error, {
                component: 'Extension',
                operation: 'deactivate'
            });
        }
    }
}
exports.deactivate = deactivate;
/**
 * Load and display previous session data with AI summary
 */
async function loadAndDisplayPreviousSession() {
    if (!errorHandlingService) {
        console.error('Error handling service not initialized');
        return;
    }
    await errorHandlingService.executeWithErrorHandling(async () => {
        errorHandlingService.logInfo('Extension', 'Loading previous session data...');
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
        if (previousSession) {
            errorHandlingService.logInfo('Extension', `Previous session found: ${previousSession.sessionId}`);
            // Generate AI summary if not already present and AI is enabled
            if (!previousSession.summary && aiSummaryService.isAvailable()) {
                await errorHandlingService.executeWithErrorHandling(async () => {
                    errorHandlingService.logInfo('Extension', 'Generating AI summary for previous session...');
                    const aiSummary = await aiSummaryService.generateSummary(previousSession);
                    previousSession.summary = aiSummary;
                    errorHandlingService.logInfo('Extension', 'AI summary generated successfully');
                }, { component: 'Extension', operation: 'generateAISummary' }, undefined // Will use fallback from error handler
                );
                // If AI summary failed, generate fallback
                if (!previousSession.summary) {
                    previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                    errorHandlingService.logInfo('Extension', 'Using fallback summary after AI failure');
                }
            }
            else if (!previousSession.summary) {
                // Generate fallback summary if AI is not available
                previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                errorHandlingService.logInfo('Extension', 'Generated fallback summary (AI disabled)');
            }
            // Update sidebar with previous session data
            sidebarProvider.updateContent(previousSession);
            errorHandlingService.logInfo('Extension', 'Previous session displayed in sidebar');
        }
        else {
            // Show welcome message for first-time users
            const welcomeSession = {
                sessionId: 'welcome',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Welcome to Session Recap! This is your first session. Start coding and your activity will be tracked here.'
            };
            sidebarProvider.updateContent(welcomeSession);
            errorHandlingService.logInfo('Extension', 'No previous session found, showing welcome message');
        }
    }, { component: 'Extension', operation: 'loadPreviousSession' });
}
/**
 * Open a file in the VS Code editor
 */
async function openFile(filePath) {
    if (!errorHandlingService) {
        console.error('Error handling service not initialized');
        return;
    }
    await errorHandlingService.executeWithErrorHandling(async () => {
        // Convert relative path to absolute if needed
        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                absolutePath = path.join(workspaceFolder.uri.fsPath, filePath);
            }
        }
        const uri = vscode.Uri.file(absolutePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        errorHandlingService.logInfo('Extension', `Opened file: ${filePath}`);
    }, {
        component: 'Extension',
        operation: 'openFile',
        additionalData: { filePath }
    });
}
/**
 * Initialize team dashboard
 */
async function initializeTeamDashboard() {
    if (!errorHandlingService) {
        console.error('Error handling service not initialized');
        return;
    }
    await errorHandlingService.executeWithErrorHandling(async () => {
        if (teamDashboardService) {
            await teamDashboardService.initialize();
            errorHandlingService.logInfo('Extension', 'Team dashboard initialized');
        }
    }, { component: 'Extension', operation: 'initializeTeamDashboard' }, undefined // No fallback needed - team dashboard is optional
    );
}
/**
 * Register extension commands
 */
function registerCommands(context) {
    // Command to manually refresh the session recap
    const refreshCommand = vscode.commands.registerCommand('sessionRecap.refresh', async () => {
        if (errorHandlingService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                errorHandlingService.logInfo('Extension', 'Manual refresh requested');
                await loadAndDisplayPreviousSession();
                errorHandlingService.getErrorHandler().showUserInfo('Session recap refreshed');
            }, { component: 'Extension', operation: 'manualRefresh' });
        }
    });
    // Command to clear current session data
    const clearCommand = vscode.commands.registerCommand('sessionRecap.clear', async () => {
        if (errorHandlingService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                sessionTracker.reset();
                errorHandlingService.logInfo('Extension', 'Session data cleared');
                errorHandlingService.getErrorHandler().showUserInfo('Session data cleared');
            }, { component: 'Extension', operation: 'clearSession' });
        }
    });
    // Command to refresh team dashboard
    const refreshTeamCommand = vscode.commands.registerCommand('sessionRecap.refreshTeam', async () => {
        if (errorHandlingService && teamDashboardService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                await teamDashboardService.refreshDashboard();
                errorHandlingService.getErrorHandler().showUserInfo('Team dashboard refreshed');
            }, { component: 'Extension', operation: 'refreshTeamDashboard' });
        }
    });
    // Command to opt in to team sharing
    const optInCommand = vscode.commands.registerCommand('sessionRecap.optInTeam', async () => {
        if (errorHandlingService && teamDashboardService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                await teamDashboardService.handleOptIn();
            }, { component: 'Extension', operation: 'optInTeamSharing' });
        }
    });
    // Command to opt out of team sharing
    const optOutCommand = vscode.commands.registerCommand('sessionRecap.optOutTeam', async () => {
        if (errorHandlingService && teamDashboardService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                await teamDashboardService.handleOptOut();
            }, { component: 'Extension', operation: 'optOutTeamSharing' });
        }
    });
    // Command to show output channel
    const showLogsCommand = vscode.commands.registerCommand('sessionRecap.showLogs', () => {
        if (errorHandlingService) {
            errorHandlingService.showLogs();
        }
        else {
            outputChannel.show();
        }
    });
    // Command to show telemetry summary
    const showTelemetryCommand = vscode.commands.registerCommand('sessionRecap.showTelemetry', () => {
        if (errorHandlingService) {
            const summary = errorHandlingService.getTelemetrySummary();
            const summaryText = JSON.stringify(summary, null, 2);
            vscode.workspace.openTextDocument({
                content: summaryText,
                language: 'json'
            }).then(doc => {
                vscode.window.showTextDocument(doc);
            });
            errorHandlingService.logInfo('Extension', 'Telemetry summary displayed');
        }
    });
    // Command to set log level
    const setLogLevelCommand = vscode.commands.registerCommand('sessionRecap.setLogLevel', async () => {
        if (errorHandlingService) {
            const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const selected = await vscode.window.showQuickPick(levels, {
                placeHolder: 'Select log level'
            });
            if (selected) {
                const logLevel = LoggingService_1.LogLevel[selected];
                errorHandlingService.setLogLevel(logLevel);
                errorHandlingService.getErrorHandler().showUserInfo(`Log level set to ${selected}`);
            }
        }
    });
    // Command to view session history
    const viewHistoryCommand = vscode.commands.registerCommand('sessionRecap.viewHistory', async () => {
        if (errorHandlingService && sessionHistoryService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                const sessions = await sessionHistoryService.getAllSessions();
                if (sessions.length === 0) {
                    vscode.window.showInformationMessage('No session history available');
                    return;
                }
                const items = sessions.map(session => ({
                    label: `${session.startTime.toLocaleDateString()} ${session.startTime.toLocaleTimeString()}`,
                    description: `${session.editedFiles.length} files, ${session.gitCommits.length} commits`,
                    detail: session.summary || 'No summary available',
                    sessionId: session.sessionId
                }));
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a session to view'
                });
                if (selected) {
                    const session = sessions.find(s => s.sessionId === selected.sessionId);
                    if (session) {
                        sidebarProvider.updateContent(session);
                    }
                }
            }, { component: 'Extension', operation: 'viewHistory' });
        }
    });
    // Command to view analytics
    const viewAnalyticsCommand = vscode.commands.registerCommand('sessionRecap.viewAnalytics', async () => {
        if (errorHandlingService && sessionHistoryService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                const stats = await sessionHistoryService.getSessionStatistics();
                const avgDuration = Math.round(stats.averageSessionDuration / 60000);
                const totalHours = Math.round(stats.totalDuration / (1000 * 60 * 60));
                const content = `# Session Analytics

## Overview
- **Total Sessions**: ${stats.totalSessions}
- **Total Time**: ${totalHours} hours
- **Total Files Edited**: ${stats.totalFilesEdited}
- **Total Commits**: ${stats.totalCommits}
- **Total Errors**: ${stats.totalErrors}

## Averages
- **Average Session Duration**: ${avgDuration} minutes
- **Average Files per Session**: ${stats.averageFilesPerSession.toFixed(1)}
- **Average Commits per Session**: ${stats.averageCommitsPerSession.toFixed(1)}

## Insights
- **Most Active Day**: ${stats.mostActiveDay || 'N/A'}
- **Longest Session**: ${stats.longestSession ? ProductivityCalculator_1.ProductivityCalculator.formatDuration(stats.longestSession) : 'N/A'}
- **Shortest Session**: ${stats.shortestSession ? ProductivityCalculator_1.ProductivityCalculator.formatDuration(stats.shortestSession) : 'N/A'}
`;
                const doc = await vscode.workspace.openTextDocument({
                    content: content,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }, { component: 'Extension', operation: 'viewAnalytics' });
        }
    });
    // Command to export sessions
    const exportSessionsCommand = vscode.commands.registerCommand('sessionRecap.exportSessions', async () => {
        if (errorHandlingService && sessionHistoryService && exportImportService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                const format = await vscode.window.showQuickPick(['JSON', 'CSV'], {
                    placeHolder: 'Select export format'
                });
                if (!format)
                    return;
                const sessions = await sessionHistoryService.getAllSessions();
                if (sessions.length === 0) {
                    vscode.window.showInformationMessage('No sessions to export');
                    return;
                }
                try {
                    const filePath = format === 'JSON'
                        ? await exportImportService.exportToJSON(sessions)
                        : await exportImportService.exportToCSV(sessions);
                    vscode.window.showInformationMessage(`Sessions exported to ${filePath}`);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }, { component: 'Extension', operation: 'exportSessions' });
        }
    });
    // Command to import sessions
    const importSessionsCommand = vscode.commands.registerCommand('sessionRecap.importSessions', async () => {
        if (errorHandlingService && exportImportService && sessionTracker) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                try {
                    const sessions = await exportImportService.importFromJSON();
                    if (sessions.length === 0) {
                        vscode.window.showInformationMessage('No sessions found in import file');
                        return;
                    }
                    const confirm = await vscode.window.showWarningMessage(`Import ${sessions.length} session(s)?`, 'Yes', 'No');
                    if (confirm === 'Yes') {
                        // Save imported sessions
                        for (const session of sessions) {
                            await sessionTracker['sessionStorage'].saveSession(session);
                        }
                        vscode.window.showInformationMessage(`Imported ${sessions.length} session(s) successfully`);
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }, { component: 'Extension', operation: 'importSessions' });
        }
    });
    // Command to add notes to current session
    const addNotesCommand = vscode.commands.registerCommand('sessionRecap.addNotes', async () => {
        if (errorHandlingService && sessionTracker) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                const currentSession = sessionTracker.getCurrentSession();
                const existingNotes = currentSession.notes || '';
                const notes = await vscode.window.showInputBox({
                    prompt: 'Add notes to this session',
                    value: existingNotes,
                    placeHolder: 'Enter your notes...'
                });
                if (notes !== undefined) {
                    currentSession.notes = notes;
                    // Update session in storage
                    await sessionTracker['sessionStorage'].saveSession(currentSession);
                    sidebarProvider.updateContent(currentSession);
                    vscode.window.showInformationMessage('Notes added to session');
                }
            }, { component: 'Extension', operation: 'addNotes' });
        }
    });
    // Command to add tags to current session
    const addTagsCommand = vscode.commands.registerCommand('sessionRecap.addTags', async () => {
        if (errorHandlingService && sessionTracker && sessionHistoryService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                const currentSession = sessionTracker.getCurrentSession();
                const existingTags = currentSession.tags || [];
                const allTags = await sessionHistoryService.getAllTags();
                const tagInput = await vscode.window.showInputBox({
                    prompt: 'Add tags (comma-separated)',
                    value: existingTags.join(', '),
                    placeHolder: 'e.g., feature, bugfix, refactor'
                });
                if (tagInput !== undefined) {
                    const tags = tagInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
                    currentSession.tags = tags;
                    // Update session in storage
                    await sessionTracker['sessionStorage'].saveSession(currentSession);
                    sidebarProvider.updateContent(currentSession);
                    vscode.window.showInformationMessage(`Tags added: ${tags.join(', ')}`);
                }
            }, { component: 'Extension', operation: 'addTags' });
        }
    });
    // Command to search sessions
    const searchSessionsCommand = vscode.commands.registerCommand('sessionRecap.searchSessions', async () => {
        if (errorHandlingService && sessionHistoryService) {
            await errorHandlingService.executeWithErrorHandling(async () => {
                const query = await vscode.window.showInputBox({
                    prompt: 'Search sessions',
                    placeHolder: 'Enter search query...'
                });
                if (query) {
                    const results = await sessionHistoryService.searchSessions(query);
                    if (results.length === 0) {
                        vscode.window.showInformationMessage('No sessions found');
                        return;
                    }
                    const items = results.map(session => ({
                        label: `${session.startTime.toLocaleDateString()} ${session.startTime.toLocaleTimeString()}`,
                        description: `${session.editedFiles.length} files, ${session.gitCommits.length} commits`,
                        detail: session.summary || 'No summary available',
                        sessionId: session.sessionId
                    }));
                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: `Found ${results.length} session(s)`
                    });
                    if (selected) {
                        const session = results.find(s => s.sessionId === selected.sessionId);
                        if (session) {
                            sidebarProvider.updateContent(session);
                        }
                    }
                }
            }, { component: 'Extension', operation: 'searchSessions' });
        }
    });
    const openDashboardCommand = vscode.commands.registerCommand('sessionRecap.openDashboard', async () => {
        const apiUrl = ShareApiClient_1.ShareApiClient.getApiBaseUrl();
        if (!apiUrl) {
            vscode.window.showWarningMessage('Set sessionRecap.shareApiUrl in settings to open the public feed.');
            return;
        }
        await vscode.env.openExternal(vscode.Uri.parse(apiUrl));
    });
    context.subscriptions.push(refreshCommand, clearCommand, refreshTeamCommand, optInCommand, optOutCommand, showLogsCommand, showTelemetryCommand, setLogLevelCommand, viewHistoryCommand, viewAnalyticsCommand, exportSessionsCommand, importSessionsCommand, addNotesCommand, addTagsCommand, searchSessionsCommand, openDashboardCommand);
}
//# sourceMappingURL=extension.js.map