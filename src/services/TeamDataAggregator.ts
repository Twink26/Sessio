import * as vscode from 'vscode';
import * as cp from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { ITeamDataAggregator, TeamMember, TeamSessionData, TeamMemberSession, TeamDataPermissions } from '../interfaces/ITeamDataAggregator';
import { SessionData } from '../models/SessionData';
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { ShareApiClient, SharedSessionEntry } from './ShareApiClient';

const exec = promisify(cp.exec);

/**
 * Aggregates real shared session data via the public Session Recap API.
 * No mock teammates — only opt-in submissions from real users.
 */
export class TeamDataAggregator implements ITeamDataAggregator {
  private static readonly TEAM_OPT_IN_KEY = 'sessionRecap.teamOptIn';
  private static readonly CONTRIBUTOR_ID_KEY = 'sessionRecap.contributorId';

  constructor(
    private context: vscode.ExtensionContext,
    private configService: IConfigurationService,
    private outputChannel: vscode.OutputChannel
  ) {}

  async hasUserOptedIn(): Promise<boolean> {
    const optInStatus = this.context.globalState.get<boolean>(TeamDataAggregator.TEAM_OPT_IN_KEY, false);
    const config = this.configService.getConfiguration();

    return optInStatus && config.enableTeamDashboard && config.privacySettings.shareWithTeam;
  }

  async optInToTeamSharing(): Promise<void> {
    try {
      await this.ensureContributorId();
      await this.context.globalState.update(TeamDataAggregator.TEAM_OPT_IN_KEY, true);
      await this.configService.updateConfiguration('privacySettings.shareWithTeam', true);
      await this.configService.updateConfiguration('enableTeamDashboard', true);

      const apiUrl = ShareApiClient.getApiBaseUrl();
      this.outputChannel.appendLine('User opted in to public session sharing');
      vscode.window.showInformationMessage(
        apiUrl
          ? `You opted in. Session summaries will be posted to ${apiUrl} when sessions end.`
          : 'You opted in to sharing. Set sessionRecap.shareApiUrl to enable the public feed.'
      );
    } catch (error) {
      this.outputChannel.appendLine(`Failed to opt in to team sharing: ${error}`);
      throw new Error('Failed to opt in to team data sharing');
    }
  }

  async optOutOfTeamSharing(): Promise<void> {
    try {
      await this.context.globalState.update(TeamDataAggregator.TEAM_OPT_IN_KEY, false);
      await this.configService.updateConfiguration('privacySettings.shareWithTeam', false);

      this.outputChannel.appendLine('User opted out of public session sharing');
      vscode.window.showInformationMessage('You opted out. Future sessions will not be posted to the public feed.');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to opt out of team sharing: ${error}`);
      throw new Error('Failed to opt out of team data sharing');
    }
  }

  async getUserPermissions(): Promise<TeamDataPermissions | null> {
    const hasOptedIn = await this.hasUserOptedIn();
    if (!hasOptedIn) {
      return null;
    }

    return {
      canViewTeamData: true,
      canViewMemberDetails: true,
      isTeamLead: false,
      teamId: 'public-feed'
    };
  }

  async getTeamSessionData(): Promise<TeamSessionData | null> {
    const permissions = await this.getUserPermissions();
    if (!permissions?.canViewTeamData) {
      return null;
    }

    const apiUrl = ShareApiClient.getApiBaseUrl();
    if (!apiUrl) {
      this.outputChannel.appendLine('Share API URL not configured');
      return null;
    }

    try {
      const response = await ShareApiClient.fetchSharedSessions();
      const members = response.sessions.map((entry) => this.entryToMemberSession(entry));

      return {
        teamId: permissions.teamId,
        members,
        aggregatedAt: new Date(response.aggregatedAt)
      };
    } catch (error) {
      this.outputChannel.appendLine(`Failed to fetch shared sessions: ${error}`);
      return null;
    }
  }

  async shareSessionData(sessionData: SessionData): Promise<void> {
    const hasOptedIn = await this.hasUserOptedIn();
    if (!hasOptedIn) {
      this.outputChannel.appendLine('User has not opted in to sharing, skipping POST');
      return;
    }

    const apiUrl = ShareApiClient.getApiBaseUrl();
    if (!apiUrl) {
      this.outputChannel.appendLine('Share API URL not configured, skipping POST');
      return;
    }

    try {
      const filteredData = await this.filterSessionDataForSharing(sessionData);
      if (!filteredData.summary) {
        filteredData.summary = 'Session completed (summary pending)';
      }

      const contributorId = await this.ensureContributorId();
      const displayName = await this.getDisplayName();

      await ShareApiClient.submitSession(contributorId, displayName, filteredData);
      this.outputChannel.appendLine(`Session shared to public feed at ${apiUrl}`);
    } catch (error) {
      this.outputChannel.appendLine(`Failed to share session data: ${error}`);
      throw new Error('Failed to share session data with public feed');
    }
  }

  async isTeamDashboardAvailable(): Promise<boolean> {
    const config = this.configService.getConfiguration();
    return config.enableTeamDashboard;
  }

  private entryToMemberSession(entry: SharedSessionEntry): TeamMemberSession {
    const sessionData: SessionData = {
      sessionId: entry.session.sessionId,
      startTime: new Date(entry.session.startTime),
      endTime: entry.session.endTime ? new Date(entry.session.endTime) : undefined,
      summary: entry.session.summary,
      editedFiles: entry.session.editedFiles.map((file) => ({
        filePath: file.filePath,
        timestamp: new Date(entry.submittedAt),
        changeType: file.changeType as 'created' | 'modified' | 'deleted',
        lineCount: file.lineCount
      })),
      gitCommits: entry.session.gitCommits.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        timestamp: new Date(entry.submittedAt),
        filesChanged: []
      })),
      terminalErrors: entry.session.terminalErrors.map((error) => ({
        message: error.message,
        timestamp: new Date(entry.submittedAt),
        terminalName: 'terminal',
        errorType: error.errorType as 'error' | 'exception' | 'failure'
      })),
      tags: entry.session.tags,
      notes: entry.session.notes,
      productivityScore: entry.session.productivityScore
    };

    return {
      member: {
        id: entry.contributorId,
        name: entry.displayName,
        email: '',
        isOnline: Date.now() - new Date(entry.submittedAt).getTime() < 60 * 60 * 1000,
        lastActive: new Date(entry.submittedAt)
      },
      sessionData,
      hasOptedIn: true,
      lastUpdated: new Date(entry.submittedAt)
    };
  }

  private async filterSessionDataForSharing(sessionData: SessionData): Promise<SessionData> {
    const config = this.configService.getConfiguration();
    const { excludeFilePatterns, excludeCommitPatterns } = config.privacySettings;

    const filteredFiles = sessionData.editedFiles.filter(
      (file) => !this.matchesPatterns(file.filePath, excludeFilePatterns)
    );

    const filteredCommits = sessionData.gitCommits.filter(
      (commit) => !this.matchesPatterns(commit.message, excludeCommitPatterns)
    );

    return {
      ...sessionData,
      editedFiles: filteredFiles,
      gitCommits: filteredCommits,
      terminalErrors: sessionData.terminalErrors
    };
  }

  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(text);
      }
      return text.includes(pattern);
    });
  }

  private async ensureContributorId(): Promise<string> {
    let contributorId = this.context.globalState.get<string>(TeamDataAggregator.CONTRIBUTOR_ID_KEY);
    if (!contributorId) {
      contributorId = uuidv4();
      await this.context.globalState.update(TeamDataAggregator.CONTRIBUTOR_ID_KEY, contributorId);
    }
    return contributorId;
  }

  private async getDisplayName(): Promise<string> {
    const override = vscode.workspace
      .getConfiguration('sessionRecap')
      .get<string>('contributorDisplayName', '')
      .trim();

    if (override) {
      return override.slice(0, 80);
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      try {
        const { stdout } = await exec('git config user.name', { cwd: workspaceRoot, timeout: 3000 });
        const name = stdout?.trim();
        if (name) {
          return name.slice(0, 80);
        }
      } catch {
        // fall through
      }
    }

    return 'Anonymous Developer';
  }
}
