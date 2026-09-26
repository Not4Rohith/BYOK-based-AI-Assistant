import { ContextCategory } from '../router/routing.types.js';
import { ContextPayload } from './registry.js';
import { TaskService } from '../../services/task.service.js';
import { taskListService } from '../../services/taskList.service.js';
import { MemoryService } from '../../services/memory.service.js';
import { aiAgentGoalService } from '../../services/aiAgentGoal.service.js';

export class ContextSelector {
  public async loadContext(
    categories: ContextCategory[],
    options: {
      taskService?: TaskService;
      memoryService?: MemoryService;
      dailySchedule?: string;
      chatHistory?: any[];
      localTime?: string;
    }
  ): Promise<ContextPayload> {
    const payload: ContextPayload = {};
    const catSet = new Set(categories);

    if (catSet.has('CURRENT_TIME') || options.localTime) {
      payload.currentTime = options.localTime || new Date().toISOString();
    }

    if (catSet.has('USER_PREFERENCES') && options.dailySchedule) {
      payload.userPreferences = options.dailySchedule;
    }

    if (catSet.has('TASKS') && options.taskService) {
      try {
        payload.tasks = await options.taskService.getAllTasks();
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch tasks:', err);
      }
    }

    if (catSet.has('TASK_LISTS')) {
      try {
        payload.lists = await taskListService.getAllLists();
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch task lists:', err);
      }
    }

    if (catSet.has('TODAY_AGENDA') && options.taskService) {
      try {
        const allTasks = await options.taskService.getAllTasks();
        const todayStr = new Date().toISOString().substring(0, 10);
        payload.agenda = allTasks.filter((t) => !t.scheduledStart || t.scheduledStart.substring(0, 10) === todayStr);
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch agenda:', err);
      }
    }

    if (catSet.has('GOALS')) {
      try {
        const goals = await aiAgentGoalService.getAllAgentGoals();
        payload.goals = goals.filter((g) => g.status === 'pending');
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch goals:', err);
      }
    }

    if (catSet.has('MEMORY') && options.memoryService) {
      try {
        payload.memories = await options.memoryService.getMemories();
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch memories:', err);
      }
    }

    if (catSet.has('CHAT_HISTORY') && options.chatHistory) {
      payload.chatHistory = options.chatHistory.slice(-5);
    }

    return payload;
  }
}

export const contextSelector = new ContextSelector();
