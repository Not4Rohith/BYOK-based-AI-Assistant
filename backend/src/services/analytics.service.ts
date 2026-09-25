import { ProductivityAnalytics } from '@ai-task-manager/shared-types';
import { TaskService } from './task.service.js';
import { GoalService } from './goal.service.js';
import { MemoryService } from './memory.service.js';

export class AnalyticsService {
  constructor(
    private taskService: TaskService,
    private goalService: GoalService,
    private memoryService: MemoryService
  ) {}

  public async getProductivityAnalytics(): Promise<ProductivityAnalytics> {
    const [tasks, goals, memories] = await Promise.all([
      this.taskService.getAllTasks(),
      this.goalService.getGoals(),
      this.memoryService.getMemories(),
    ]);

    const totalTasks = tasks.length;
    const completedTasksList = tasks.filter((t) => t.status === 'completed');
    const tasksCompleted = completedTasksList.length;
    const completionRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;

    const highPriorityTasks = tasks.filter((t) => t.priority === 'high');
    const highPriorityCompleted = highPriorityTasks.filter((t) => t.status === 'completed').length;
    const highPriorityCompletionRate =
      highPriorityTasks.length > 0
        ? Math.round((highPriorityCompleted / highPriorityTasks.length) * 100)
        : 100;

    let totalEst = 0;
    let totalAct = 0;
    tasks.forEach((t) => {
      if (t.estimatedMinutes) totalEst += t.estimatedMinutes;
      if (t.actualMinutes) totalAct += t.actualMinutes;
      else if (t.status === 'completed' && t.estimatedMinutes) totalAct += t.estimatedMinutes;
    });

    const estimationAccuracyRatio =
      totalEst > 0 ? Math.min(1.5, Math.round((totalEst / Math.max(1, totalAct)) * 100) / 100) : 1.0;

    let totalGoalMilestones = 0;
    let goalMilestonesCompleted = 0;
    goals.forEach((g) => {
      if (g.milestones) {
        totalGoalMilestones += g.milestones.length;
        goalMilestonesCompleted += g.milestones.filter((m) => m.status === 'completed').length;
      }
    });

    const goalRate =
      totalGoalMilestones > 0
        ? Math.round((goalMilestonesCompleted / totalGoalMilestones) * 100)
        : 100;

    // Productivity Score out of 100
    const rawScore =
      completionRate * 0.4 +
      highPriorityCompletionRate * 0.3 +
      goalRate * 0.2 +
      Math.min(100, estimationAccuracyRatio * 100) * 0.1;

    const productivityScore = Math.min(100, Math.max(10, Math.round(rawScore)));

    const aiCoachingTips: string[] = [];

    if (completionRate < 60) {
      aiCoachingTips.push(
        'Consider decomposing complex multi-hour tasks into subtasks under 45 minutes to boost momentum.'
      );
    } else {
      aiCoachingTips.push(
        'Great task execution velocity! Maintain focus blocks during your peak morning energy window.'
      );
    }

    if (highPriorityCompletionRate < 70) {
      aiCoachingTips.push(
        'Prioritize high-impact tasks early in your workday before low-friction administrative items.'
      );
    } else {
      aiCoachingTips.push(
        'Excellent focus on high-priority goals! Your priority alignment is on track.'
      );
    }

    if (memories.length > 0) {
      const topPref = memories.find((m) => m.category === 'preferences');
      if (topPref) {
        aiCoachingTips.push(`Personal Habit Insight: ${topPref.content}`);
      }
    }

    return {
      productivityScore,
      tasksCompleted,
      totalTasks,
      completionRate,
      estimationAccuracyRatio,
      goalMilestonesCompleted,
      totalGoalMilestones,
      highPriorityCompletionRate,
      aiCoachingTips,
    };
  }
}
