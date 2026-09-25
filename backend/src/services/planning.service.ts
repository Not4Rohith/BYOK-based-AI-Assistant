import { Task, ScheduleItem, UserPlanningPreferences } from '@ai-task-manager/shared-types';
import { dailyPlannerGraph } from '../ai/graphs/dailyPlanner.graph.js';
import { automaticReplanner } from '../ai/automaticReplanner.js';
import { MemoryService } from './memory.service.js';

export class PlanningService {
  constructor(private memoryService?: MemoryService) {}

  public async generateDailyPlanAsync(
    tasks: Task[],
    fixedEvents: { title: string; startHour: number; endHour: number }[] = [
      { title: 'College Lectures', startHour: 9, endHour: 16 },
    ]
  ): Promise<{ schedule: ScheduleItem[]; tasks: Task[]; isValid: boolean; errors: string[] }> {
    const memories = this.memoryService ? await this.memoryService.getMemories() : [];

    const graphResult = await dailyPlannerGraph.execute({
      userRequest: 'Daily Morning Planning',
      tasks,
      memories,
      fixedEvents,
    });

    return {
      schedule: graphResult.schedule,
      tasks: graphResult.updatedTasks,
      isValid: graphResult.validationResult?.isValid ?? true,
      errors: graphResult.validationResult?.errors || [],
    };
  }

  public generateDailyPlan(
    tasks: Task[],
    fixedEvents: { title: string; startHour: number; endHour: number }[] = [
      { title: 'College Lectures', startHour: 9, endHour: 16 },
    ]
  ): { schedule: ScheduleItem[]; tasks: Task[]; isValid: boolean; errors: string[] } {
    const { schedule, tasks: updated } = automaticReplanner.replanFromCurrentTime(tasks, fixedEvents);
    return {
      schedule,
      tasks: updated,
      isValid: true,
      errors: [],
    };
  }

  public replanDay(tasks: Task[]): Task[] {
    const { tasks: replanned } = automaticReplanner.replanFromCurrentTime(tasks);
    return replanned;
  }
}
