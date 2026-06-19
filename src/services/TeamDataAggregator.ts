import * as vscode from 'vscode';
import { ITeamDataAggregator, TeamMember, TeamSessionData, TeamMemberSession, TeamDataPermissions } from '../interfaces/ITeamDataAggregator';
import { SessionData } from '../models/SessionData';
import { IConfigurationService } from '../interfaces/IConfigurationService';

/**
 * Service for aggregating and managing team session data
 * This is a basic implementation that simulates team functionality
 * In a real implementation, this would integrate with actual team services
 */
export class TeamDataAggregator implements ITeamDataAggregator {
  private static readonly TEAM_OPT_IN_KEY = 'sessionRecap.teamOptIn';
  private static readonly TEAM_DATA_KEY = 'sessionRecap.teamData';
  
  constructor(
    private context: vscode.ExtensionContext,
    private configService: IConfigurationService,
    private outputChannel: vscode.OutputChannel
  ) {}

  async hasUserOptedIn(): Promise<boolean> {
    const optInStatus = this.context.globalState.get<boolean>(TeamDataAggregator.TEAM_OPT_IN_KEY, false);
    const config = this.configService.getConfiguration();
    
    // User must have both opted in and enabled team dashboard in settings
    return optInStatus && config.enableTeamDashboard && config.privacySettings.shareWithTeam;
  }

  async optInToTeamSharing(): Promise<void> {
    try {
      await this.context.globalState.update(TeamDataAggregator.TEAM_OPT_IN_KEY, true);
      
      // Also update configuration to enable team sharing
      await this.configService.updateConfiguration('privacySettings.shareWithTeam', true);
      await this.configService.updateConfiguration('enableTeamDashboard', true);
      
      this.outputChannel.appendLine('User opted in to team data sharing');
      vscode.window.showInformationMessage('Successfully opted in to team data sharing');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to opt in to team sharing: ${error}`);
      throw new Error('Failed to opt in to team data sharing');
    }
  }

  async optOutOfTeamSharing(): Promise<void> {
    try {
      await this.context.globalState.update(TeamDataAggregator.TEAM_OPT_IN_KEY, false);
      
      // Update configuration to disable team sharing
      await this.configService.updateConfiguration('privacySettings.shareWithTeam', false);
      
      this.outputChannel.appendLine('User opted out of team data sharing');
      vscode.window.showInformationMessage('Successfully opted out of team data sharing');
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

    // In a real implementation, this would check with actual team service
    // For now, simulate basic permissions
    const mockTeamId = this.getMockTeamId();
    
    return {
      canViewTeamData: true,
      canViewMemberDetails: true,
      isTeamLead: false, // Could be determined by actual team service
      teamId: mockTeamId
    };
  }

  async getTeamSessionData(): Promise<TeamSessionData | null> {
    const permissions = await this.getUserPermissions();
    
    if (!permissions || !permissions.canViewTeamData) {
      return null;
    }

    try {
      // In a real implementation, this would fetch from team service
      // For now, return mock data with current user and simulated team members
      const mockMembers = await this.getMockTeamMembers();
      
      return {
        teamId: permissions.teamId,
        members: mockMembers,
        aggregatedAt: new Date()
      };
    } catch (error) {
      this.outputChannel.appendLine(`Failed to get team session data: ${error}`);
      return null;
    }
  }

  async shareSessionData(sessionData: SessionData): Promise<void> {
    const hasOptedIn = await this.hasUserOptedIn();
    
    if (!hasOptedIn) {
      this.outputChannel.appendLine('User has not opted in to team sharing, skipping data share');
      return;
    }

    try {
      // Filter session data based on privacy settings
      const filteredData = await this.filterSessionDataForSharing(sessionData);
      
      // In a real implementation, this would send to team service
      // For now, store locally as simulation
      const teamData = this.context.globalState.get<any>(TeamDataAggregator.TEAM_DATA_KEY, {});
      const currentUser = await this.getCurrentUser();
      
      teamData[currentUser.id] = {
        sessionData: filteredData,
        lastUpdated: new Date().toISOString(),
        hasOptedIn: true
      };
      
      await this.context.globalState.update(TeamDataAggregator.TEAM_DATA_KEY, teamData);
      this.outputChannel.appendLine('Session data shared with team');
    } catch (error) {
      this.outputChannel.appendLine(`Failed to share session data: ${error}`);
      throw new Error('Failed to share session data with team');
    }
  }

  async isTeamDashboardAvailable(): Promise<boolean> {
    const config = this.configService.getConfiguration();
    return config.enableTeamDashboard;
  } 
 private async filterSessionDataForSharing(sessionData: SessionData): Promise<SessionData> {
    const config = this.configService.getConfiguration();
    const { excludeFilePatterns, excludeCommitPatterns } = config.privacySettings;

    // Filter files based on exclude patterns
    const filteredFiles = sessionData.editedFiles.filter(file => {
      return !this.matchesPatterns(file.filePath, excludeFilePatterns);
    });

    // Filter commits based on exclude patterns
    const filteredCommits = sessionData.gitCommits.filter(commit => {
      return !this.matchesPatterns(commit.message, excludeCommitPatterns);
    });

    return {
      ...sessionData,
      editedFiles: filteredFiles,
      gitCommits: filteredCommits,
      // Always include terminal errors as they're useful for team debugging
      terminalErrors: sessionData.terminalErrors
    };
  }

  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Simple pattern matching - in real implementation could use more sophisticated matching
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(text);
      }
      return text.includes(pattern);
    });
  }

  private getMockTeamId(): string {
    // In real implementation, this would come from team service
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder ? `team-${workspaceFolder.name}` : 'default-team';
  }

  private async getCurrentUser(): Promise<TeamMember> {
    // In real implementation, this would come from authentication service
    const gitConfig = vscode.workspace.getConfiguration('git');
    const userName = gitConfig.get<string>('defaultCloneDirectory') || 'Current User';
    
    return {
      id: 'current-user',
      name: userName,
      email: 'user@example.com',
      isOnline: true,
      lastActive: new Date()
    };
  }

  private async getMockTeamMembers(): Promise<TeamMemberSession[]> {
    const currentUser = await this.getCurrentUser();
    const teamData = this.context.globalState.get<any>(TeamDataAggregator.TEAM_DATA_KEY, {});
    
    // Create mock team members
    const mockMembers: TeamMemberSession[] = [
      {
        member: currentUser,
        sessionData: teamData[currentUser.id]?.sessionData || null,
        hasOptedIn: true,
        lastUpdated: new Date()
      }
    ];

    // Add some mock team members for demonstration
    const mockTeammates: TeamMember[] = [
      {
        id: 'teammate-1',
        name: 'Alice Developer',
        email: 'alice@example.com',
        isOnline: true,
        lastActive: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      },
      {
        id: 'teammate-2', 
        name: 'Bob Engineer',
        email: 'bob@example.com',
        isOnline: false,
        lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    ];

    // Add mock teammates with simulated data
    mockTeammates.forEach(teammate => {
      mockMembers.push({
        member: teammate,
        sessionData: this.generateMockSessionData(teammate),
        hasOptedIn: Math.random() > 0.3, // 70% opt-in rate
        lastUpdated: teammate.lastActive
      });
    });

    return mockMembers;
  } 
 private generateMockSessionData(member: TeamMember): SessionData | null {
    // Don't generate data for offline members or those who haven't opted in
    if (!member.isOnline && Math.random() > 0.5) {
      return null;
    }

    const sessionStart = new Date(member.lastActive.getTime() - 2 * 60 * 60 * 1000); // 2 hours before last active

    return {
      sessionId: `session-${member.id}-${Date.now()}`,
      startTime: sessionStart,
      endTime: member.lastActive,
      editedFiles: [
        {
          filePath: `src/components/${member.name.split(' ')[0].toLowerCase()}-component.ts`,
          timestamp: new Date(sessionStart.getTime() + 30 * 60 * 1000),
          changeType: 'modified' as const,
          lineCount: Math.floor(Math.random() * 100) + 10
        }
      ],
      gitCommits: [
        {
          hash: Math.random().toString(36).substring(2, 9),
          message: `feat: implement ${member.name.split(' ')[0].toLowerCase()} feature`,
          author: member.name,
          timestamp: new Date(sessionStart.getTime() + 45 * 60 * 1000),
          filesChanged: [`src/components/${member.name.split(' ')[0].toLowerCase()}-component.ts`]
        }
      ],
      terminalErrors: Math.random() > 0.7 ? [
        {
          message: 'TypeError: Cannot read property of undefined',
          timestamp: new Date(sessionStart.getTime() + 60 * 60 * 1000),
          terminalName: 'Terminal 1',
          errorType: 'error' as const
        }
      ] : [],
      summary: `${member.name} worked on implementing new features and made progress on component development.`
    };
  }
}