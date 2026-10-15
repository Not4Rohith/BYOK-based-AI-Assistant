import { TaskService } from '../../services/task.service.js';
import { taskListService } from '../../services/taskList.service.js';
import { GoalService } from '../../services/goal.service.js';
import { UserModel } from '../../db/models/User.model.js';
import { dbConnection } from '../../db/connection.js';

export interface ActionObject {
  type: 'schedule_task' | 'create_task' | 'update_task' | 'complete_task' | 'delete_task' | 'create_list' | 'delete_list';
  taskId?: string;
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes?: number;
  listId?: string;
  listTitle?: string;
  subtasks?: string[];
  status?: string;
}

export interface StructuredLLMResponse {
  response: string;
  actions?: ActionObject[];
}

export class ActionValidator {
  /**
   * Parses, validates, and executes structured AI actions against backend services.
   */
  public async processAndExecute(
    llmRawOutput: string,
    services: {
      taskService?: TaskService;
      goalService?: GoalService;
    }
  ): Promise<{ responseText: string; executedActions: any[]; errors: string[] }> {
    let parsed: StructuredLLMResponse | null = null;
    let introText = '';

    try {
      const cleanText = llmRawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        introText = cleanText.substring(0, firstBrace).trim();
        const jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonStr);
      }
    } catch {
      return {
        responseText: llmRawOutput,
        executedActions: [],
        errors: [],
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { responseText: llmRawOutput, executedActions: [], errors: [] };
    }

    const mainResponse = parsed.response || '';
    const responseText = introText
      ? `${introText}\n\n${mainResponse}`
      : mainResponse || llmRawOutput;
    const rawActions = parsed.actions || [];
    const executedActions: any[] = [];
    const errors: string[] = [];

    if (rawActions.length === 0) {
      return { responseText, executedActions: [], errors: [] };
    }

    // Load user planning preferences & routines for conflict validation
    let fixedRoutines: any[] = [];
    if (dbConnection.getStatus().connected) {
      try {
        const user = await UserModel.findOne({});
        if (user && user.planningPreferences?.fixedRoutines) {
          fixedRoutines = user.planningPreferences.fixedRoutines;
        }
      } catch (err) {
        console.warn('[ActionValidator] Failed to load user routines:', err);
      }
    }

    for (const action of rawActions) {
      try {
        if (action.type === 'schedule_task') {
          const res = await this.executeScheduleTask(action, services.taskService, fixedRoutines);
          if (res.success) executedActions.push(res.action);
          else if (res.error) errors.push(res.error);
        } else if (action.type === 'create_task') {
          const res = await this.executeCreateTask(action, services.taskService, fixedRoutines);
          if (res.success) executedActions.push(res.action);
          else if (res.error) errors.push(res.error);
        } else if (action.type === 'update_task' || action.type === 'complete_task') {
          const res = await this.executeUpdateTask(action, services.taskService);
          if (res.success) executedActions.push(res.action);
          else if (res.error) errors.push(res.error);
        } else if (action.type === 'delete_task') {
          const res = await this.executeDeleteTask(action, services.taskService);
          if (res.success) executedActions.push(res.action);
          else if (res.error) errors.push(res.error);
        }
      } catch (err: any) {
        errors.push(`Action ${action.type} failed: ${err?.message || String(err)}`);
      }
    }

    return { responseText, executedActions, errors };
  }

  private async executeScheduleTask(
    action: ActionObject,
    taskService?: TaskService,
    fixedRoutines: any[] = []
  ): Promise<{ success: boolean; action?: any; error?: string }> {
    if (!taskService) return { success: false, error: 'Task service unavailable' };
    if (!action.taskId && !action.title) return { success: false, error: 'Missing taskId/title' };

    const all = await taskService.getAllTasks();
    const task = all.find(
      (t) => t._id === action.taskId || t.title.toLowerCase().trim() === (action.title || action.taskId || '').toLowerCase().trim()
    );

    if (!task) {
      return { success: false, error: `Task "${action.title || action.taskId}" not found` };
    }

    let startIso = action.scheduledStart;
    let endIso = action.scheduledEnd;

    if (!startIso && action.date && action.startTime) {
      const [sh, sm] = action.startTime.split(':').map(Number);
      const d = new Date(action.date);
      d.setHours(sh, sm || 0, 0, 0);
      startIso = d.toISOString();

      if (action.endTime) {
        const [eh, em] = action.endTime.split(':').map(Number);
        const ed = new Date(action.date);
        ed.setHours(eh, em || 0, 0, 0);
        endIso = ed.toISOString();
      } else {
        const durationMins = action.estimatedMinutes || task.estimatedMinutes || 45;
        endIso = new Date(d.getTime() + durationMins * 60000).toISOString();
      }
    }

    if (!startIso || !endIso) {
      return { success: false, error: 'Invalid start or end time specified' };
    }

    // Safety Constraint Check: Verify proposed schedule does not conflict with user's fixed routines
    const proposedStart = new Date(startIso);
    const proposedEnd = new Date(endIso);
    const dayOfWeek = proposedStart.getDay();

    const startMin = proposedStart.getHours() * 60 + proposedStart.getMinutes();
    const endMin = proposedEnd.getHours() * 60 + proposedEnd.getMinutes();

    for (const routine of fixedRoutines) {
      if (routine.daysOfWeek && routine.daysOfWeek.includes(dayOfWeek)) {
        const [rStartH, rStartM] = routine.startTime.split(':').map(Number);
        const [rEndH, rEndM] = routine.endTime.split(':').map(Number);
        const rStartMin = rStartH * 60 + (rStartM || 0);
        let rEndMin = rEndH * 60 + (rEndM || 0);
        if (rEndMin <= rStartMin && rEndH === 0) rEndMin = 24 * 60;

        // Check minute overlap
        if (startMin < rEndMin && rStartMin < endMin) {
          return {
            success: false,
            error: `Schedule conflict: Proposed slot (${action.startTime || startIso}) overlaps with fixed routine "${routine.title}" (${routine.startTime}-${routine.endTime}).`,
          };
        }
      }
    }

    const updated = await taskService.updateTask(task._id, {
      scheduledStart: startIso,
      scheduledEnd: endIso,
    });

    return {
      success: !!updated,
      action: { tool: 'schedule_task', args: { taskId: task._id, title: task.title, scheduledStart: startIso, scheduledEnd: endIso } },
      error: updated ? undefined : 'Failed to update task schedule',
    };
  }

  private normalizePriority(p?: string): 'low' | 'medium' | 'high' {
    if (p === 'urgent' || p === 'high') return 'high';
    if (p === 'low') return 'low';
    return 'medium';
  }

  private async executeCreateTask(
    action: ActionObject,
    taskService?: TaskService,
    fixedRoutines: any[] = []
  ): Promise<{ success: boolean; action?: any; error?: string }> {
    if (!taskService) return { success: false, error: 'Task service unavailable' };
    if (!action.title) return { success: false, error: 'Missing task title' };

    let startIso = action.scheduledStart;
    let endIso = action.scheduledEnd;

    if (!startIso && action.date && action.startTime) {
      const [sh, sm] = action.startTime.split(':').map(Number);
      const d = new Date(action.date);
      d.setHours(sh, sm || 0, 0, 0);
      startIso = d.toISOString();

      if (action.endTime) {
        const [eh, em] = action.endTime.split(':').map(Number);
        const ed = new Date(action.date);
        ed.setHours(eh, em || 0, 0, 0);
        endIso = ed.toISOString();
      } else {
        const durationMins = action.estimatedMinutes || 45;
        endIso = new Date(d.getTime() + durationMins * 60000).toISOString();
      }
    }

    if (startIso && endIso) {
      const startDate = new Date(startIso);
      const dayOfWeek = startDate.getDay();
      const startMin = startDate.getHours() * 60 + startDate.getMinutes();
      const endDate = new Date(endIso);
      const endMin = endDate.getHours() * 60 + endDate.getMinutes();

      for (const routine of fixedRoutines) {
        if (routine.daysOfWeek && routine.daysOfWeek.includes(dayOfWeek)) {
          const [rH, rM] = routine.startTime.split(':').map(Number);
          const [rEndH, rEndM] = routine.endTime.split(':').map(Number);
          const rStartMin = rH * 60 + (rM || 0);
          const rEndMin = rEndH * 60 + (rEndM || 0);

          if (startMin < rEndMin && endMin > rStartMin) {
            return {
              success: false,
              error: `Schedule conflict: task "${action.title}" overlaps with fixed routine "${routine.title}" (${routine.startTime}-${routine.endTime})`,
            };
          }
        }
      }
    }

    const created = await taskService.createTask({
      title: action.title,
      description: action.description,
      priority: this.normalizePriority(action.priority),
      estimatedMinutes: action.estimatedMinutes || 45,
      scheduledStart: startIso,
      scheduledEnd: endIso,
      goalId: (action as any).goalId,
    });

    return {
      success: !!created,
      action: { tool: 'create_task', args: { taskId: created._id, title: created.title, scheduledStart: startIso, scheduledEnd: endIso } },
    };
  }

  private async executeUpdateTask(
    action: ActionObject,
    taskService?: TaskService
  ): Promise<{ success: boolean; action?: any; error?: string }> {
    if (!taskService) return { success: false, error: 'Task service unavailable' };
    const all = await taskService.getAllTasks();
    const task = all.find(
      (t) => t._id === action.taskId || t.title.toLowerCase().trim() === (action.title || action.taskId || '').toLowerCase().trim()
    );

    if (!task) return { success: false, error: `Task "${action.title || action.taskId}" not found` };

    const statusToSet = action.type === 'complete_task' ? 'completed' : action.status;
    const updated = await taskService.updateTask(task._id, {
      ...(action.title ? { title: action.title } : {}),
      ...(action.priority ? { priority: this.normalizePriority(action.priority) } : {}),
      ...(statusToSet ? { status: statusToSet as any } : {}),
    });

    return {
      success: !!updated,
      action: { tool: action.type, args: { taskId: task._id, title: task.title } },
    };
  }

  private async executeDeleteTask(
    action: ActionObject,
    taskService?: TaskService
  ): Promise<{ success: boolean; action?: any; error?: string }> {
    if (!taskService) return { success: false, error: 'Task service unavailable' };
    const all = await taskService.getAllTasks();
    const task = all.find(
      (t) => t._id === action.taskId || t.title.toLowerCase().trim() === (action.title || action.taskId || '').toLowerCase().trim()
    );

    if (!task) return { success: false, error: `Task "${action.title || action.taskId}" not found` };

    const ok = await taskService.deleteTask(task._id);
    return {
      success: ok,
      action: { tool: 'delete_task', args: { taskId: task._id } },
    };
  }
}

export const actionValidator = new ActionValidator();
