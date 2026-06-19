import { SessionData } from '../models/SessionData';

/**
 * Service for calculating productivity scores and metrics
 */
export class ProductivityCalculator {
    /**
     * Calculate productivity score for a session (0-100)
     * Based on multiple factors:
     * - Files edited (weight: 30%)
     * - Git commits (weight: 30%)
     * - Session duration (weight: 20%)
     * - Error rate (weight: 20%, negative impact)
     */
    static calculateProductivityScore(session: SessionData): number {
        const duration = session.endTime 
            ? session.endTime.getTime() - session.startTime.getTime()
            : 0;
        
        const durationMinutes = duration / (1000 * 60);
        
        // Normalize factors (0-1 scale)
        const filesScore = Math.min(session.editedFiles.length / 20, 1); // Max 20 files = 1.0
        const commitsScore = Math.min(session.gitCommits.length / 10, 1); // Max 10 commits = 1.0
        const durationScore = Math.min(durationMinutes / 120, 1); // Max 120 minutes = 1.0
        
        // Error penalty (more errors = lower score)
        const errorPenalty = Math.min(session.terminalErrors.length / 5, 1); // Max 5 errors = full penalty
        
        // Calculate weighted score
        const baseScore = (
            filesScore * 0.3 +
            commitsScore * 0.3 +
            durationScore * 0.2
        );
        
        // Apply error penalty
        const finalScore = baseScore * (1 - errorPenalty * 0.2);
        
        // Convert to 0-100 scale
        return Math.round(finalScore * 100);
    }

    /**
     * Get productivity level label
     */
    static getProductivityLevel(score: number): string {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Average';
        if (score >= 20) return 'Low';
        return 'Very Low';
    }

    /**
     * Calculate session duration in human-readable format
     */
    static formatDuration(session: SessionData): string {
        if (!session.endTime) {
            return 'In Progress';
        }

        const duration = session.endTime.getTime() - session.startTime.getTime();
        const minutes = Math.floor(duration / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Calculate average productivity score for multiple sessions
     */
    static calculateAverageScore(sessions: SessionData[]): number {
        if (sessions.length === 0) return 0;

        const totalScore = sessions.reduce((sum, session) => {
            const score = session.productivityScore || this.calculateProductivityScore(session);
            return sum + score;
        }, 0);

        return Math.round(totalScore / sessions.length);
    }

    /**
     * Get productivity insights for a session
     */
    static getProductivityInsights(session: SessionData): string[] {
        const insights: string[] = [];
        const score = session.productivityScore || this.calculateProductivityScore(session);

        // File activity insights
        if (session.editedFiles.length > 15) {
            insights.push('High file activity');
        } else if (session.editedFiles.length < 3) {
            insights.push('Low file activity');
        }

        // Commit insights
        if (session.gitCommits.length > 5) {
            insights.push('Multiple commits made');
        } else if (session.gitCommits.length === 0 && session.editedFiles.length > 0) {
            insights.push('No commits (consider committing changes)');
        }

        // Error insights
        if (session.terminalErrors.length > 0) {
            insights.push(`${session.terminalErrors.length} error(s) encountered`);
        }

        // Duration insights
        if (session.endTime) {
            const duration = session.endTime.getTime() - session.startTime.getTime();
            const hours = duration / (1000 * 60 * 60);
            if (hours > 4) {
                insights.push('Long session (consider taking breaks)');
            } else if (hours < 0.5) {
                insights.push('Short session');
            }
        }

        // Score-based insights
        if (score >= 80) {
            insights.push('Highly productive session');
        } else if (score < 40) {
            insights.push('Room for improvement');
        }

        return insights;
    }
}

