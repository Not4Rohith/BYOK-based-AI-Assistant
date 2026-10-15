import { ContextCategory } from '../router/routing.types.js';
import { ContextPayload } from './registry.js';
import { TaskService } from '../../services/task.service.js';
import { taskListService } from '../../services/taskList.service.js';
import { MemoryService } from '../../services/memory.service.js';
import { GoalService } from '../../services/goal.service.js';
import { UserModel, getCurrentUserDocument } from '../../db/models/User.model.js';
import { dbConnection } from '../../db/connection.js';
import { transientScratchpadService } from '../../services/scratchpad.service.js';
import { transientScratchpad } from '../scratchpad.js';

import { dynamicPromptChunker } from '../prompts/dynamicChunker.js';

export class ContextSelector {
  public async loadContext(
    categories: ContextCategory[],
    options: {
      userId?: string;
      taskService?: TaskService;
      memoryService?: MemoryService;
      goalService?: GoalService;
      dailySchedule?: string;
      chatHistory?: any[];
      localTime?: string;
      userPrompt?: string;
      sessionId?: string;
    }
  ): Promise<ContextPayload> {
    const payload: ContextPayload = {};
    const catSet = new Set(categories);
    let userTz = 'Asia/Kolkata';
    let userDoc: any = null;

    if (dbConnection.getStatus().connected) {
      try {
        userDoc = await getCurrentUserDocument(options.userId);
        if (userDoc?.profile?.timezone) {
          userTz = userDoc.profile.timezone;
        }
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch user doc:', err);
      }
    }

    if (catSet.has('CURRENT_TIME') || options.localTime) {
      payload.currentTime = options.localTime || new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: userTz,
        timeZoneName: 'short',
      });
    }

    if (catSet.has('USER_PREFERENCES') || catSet.has('PERSONAL_INSTRUCTIONS')) {
      const scheduleText = options.dailySchedule || '';
      const scheduleChunks = scheduleText ? dynamicPromptChunker.parseScheduleChunks(scheduleText) : [];

      if (catSet.has('USER_PREFERENCES')) {
        payload.userPreferences = {
          preferredStartTime: userDoc?.planningPreferences?.preferredStartTime || '07:30',
          preferredEndTime: userDoc?.planningPreferences?.preferredEndTime || '23:59',
          defaultBufferMinutes: userDoc?.planningPreferences?.defaultBufferMinutes ?? 15,
          preferRealisticSchedules: userDoc?.planningPreferences?.preferRealisticSchedules ?? true,
          fixedRoutines: userDoc?.planningPreferences?.fixedRoutines || [],
          dailySchedule: scheduleText,
          routineItems: scheduleChunks.map((c) => c.content),
        };
      }
      if (catSet.has('PERSONAL_INSTRUCTIONS') && userDoc?.aiInstructions?.systemPrompt) {
        payload.personalInstructions = userDoc.aiInstructions.systemPrompt;
      }
    }

    if (catSet.has('TASKS') && options.taskService) {
      try {
        const allTasks = await options.taskService.getAllTasks();
        payload.tasks = allTasks.filter((t) => t.status !== 'completed');
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
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: userTz });
        payload.agenda = allTasks.filter((t) => t.scheduledStart && t.scheduledStart.substring(0, 10) === todayStr);
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch agenda:', err);
      }
    }

    if (catSet.has('GOALS')) {
      try {
        if (options.goalService) {
          const userGoals = await options.goalService.getGoals();
          payload.goals = userGoals.filter((g) => g.status === 'active');
        }
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch user goals:', err);
      }
    }

    if ((catSet.has('RELEVANT_MEMORIES') || catSet.has('MEMORY')) && options.memoryService) {
      try {
        if (options.userPrompt) {
          payload.relevantMemories = await options.memoryService.searchRelevantMemories(options.userPrompt, 5);
        }
        const { shortTerm, mediumTerm, longTerm } = await options.memoryService.getActiveMemories();
        payload.shortTermMemories = shortTerm.slice(0, 5);
        payload.mediumTermMemories = mediumTerm.slice(0, 5);
        payload.longTermMemories = longTerm.slice(0, 5);
        payload.memories = [...shortTerm, ...mediumTerm, ...longTerm].slice(0, 10);
      } catch (err) {
        console.warn('[ContextSelector] Failed to fetch memories:', err);
      }
    }

    if (catSet.has('TRANSIENT_SCRATCHPAD')) {
      const stored = (options.sessionId ? transientScratchpadService.getScratchpadSummary(options.sessionId) : '') || transientScratchpad.peek();
      if (stored && stored.trim().length > 0) {
        payload.scratchpad = stored.trim();
      }
    }

    if (catSet.has('CHAT_HISTORY') && options.chatHistory) {
      payload.chatHistory = options.chatHistory.slice(-4);
    }

    return payload;
  }
}

export const contextSelector = new ContextSelector();
