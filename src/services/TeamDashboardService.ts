import * as vscode from 'vscode';
import { ITeamDataAggregator } from '../interfaces/ITeamDataAggregator';
import { ITeamDashboardProvider } from '../interfaces/ITeamDashboardProvider';
import { SessionData } from '../models/SessionData';

/**
 * Service that coordinates team dashboard functionality
 * Manages the interaction between data aggregation and UI display
 */
export class TeamDashboardService {
  private refreshInterval?: NodeJS.Timeout;
  private static readonly REFRESH_INTERVAL_MS = 30000; // 30 seconds

  constructor(
    private teamDataAggregator: ITeamDataAggregator,
    private teamDashboardProvider: ITeamDashboardProvider,
    private outputChannel: vscode.OutputChannel
  ) {
    this.setupEventHandlers();
  }

  /**
   * Initialize the team dashboard
   */
  async initialize(): Promise<void> {
    try {
      const isAvailable = await this.teamDataAggregator.isTeamDashboardAvailable();
      
      if (!isAvailable) {
        this.outputChannel.appendLine('Team dashboard is disabled in configuration');
        return;
      }

      await this.refreshDashboard();
      this.startAutoRefresh();
      
      this.outputChannel.appendLine('Team dashboard service initialized');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to initialize team dashboard: ${error}`);
      throw error;
    }
  }

  /**
   * Refresh the dashboard data and update UI
   */
  async refreshDashboard(): Promise<void> {
    try {
      // Check if user has opted in
      const hasOptedIn = await this.teamDataAggregator.hasUserOptedIn();
      
      if (!hasOptedIn) {
        this.teamDashboardProvider.showOptInRequired();
        return;
      }

      // Check permissions
      const permissions = await this.teamDataAggregator.getUserPermissions();
      
      if (!permissions) {
        this.teamDashboardProvider.showAuthenticationRequired();
        return;
      }

      if (!permissions.canViewTeamData) {
        this.teamDashboardProvider.showPermissionDenied();
        return;
      }

      // Get and display team data
      const teamData = await this.teamDataAggregator.getTeamSessionData();
      
      if (teamData) {
        this.teamDashboardProvider.updateContent(teamData);
        this.outputChannel.appendLine(`Team dashboard updated with ${teamData.members.length} members`);
      } else {
        this.teamDashboardProvider.showPermissionDenied();
      }
    } catch (error) {
      this.outputChannel.appendLine(`Failed to refresh team dashboard: ${error}`);
      this.teamDashboardProvider.showAuthenticationRequired();
    }
  }

  /**
   * Share session data with team (if user has opted in)
   */
  async shareSessionData(sessionData: SessionData): Promise<void> {
    try {
      await this.teamDataAggregator.shareSessionData(sessionData);
      this.outputChannel.appendLine('Session data shared with team');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to share session data: ${error}`);
    }
  }

  /**
   * Handle user opt-in to team sharing
   */
  async handleOptIn(): Promise<void> {
    try {
      await this.teamDataAggregator.optInToTeamSharing();
      await this.refreshDashboard();
      this.outputChannel.appendLine('User opted in to team sharing');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to opt in to team sharing: ${error}`);
      vscode.window.showErrorMessage('Failed to opt in to team sharing');
    }
  }

  /**
   * Handle user opt-out from team sharing
   */
  async handleOptOut(): Promise<void> {
    try {
      await this.teamDataAggregator.optOutOfTeamSharing();
      this.teamDashboardProvider.showOptInRequired();
      this.outputChannel.appendLine('User opted out of team sharing');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to opt out of team sharing: ${error}`);
      vscode.window.showErrorMessage('Failed to opt out of team sharing');
    }
  }  /**
  
 * Handle authentication request
   */
  async handleAuthentication(): Promise<void> {
    try {
      // In a real implementation, this would trigger actual authentication flow
      // For now, just show a message
      const result = await vscode.window.showInformationMessage(
        'Team dashboard authentication is not yet implemented. This would typically integrate with your organization\'s authentication system.',
        'OK'
      );
      
      this.outputChannel.appendLine('Authentication requested (not implemented)');
    } catch (error) {
      this.outputChannel.appendLine(`Authentication error: ${error}`);
    }
  }

  /**
   * Start auto-refresh of dashboard data
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshDashboard();
      } catch (error) {
        this.outputChannel.appendLine(`Auto-refresh failed: ${error}`);
      }
    }, TeamDashboardService.REFRESH_INTERVAL_MS);

    this.outputChannel.appendLine('Team dashboard auto-refresh started');
  }

  /**
   * Stop auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      this.outputChannel.appendLine('Team dashboard auto-refresh stopped');
    }
  }

  /**
   * Setup event handlers for UI interactions
   */
  private setupEventHandlers(): void {
    this.teamDashboardProvider.onOptIn(async () => {
      await this.handleOptIn();
    });

    this.teamDashboardProvider.onAuthenticate(async () => {
      await this.handleAuthentication();
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopAutoRefresh();
    this.outputChannel.appendLine('Team dashboard service disposed');
  }
}