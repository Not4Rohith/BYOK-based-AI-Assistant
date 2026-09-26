import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Priority } from '@ai-task-manager/shared-types';
import { TaskService } from '../services/task.service.js';
import { taskListService } from '../services/taskList.service.js';
import { aiAgentGoalService } from '../services/aiAgentGoal.service.js';
import { automaticReplanner } from './automaticReplanner.js';
import { transientScratchpad } from './scratchpad.js';

export function createLangChainTools(taskService?: TaskService) {
  const getTasksTool = tool(
    async ({ filter, listId }) => {
      if (!taskService) return 'Task service unavailable.';
      const allTasks = await taskService.getAllTasks();
      const allLists = await taskListService.getAllLists();

      let filtered = allTasks;
      if (filter === 'pending') {
        filtered = allTasks.filter((t) => t.status !== 'completed');
      } else if (filter === 'completed') {
        filtered = allTasks.filter((t) => t.status === 'completed');
      }

      if (listId) {
        filtered = filtered.filter((t) => t.listId === listId || t.listId === `list_${listId}`);
      }

      const formatted = filtered.map((t) => {
        const listObj = allLists.find((l) => l._id === t.listId);
        const taskObj: Record<string, any> = {
          id: t._id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: listObj ? listObj.title : t.listId,
        };
        if (t.description) taskObj.description = t.description;
        if (t.scheduledStart) taskObj.scheduledStart = t.scheduledStart;
        if (t.scheduledEnd) taskObj.scheduledEnd = t.scheduledEnd;
        if (t.estimatedMinutes) taskObj.estimatedMinutes = t.estimatedMinutes;
        if (t.expiresAt) taskObj.expiresAt = t.expiresAt;
        if (t.subtasks && t.subtasks.length > 0) taskObj.subtasks = t.subtasks;
        return taskObj;
      });

      // Write concise summary into single-use transient scratchpad
      const taskTitles = formatted.slice(0, 10).map((t) => t.title).join(', ');
      transientScratchpad.write(`[Tasks Summary]: ${formatted.length} ${filter || 'pending'} tasks. Items: ${taskTitles || 'None'}.`);

      return JSON.stringify({ count: formatted.length, tasks: formatted, scratchpadSaved: true });
    },
    {
      name: 'get_tasks',
      description: 'Fetch current tasks from database with optional filters for status and category/listId.',
      schema: z.object({
        filter: z.enum(['pending', 'completed', 'all']).optional().default('pending'),
        listId: z.string().optional(),
      }),
    }
  );

  const createTaskTool = tool(
    async (input) => {
      if (!taskService) return 'Task service unavailable.';
      const allLists = await taskListService.getAllLists();
      let listId = input.listId;

      if (!listId || !listId.startsWith('list_')) {
        const targetTitle = input.listTitle || input.listId;
        if (targetTitle) {
          const matchedList = allLists.find(
            (l) => l.title.toLowerCase().trim() === targetTitle.toLowerCase().trim()
          );
          listId = matchedList ? matchedList._id : (allLists[0]?._id || undefined);
        } else {
          listId = allLists[0]?._id || undefined;
        }
      }

      const created = await taskService.createTask({
        title: input.title,
        description: input.description,
        listId,
        priority: (input.priority as Priority) || 'medium',
        starred: input.starred,
        estimatedMinutes: input.estimatedMinutes || 60,
        scheduledStart: input.scheduledStart || new Date().toISOString(),
        scheduledEnd: input.scheduledEnd,
        expiresAt: input.expiresAt,
        subtasks: input.subtasks ? input.subtasks.map((stTitle) => ({ _id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, title: stTitle, completed: false })) : [],
      });

      return JSON.stringify({
        success: true,
        message: `Task "${created.title}" created successfully.`,
        task: { id: created._id, title: created.title, listId: created.listId, priority: created.priority, starred: created.starred, expiresAt: created.expiresAt },
      });
    },
    {
      name: 'create_task',
      description: 'Create a new user task on the task board. Optionally pass starred or expiresAt ISO timestamp.',
      schema: z.object({
        title: z.string().describe('Short descriptive title for the task'),
        description: z.string().optional().describe('Detailed task description'),
        listId: z.string().optional().describe('Target category ID or list title'),
        listTitle: z.string().optional().describe('Category/List title if ID unknown'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('low'),
        starred: z.boolean().optional().describe('Set true to star/favorite this task'),
        estimatedMinutes: z.number().optional().default(60),
        scheduledStart: z.string().optional(),
        scheduledEnd: z.string().optional(),
        expiresAt: z.string().optional().describe('Optional ISO date string when task automatically expires'),
        subtasks: z.array(z.string()).optional().describe('Subtask title strings'),
      }),
    }
  );

  const batchCreateTasksTool = tool(
    async ({ tasks }) => {
      if (!taskService) return 'Task service unavailable.';
      const createdList: any[] = [];
      const allLists = await taskListService.getAllLists();

      for (const item of tasks) {
        let listId = item.listId;
        if (!listId || !listId.startsWith('list_')) {
          const targetTitle = item.listTitle || item.listId;
          if (targetTitle) {
            const matchedList = allLists.find(
              (l) => l.title.toLowerCase().trim() === targetTitle.toLowerCase().trim()
            );
            listId = matchedList ? matchedList._id : (allLists[0]?._id || undefined);
          } else {
            listId = allLists[0]?._id || undefined;
          }
        }

        const created = await taskService.createTask({
          title: item.title,
          description: item.description,
          listId,
          priority: (item.priority as Priority) || 'medium',
          starred: item.starred,
          estimatedMinutes: item.estimatedMinutes || 30,
          scheduledStart: item.scheduledStart || new Date().toISOString(),
          scheduledEnd: item.scheduledEnd,
          expiresAt: item.expiresAt,
          subtasks: item.subtasks ? item.subtasks.map((stTitle) => ({ _id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, title: stTitle, completed: false })) : [],
        });
        createdList.push({ id: created._id, title: created.title, category: item.listTitle || item.listId, starred: created.starred });
      }

      return JSON.stringify({
        success: true,
        count: createdList.length,
        message: `Successfully batch created ${createdList.length} task(s).`,
        tasks: createdList,
      });
    },
    {
      name: 'batch_create_tasks',
      description: 'Create multiple tasks at once in a single bulk operation.',
      schema: z.object({
        tasks: z.array(
          z.object({
            title: z.string().describe('Title of the task'),
            description: z.string().optional(),
            listId: z.string().optional(),
            listTitle: z.string().optional().describe('Category/List title'),
            priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
            starred: z.boolean().optional().describe('Set true to star/favorite this task'),
            estimatedMinutes: z.number().optional().default(30),
            scheduledStart: z.string().optional(),
            scheduledEnd: z.string().optional(),
            expiresAt: z.string().optional(),
            subtasks: z.array(z.string()).optional().describe('List of subtask titles'),
          })
        ),
      }),
    }
  );

  const updateTaskTool = tool(
    async (input) => {
      if (!taskService) return 'Task service unavailable.';
      let targetId = input.taskId;

      if (!targetId || !targetId.startsWith('task_')) {
        const searchName = input.title || input.taskId;
        const all = await taskService.getAllTasks();
        const found = all.find((t) => t._id === searchName || t.title.toLowerCase().trim() === searchName.toLowerCase().trim());
        if (found) targetId = found._id;
      }

      const updated = await taskService.updateTask(targetId, {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.status ? { status: input.status as any } : {}),
        ...(input.priority ? { priority: input.priority as any } : {}),
        ...(input.listId ? { listId: input.listId } : {}),
        ...(input.scheduledStart ? { scheduledStart: input.scheduledStart } : {}),
        ...(input.scheduledEnd ? { scheduledEnd: input.scheduledEnd } : {}),
        ...(input.estimatedMinutes ? { estimatedMinutes: input.estimatedMinutes } : {}),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
        ...(input.starred !== undefined ? { starred: input.starred } : {}),
      });

      if (!updated) {
        return JSON.stringify({ success: false, message: `Task "${input.taskId}" not found.` });
      }

      return JSON.stringify({
        success: true,
        message: `Task "${updated.title}" updated successfully.`,
        task: updated,
      });
    },
    {
      name: 'update_task',
      description: 'Update an existing task status, priority, title, category, schedule, or expiration.',
      schema: z.object({
        taskId: z.string().describe('The ID or title of the task to update'),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        listId: z.string().optional(),
        scheduledStart: z.string().optional(),
        scheduledEnd: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        expiresAt: z.string().optional(),
        starred: z.boolean().optional(),
      }),
    }
  );

  const bulkUpdateTasksTool = tool(
    async ({ taskIds, updates }) => {
      if (!taskService) return 'Task service unavailable.';
      let updatedCount = 0;

      for (const id of taskIds) {
        const res = await taskService.updateTask(id, {
          ...(updates.status ? { status: updates.status as any } : {}),
          ...(updates.priority ? { priority: updates.priority as any } : {}),
          ...(updates.listId ? { listId: updates.listId } : {}),
          ...(updates.scheduledStart ? { scheduledStart: updates.scheduledStart } : {}),
          ...(updates.expiresAt ? { expiresAt: updates.expiresAt } : {}),
          ...(updates.starred !== undefined ? { starred: updates.starred } : {}),
        });
        if (res) updatedCount++;
      }

      return JSON.stringify({
        success: true,
        updatedCount,
        message: `Successfully updated ${updatedCount} task(s).`,
      });
    },
    {
      name: 'bulk_update_tasks',
      description: 'Apply updates (status, priority, category, schedule, starred) to multiple tasks at once.',
      schema: z.object({
        taskIds: z.array(z.string()).describe('Array of task IDs to update'),
        updates: z.object({
          status: z.enum(['pending', 'in_progress', 'completed']).optional(),
          priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
          listId: z.string().optional(),
          scheduledStart: z.string().optional(),
          expiresAt: z.string().optional(),
          starred: z.boolean().optional().describe('Set true to star/favorite, false to unstar'),
        }),
      }),
    }
  );

  const completeTaskTool = tool(
    async ({ taskId, title }) => {
      if (!taskService) return 'Task service unavailable.';
      let targetId = taskId;

      if (!targetId && title) {
        const all = await taskService.getAllTasks();
        const found = all.find((t) => t.title.toLowerCase().trim() === title.toLowerCase().trim());
        if (found) targetId = found._id;
      }

      if (!targetId) {
        return JSON.stringify({ success: false, message: `Task "${title || taskId}" not found.` });
      }

      const updated = await taskService.updateTask(targetId, { status: 'completed' });
      return JSON.stringify({
        success: !!updated,
        message: updated ? `Task "${updated.title}" marked as completed!` : `Failed to complete task ${targetId}.`,
      });
    },
    {
      name: 'complete_task',
      description: 'Mark a task as completed by taskId or task title.',
      schema: z.object({
        taskId: z.string().optional().describe('Task ID to mark complete'),
        title: z.string().optional().describe('Task title to mark complete if ID is unknown'),
      }),
    }
  );

  const deleteTaskTool = tool(
    async ({ taskId, title }) => {
      if (!taskService) return 'Task service unavailable.';
      let targetId = taskId;

      if (!targetId || !targetId.startsWith('task_')) {
        const searchName = title || taskId;
        const all = await taskService.getAllTasks();
        const found = all.find((t) => t._id === searchName || t.title.toLowerCase().trim() === searchName.toLowerCase().trim());
        if (found) targetId = found._id;
      }

      const success = await taskService.deleteTask(targetId);
      return JSON.stringify({ success, message: success ? `Task deleted successfully.` : `Task "${title || taskId}" not found.` });
    },
    {
      name: 'delete_task',
      description: 'Delete a specific task by ID or title.',
      schema: z.object({
        taskId: z.string().describe('Task ID or task title to delete'),
        title: z.string().optional().describe('Task title to delete if ID is unknown'),
      }),
    }
  );

  const deleteAllTasksTool = tool(
    async () => {
      if (!taskService) return 'Task service unavailable.';
      const count = await taskService.deleteAllTasks();
      return JSON.stringify({ success: true, count, message: `Deleted ${count} tasks.` });
    },
    {
      name: 'delete_all_tasks',
      description: 'Delete ALL tasks from the database.',
      schema: z.object({}),
    }
  );

  const searchTasksTool = tool(
    async ({ query, status, priority, listTitle, tag }) => {
      if (!taskService) return 'Task service unavailable.';
      const allTasks = await taskService.getAllTasks();
      const allLists = await taskListService.getAllLists();

      let results = allTasks;

      if (status && status !== 'all') {
        results = results.filter((t) => t.status === status);
      }
      if (priority) {
        results = results.filter((t) => t.priority === priority);
      }
      if (listTitle) {
        const targetList = allLists.find((l) => l.title.toLowerCase() === listTitle.toLowerCase());
        if (targetList) {
          results = results.filter((t) => t.listId === targetList._id);
        }
      }
      if (tag) {
        results = results.filter((t) => t.tags && t.tags.includes(tag));
      }
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(
          (t) => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
        );
      }

      const formatted = results.map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        scheduledStart: t.scheduledStart,
        expiresAt: t.expiresAt,
      }));

      return JSON.stringify({ count: formatted.length, tasks: formatted });
    },
    {
      name: 'search_tasks',
      description: 'Search tasks by keyword query, status, priority, list title, or tag.',
      schema: z.object({
        query: z.string().optional().describe('Keyword query to search in task title/description'),
        status: z.enum(['pending', 'in_progress', 'completed', 'all']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        listTitle: z.string().optional().describe('Category/List title filter'),
        tag: z.string().optional().describe('Tag filter'),
      }),
    }
  );

  const getTodayAgendaTool = tool(
    async () => {
      if (!taskService) return 'Task service unavailable.';
      const allTasks = await taskService.getAllTasks();
      const todayStr = new Date().toISOString().substring(0, 10);

      const todayTasks = allTasks.filter((t) => {
        if (!t.scheduledStart) return true;
        return t.scheduledStart.substring(0, 10) === todayStr;
      });

      const pending = todayTasks.filter((t) => t.status !== 'completed');
      const completed = todayTasks.filter((t) => t.status === 'completed');

      const timeline = todayTasks.map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        scheduledStart: t.scheduledStart,
        scheduledEnd: t.scheduledEnd,
        estimatedMinutes: t.estimatedMinutes,
      }));

      const agendaTitles = timeline.slice(0, 8).map((t) => t.title).join(', ');
      transientScratchpad.write(`[Today Agenda Summary]: ${todayTasks.length} total tasks (${pending.length} pending, ${completed.length} completed). Agenda items: ${agendaTitles || 'None'}.`);

      return JSON.stringify({
        date: todayStr,
        totalTasks: todayTasks.length,
        pendingCount: pending.length,
        completedCount: completed.length,
        timeline,
        scratchpadSaved: true,
      });
    },
    {
      name: 'get_today_agenda',
      description: "Get today's agenda including timeline, pending tasks count, completed tasks, and schedule blocks.",
      schema: z.object({}),
    }
  );

  const readScratchpadTool = tool(
    async () => {
      const scratch = transientScratchpad.readAndClear();
      if (scratch.empty || !scratch.content) {
        return JSON.stringify({ empty: true, message: 'Scratchpad is empty.' });
      }
      return JSON.stringify({ empty: false, content: scratch.content, wiped: true });
    },
    {
      name: 'read_scratchpad',
      description: 'Access and retrieve stored memory summary from the single-use transient scratchpad. Reading automatically wipes and clears the scratchpad.',
      schema: z.object({}),
    }
  );

  const scheduleSelfAlarmTool = tool(
    async ({ title, delayMinutes, scheduledIsoTime, actionType, notes }) => {
      let targetTime = scheduledIsoTime;
      if (!targetTime && delayMinutes) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + delayMinutes);
        targetTime = d.toISOString();
      }
      if (!targetTime) {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        targetTime = d.toISOString();
      }

      const agentGoal = await aiAgentGoalService.createAgentGoal({
        title: title || 'AI Autonomous Self-Trigger Alarm',
        actionType: actionType || 'autonomous_followup',
        targetExecutionTime: targetTime,
        payload: { notes: notes || title, selfAlarm: true },
      });

      return JSON.stringify({
        success: true,
        message: `Self-invoking alarm "${agentGoal.title}" scheduled for execution at ${new Date(targetTime).toLocaleTimeString()}.`,
        goalId: agentGoal._id,
        targetExecutionTime: targetTime,
      });
    },
    {
      name: 'schedule_self_alarm',
      description: 'Schedule an autonomous self-invoking alarm for the AI assistant to trigger itself at a future time (in N minutes or specific ISO timestamp) to follow up, re-evaluate tasks, check progress, or execute background operations.',
      schema: z.object({
        title: z.string().describe('Title of the autonomous self-alarm/follow-up'),
        delayMinutes: z.number().optional().describe('Minutes in the future to trigger alarm'),
        scheduledIsoTime: z.string().optional().describe('Exact ISO timestamp to trigger alarm'),
        actionType: z.enum(['autonomous_followup', 'replan_day', 'check_pending_tasks', 'delete_list_and_tasks']).optional().default('autonomous_followup'),
        notes: z.string().optional().describe('Notes/context for the AI when alarm fires'),
      }),
    }
  );

  const snoozeTaskTool = tool(
    async ({ taskId, title, snoozeMinutes, snoozeHours, snoozeToTomorrow }) => {
      if (!taskService) return 'Task service unavailable.';
      let targetId = taskId;

      if (!targetId && title) {
        const all = await taskService.getAllTasks();
        const found = all.find((t) => t.title.toLowerCase().trim() === title.toLowerCase().trim());
        if (found) targetId = found._id;
      }

      if (!targetId) {
        return JSON.stringify({ success: false, message: `Task "${title || taskId}" not found.` });
      }

      const all = await taskService.getAllTasks();
      const task = all.find((t) => t._id === targetId);
      if (!task) {
        return JSON.stringify({ success: false, message: `Task ${targetId} not found.` });
      }

      let currentStart = task.scheduledStart ? new Date(task.scheduledStart) : new Date();
      if (isNaN(currentStart.getTime())) currentStart = new Date();

      if (snoozeToTomorrow) {
        currentStart.setDate(currentStart.getDate() + 1);
      } else if (snoozeHours) {
        currentStart.setHours(currentStart.getHours() + snoozeHours);
      } else if (snoozeMinutes) {
        currentStart.setMinutes(currentStart.getMinutes() + snoozeMinutes);
      } else {
        currentStart.setHours(currentStart.getHours() + 1);
      }

      const newStartIso = currentStart.toISOString();
      const newEndIso = new Date(currentStart.getTime() + (task.estimatedMinutes || 30) * 60000).toISOString();

      const updated = await taskService.updateTask(targetId, {
        scheduledStart: newStartIso,
        scheduledEnd: newEndIso,
      });

      return JSON.stringify({
        success: !!updated,
        message: updated
          ? `Snoozed task "${updated.title}" to ${new Date(newStartIso).toLocaleTimeString()}`
          : 'Failed to snooze task.',
        task: updated,
      });
    },
    {
      name: 'snooze_task',
      description: 'Postpone or snooze a task by minutes, hours, or to tomorrow.',
      schema: z.object({
        taskId: z.string().optional().describe('Task ID to snooze'),
        title: z.string().optional().describe('Task title if ID is unknown'),
        snoozeMinutes: z.number().optional().describe('Minutes to delay'),
        snoozeHours: z.number().optional().describe('Hours to delay'),
        snoozeToTomorrow: z.boolean().optional().describe('Postpone task to tomorrow'),
      }),
    }
  );

  const createSubtaskTool = tool(
    async ({ taskId, title, subtaskTitle }) => {
      if (!taskService) return 'Task service unavailable.';
      let targetId = taskId;

      if (!targetId && title) {
        const all = await taskService.getAllTasks();
        const found = all.find((t) => t.title.toLowerCase().trim() === title.toLowerCase().trim());
        if (found) targetId = found._id;
      }

      if (!targetId) {
        return JSON.stringify({ success: false, message: `Task "${title || taskId}" not found.` });
      }

      const updated = await taskService.addSubtask(targetId, subtaskTitle);
      return JSON.stringify({
        success: !!updated,
        message: updated ? `Subtask "${subtaskTitle}" added to task "${updated.title}".` : 'Failed to add subtask.',
        task: updated,
      });
    },
    {
      name: 'create_subtask',
      description: 'Add a subtask to an existing task.',
      schema: z.object({
        taskId: z.string().optional().describe('Target task ID'),
        title: z.string().optional().describe('Target task title if ID unknown'),
        subtaskTitle: z.string().describe('Title of the subtask to add'),
      }),
    }
  );

  const deleteSubtaskTool = tool(
    async ({ taskId, subtaskId }) => {
      if (!taskService) return 'Task service unavailable.';
      const updated = await taskService.deleteSubtask(taskId, subtaskId);
      return JSON.stringify({
        success: !!updated,
        message: updated ? `Subtask deleted from task.` : 'Failed to delete subtask.',
        task: updated,
      });
    },
    {
      name: 'delete_subtask',
      description: 'Delete a subtask from a task.',
      schema: z.object({
        taskId: z.string().describe('Parent task ID'),
        subtaskId: z.string().describe('Subtask ID to remove'),
      }),
    }
  );

  const getListsTool = tool(
    async () => {
      const lists = await taskListService.getAllLists();
      const formatted = lists.map((l) => ({ id: l._id, title: l.title, expiresAt: l.expiresAt }));
      return JSON.stringify({ count: formatted.length, lists: formatted });
    },
    {
      name: 'get_lists',
      description: 'Fetch all current task categories / lists from the database.',
      schema: z.object({}),
    }
  );

  const createListTool = tool(
    async ({ title, expiresAt }) => {
      const newList = await taskListService.createList(title, expiresAt);
      return JSON.stringify({
        success: true,
        message: `Category "${newList.title}" created.` + (newList.expiresAt ? ` (Expires at ${newList.expiresAt})` : ''),
        category: { id: newList._id, title: newList.title, expiresAt: newList.expiresAt },
      });
    },
    {
      name: 'create_list',
      description: 'Create a new task category / list. Optionally provide an expiresAt ISO timestamp for temporary lists.',
      schema: z.object({
        title: z.string().describe('Name of the new category'),
        expiresAt: z.string().optional().describe('Optional ISO date timestamp when this list should automatically expire/disappear.'),
      }),
    }
  );

  const deleteListTool = tool(
    async ({ listId }) => {
      if (listId && (listId.toLowerCase() === 'all' || listId.toLowerCase() === 'all_lists' || listId.toLowerCase() === 'all categories')) {
        const count = await taskListService.deleteAllLists();
        return JSON.stringify({ success: true, count, message: `Deleted all ${count} categories/lists.` });
      }
      const res = await taskListService.deleteListAndTasks(listId);
      return JSON.stringify({
        success: true,
        message: `Category "${res.deletedList}" deleted along with ${res.deletedTaskCount} tasks.`,
      });
    },
    {
      name: 'delete_list',
      description: 'Delete a task category and all tasks contained inside it. Pass "all" to delete all categories.',
      schema: z.object({
        listId: z.string().describe('ID or title of category to delete, or "all" to delete all categories'),
      }),
    }
  );

  const deleteAllListsTool = tool(
    async () => {
      const count = await taskListService.deleteAllLists();
      return JSON.stringify({ success: true, count, message: `Deleted all ${count} task categories/lists.` });
    },
    {
      name: 'delete_all_lists',
      description: 'Delete ALL task categories / lists from the database.',
      schema: z.object({}),
    }
  );

  const replanDayTool = tool(
    async ({ fixedEvents }) => {
      if (!taskService) return 'Task service unavailable.';
      const currentTasks = await taskService.getAllTasks();
      const events = fixedEvents || [{ title: 'Lectures', startHour: 9, endHour: 16 }];
      const { tasks: replanned, schedule } = automaticReplanner.replanFromCurrentTime(currentTasks, events);

      for (const t of replanned) {
        if (t._id) {
          await taskService.updateTask(t._id, {
            scheduledStart: t.scheduledStart,
            scheduledEnd: t.scheduledEnd,
          });
        }
      }

      return JSON.stringify({
        success: true,
        replannedCount: replanned.length,
        message: `Successfully replanned ${replanned.length} tasks starting from current time.`,
      });
    },
    {
      name: 'replan_day',
      description: 'Automatically recalculate and replan today schedule for all pending tasks.',
      schema: z.object({
        fixedEvents: z.array(z.object({ title: z.string(), startHour: z.number(), endHour: z.number() })).optional(),
      }),
    }
  );

  const createAgentGoalTool = tool(
    async ({ title, actionType, targetExecutionTime, listTitle }) => {
      let targetTime = targetExecutionTime;
      if (!targetTime) {
        const tmr = new Date();
        tmr.setDate(tmr.getDate() + 1);
        tmr.setHours(8, 0, 0, 0);
        targetTime = tmr.toISOString();
      }

      const agentGoal = await aiAgentGoalService.createAgentGoal({
        title: title || 'AI Autonomous Action',
        actionType: actionType || 'delete_list_and_tasks',
        targetExecutionTime: targetTime,
        payload: listTitle ? { listTitle } : {},
      });

      return JSON.stringify({
        success: true,
        message: `AI Agent Goal "${agentGoal.title}" scheduled for execution.`,
        goal: agentGoal,
      });
    },
    {
      name: 'create_ai_agent_goal',
      description: 'Register an autonomous background goal for the AI to execute at a scheduled time.',
      schema: z.object({
        title: z.string().describe('Title of the AI goal'),
        actionType: z.string().describe('Type of background action'),
        targetExecutionTime: z.string().optional().describe('ISO timestamp for execution'),
        listTitle: z.string().optional().describe('Exact category/list title to delete (if actionType is delete_list_and_tasks)'),
      }),
    }
  );

  const getActiveAiGoalsTool = tool(
    async () => {
      const goals = await aiAgentGoalService.getAllAgentGoals();
      const pending = goals.filter((g) => g.status === 'pending');
      const formatted = pending.map((g) => ({
        id: g._id,
        title: g.title,
        actionType: g.actionType,
        targetExecutionTime: g.targetExecutionTime,
        payload: g.payload,
      }));
      return JSON.stringify({ count: formatted.length, goals: formatted });
    },
    {
      name: 'get_active_ai_goals',
      description: 'Fetch all pending background autonomous AI goals scheduled in the system.',
      schema: z.object({}),
    }
  );

  const cancelAiAgentGoalTool = tool(
    async ({ goalId }) => {
      const success = await aiAgentGoalService.cancelAgentGoal(goalId);
      return JSON.stringify({
        success,
        message: success ? `AI Goal ${goalId} cancelled.` : `AI Goal ${goalId} not found.`,
      });
    },
    {
      name: 'cancel_ai_agent_goal',
      description: 'Cancel a pending autonomous AI background goal by ID.',
      schema: z.object({
        goalId: z.string().describe('ID of the AI goal to cancel'),
      }),
    }
  );

  return [
    getTasksTool,
    getListsTool,
    createTaskTool,
    batchCreateTasksTool,
    updateTaskTool,
    bulkUpdateTasksTool,
    completeTaskTool,
    deleteTaskTool,
    deleteAllTasksTool,
    searchTasksTool,
    getTodayAgendaTool,
    snoozeTaskTool,
    createSubtaskTool,
    deleteSubtaskTool,
    createListTool,
    deleteListTool,
    deleteAllListsTool,
    replanDayTool,
    createAgentGoalTool,
    getActiveAiGoalsTool,
    cancelAiAgentGoalTool,
    readScratchpadTool,
    scheduleSelfAlarmTool,
  ];
}
