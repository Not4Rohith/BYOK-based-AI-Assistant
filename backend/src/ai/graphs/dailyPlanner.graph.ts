import { Task, Memory, ScheduleItem } from '@ai-task-manager/shared-types';
import { googleCalendarService } from '../../services/googleCalendar.service.js';
import { googleTasksService } from '../../services/googleTasks.service.js';

export interface DailyPlannerState {
  userRequest: string;
  tasks: Task[];
  memories: Memory[];
  fixedEvents: { title: string; startHour: number; endHour: number }[];
  schedule: ScheduleItem[];
  updatedTasks: Task[];
  validationResult?: { isValid: boolean; errors: string[] };
  step: 'start' | 'retrieve_context' | 'create_plan' | 'validate_plan' | 'replan' | 'sync' | 'complete';
}

export class DailyPlannerGraph {
  public async execute(initialState: Partial<DailyPlannerState>): Promise<DailyPlannerState> {
    let state: DailyPlannerState = {
      userRequest: initialState.userRequest || 'Morning Planning',
      tasks: initialState.tasks || [],
      memories: initialState.memories || [],
      fixedEvents: initialState.fixedEvents || [{ title: 'College Lectures', startHour: 9, endHour: 16 }],
      schedule: [],
      updatedTasks: [],
      step: 'start',
    };

    // Node 1: Retrieve Context
    state = this.nodeRetrieveContext(state);

    // Node 2: Create Plan
    state = this.nodeCreatePlan(state);

    // Node 3: Validate Plan
    state = this.nodeValidatePlan(state);

    // Conditional Edge: If invalid, Re-plan
    if (state.validationResult && !state.validationResult.isValid) {
      console.warn('[LangGraph DailyPlanner] Plan invalid. Executing Re-plan node.', state.validationResult.errors);
      state = this.nodeReplan(state);
      state = this.nodeValidatePlan(state);
    }

    // Node 5: Sync and Save
    state = await this.nodeSyncAndSave(state);
    state.step = 'complete';

    return state;
  }

  private nodeRetrieveContext(state: DailyPlannerState): DailyPlannerState {
    console.log('[LangGraph Node: RetrieveContext] Context gathered:', {
      taskCount: state.tasks.length,
      memoryCount: state.memories.length,
      fixedEventCount: state.fixedEvents.length,
    });
    return { ...state, step: 'retrieve_context' };
  }

  private nodeCreatePlan(state: DailyPlannerState): DailyPlannerState {
    const pending = state.tasks.filter((t) => t.status !== 'completed');
    const completed = state.tasks.filter((t) => t.status === 'completed');

    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sortedPending = [...pending].sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return (a.estimatedMinutes || 30) - (b.estimatedMinutes || 30);
    });

    const scheduleItems: ScheduleItem[] = [];
    const today = new Date();

    // Fixed calendar events
    state.fixedEvents.forEach((fe, idx) => {
      const start = new Date(today);
      start.setHours(fe.startHour, 0, 0, 0);
      const end = new Date(today);
      end.setHours(fe.endHour, 0, 0, 0);

      scheduleItems.push({
        _id: `sch_fixed_${idx}`,
        title: fe.title,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'calendar',
      });
    });

    // Flexible tasks
    let currentHour = 16;
    let currentMinute = 30;

    const updatedPending = sortedPending.map((task, idx) => {
      const duration = task.estimatedMinutes || 45;
      const start = new Date(today);
      start.setHours(currentHour, currentMinute, 0, 0);
      const end = new Date(start.getTime() + duration * 60000);

      const nextTime = new Date(end.getTime() + 15 * 60000); // 15m buffer
      currentHour = nextTime.getHours();
      currentMinute = nextTime.getMinutes();

      const updatedTask: Task = {
        ...task,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      scheduleItems.push({
        _id: `sch_task_${task._id}`,
        taskId: task._id,
        title: task.title,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'task',
      });

      return updatedTask;
    });

    return {
      ...state,
      schedule: scheduleItems,
      updatedTasks: [...updatedPending, ...completed],
      step: 'create_plan',
    };
  }

  private nodeValidatePlan(state: DailyPlannerState): DailyPlannerState {
    const errors: string[] = [];
    // Validate if any schedule items overlap
    for (let i = 0; i < state.schedule.length; i++) {
      for (let j = i + 1; j < state.schedule.length; j++) {
        const a = state.schedule[i];
        const b = state.schedule[j];
        if (new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end)) {
          errors.push(`Overlap detected between "${a.title}" and "${b.title}"`);
        }
      }
    }
    const isValid = errors.length === 0;
    return {
      ...state,
      validationResult: { isValid, errors },
      step: 'validate_plan',
    };
  }

  private nodeReplan(state: DailyPlannerState): DailyPlannerState {
    // Re-adjust pointer to resolve overlaps
    let currentHour = 17;
    let currentMinute = 0;
    const today = new Date();

    const adjustedSchedule = state.schedule.map((item) => {
      if (item.type !== 'task') return item;

      const durationMins = (new Date(item.end).getTime() - new Date(item.start).getTime()) / 60000;
      const start = new Date(today);
      start.setHours(currentHour, currentMinute, 0, 0);
      const end = new Date(start.getTime() + durationMins * 60000);

      const nextTime = new Date(end.getTime() + 20 * 60000);
      currentHour = nextTime.getHours();
      currentMinute = nextTime.getMinutes();

      return {
        ...item,
        start: start.toISOString(),
        end: end.toISOString(),
      };
    });

    return {
      ...state,
      schedule: adjustedSchedule,
      step: 'replan',
    };
  }

  private async nodeSyncAndSave(state: DailyPlannerState): Promise<DailyPlannerState> {
    await googleCalendarService.syncAllEvents(state.updatedTasks);
    await googleTasksService.syncAll(state.updatedTasks);
    return { ...state, step: 'sync' };
  }
}

export const dailyPlannerGraph = new DailyPlannerGraph();
