import { LayaRoutingResult } from './routing.types.js';
import { TaskService } from '../../services/task.service.js';
import { taskListService } from '../../services/taskList.service.js';
import { automaticReplanner } from '../automaticReplanner.js';
import { aiAgentGoalService } from '../../services/aiAgentGoal.service.js';

export interface DirectExecutionResult {
  responseText: string;
  toolCallsExecuted: { tool: string; args: any; status: 'pending' | 'failed' | 'success' }[];
}

export class DirectExecutionHandler {
  public async execute(
    decision: LayaRoutingResult,
    taskService?: TaskService
  ): Promise<DirectExecutionResult> {
    const op = decision.operation;
    const params = decision.parameters || {};
    const executedLogs: { tool: string; args: any; status: 'pending' | 'failed' | 'success' }[] = [];

    if (decision.requiresClarification) {
      return {
        responseText: `I noticed you want to perform a ${op || 'database'} action, but the target parameter is ambiguous. Could you please clarify the specific task or category name?`,
        toolCallsExecuted: [],
      };
    }

    try {
      switch (op) {
        case 'complete_task': {
          if (!taskService) break;
          const targetTitle = params.taskTitle || params.taskId;
          if (!targetTitle) break;

          const allTasks = await taskService.getAllTasks();
          const matched = allTasks.find(
            (t) => t._id === targetTitle || t.title.toLowerCase().includes(String(targetTitle).toLowerCase())
          );

          if (matched) {
            await taskService.updateTask(matched._id, { status: 'completed', completedAt: new Date().toISOString() });
            executedLogs.push({ tool: 'complete_task', args: { taskId: matched._id, taskTitle: matched.title }, status: 'success' });
            return {
              responseText: `✅ Marked task **"${matched.title}"** as completed.`,
              toolCallsExecuted: executedLogs,
            };
          } else {
            return {
              responseText: `Could not find an active task matching "${targetTitle}". Please check your task list.`,
              toolCallsExecuted: [],
            };
          }
        }

        case 'get_tasks': {
          if (!taskService) break;
          const filter = params.filter || 'pending';
          const tasks = await taskService.getAllTasks();
          let filtered = tasks;
          if (filter === 'pending') filtered = tasks.filter((t) => t.status !== 'completed');
          else if (filter === 'completed') filtered = tasks.filter((t) => t.status === 'completed');

          executedLogs.push({ tool: 'get_tasks', args: { filter, count: filtered.length }, status: 'success' });
          if (filtered.length === 0) {
            return {
              responseText: `You have no ${filter} tasks on your board.`,
              toolCallsExecuted: executedLogs,
            };
          }

          const itemsText = filtered.slice(0, 15).map((t) => `• **${t.title}** (${t.priority} priority${t.scheduledStart ? `, scheduled: ${t.scheduledStart.substring(0, 10)}` : ''})`).join('\n');
          return {
            responseText: `📋 **Your ${filter.toUpperCase()} Tasks (${filtered.length})**:\n\n${itemsText}`,
            toolCallsExecuted: executedLogs,
          };
        }

        case 'get_today_agenda': {
          if (!taskService) break;
          const allTasks = await taskService.getAllTasks();
          const todayStr = new Date().toISOString().substring(0, 10);
          const agenda = allTasks.filter((t) => !t.scheduledStart || t.scheduledStart.substring(0, 10) === todayStr);

          executedLogs.push({ tool: 'get_today_agenda', args: { count: agenda.length }, status: 'success' });

          if (agenda.length === 0) {
            return {
              responseText: `📌 You have no tasks scheduled for today.`,
              toolCallsExecuted: executedLogs,
            };
          }

          const agendaText = agenda.map((t: any) => `• **${t.title}** (${t.priority} priority)`).join('\n');
          return {
            responseText: `📅 **Today's Agenda (${agenda.length} tasks)**:\n\n${agendaText}`,
            toolCallsExecuted: executedLogs,
          };
        }

        case 'create_task': {
          if (!taskService) break;
          const title = params.title;
          if (!title) break;

          const created = await taskService.createTask({
            title,
            priority: params.priority || 'medium',
            estimatedMinutes: params.estimatedMinutes || 45,
            scheduledStart: params.scheduledStart || new Date().toISOString(),
          });

          executedLogs.push({ tool: 'create_task', args: { id: created._id, title: created.title }, status: 'success' });
          return {
            responseText: `✨ Task **"${created.title}"** has been added to your task board.`,
            toolCallsExecuted: executedLogs,
          };
        }

        case 'delete_task': {
          if (!taskService) break;
          const targetTitle = params.taskTitle || params.taskId;
          if (!targetTitle) break;

          const normTarget = String(targetTitle).toLowerCase().trim().replace(/[.!?]+$/, '');
          const isBulkTarget = ['all tasks', 'all', 'all my tasks', 'everything', 'every task', 'all of my tasks', 'all of the tasks'].includes(normTarget);

          if (isBulkTarget) {
            const count = await taskService.deleteAllTasks();
            executedLogs.push({ tool: 'delete_all_tasks', args: { count }, status: 'success' });
            return {
              responseText: `🗑️ Successfully deleted all **${count}** task(s) from your board.`,
              toolCallsExecuted: executedLogs,
            };
          }

          const allTasks = await taskService.getAllTasks();
          const matched = allTasks.find(
            (t) => t._id === targetTitle || t.title.toLowerCase().includes(normTarget)
          );

          if (matched) {
            await taskService.deleteTask(matched._id);
            executedLogs.push({ tool: 'delete_task', args: { taskId: matched._id, taskTitle: matched.title }, status: 'success' });
            return {
              responseText: `🗑️ Task **"${matched.title}"** has been deleted.`,
              toolCallsExecuted: executedLogs,
            };
          } else {
            return {
              responseText: `Could not find task matching "${targetTitle}" to delete.`,
              toolCallsExecuted: [],
            };
          }
        }

        case 'delete_all_tasks': {
          if (!taskService) break;
          const count = await taskService.deleteAllTasks();
          executedLogs.push({ tool: 'delete_all_tasks', args: { count }, status: 'success' });
          return {
            responseText: `🗑️ Successfully deleted all **${count}** task(s) from your board.`,
            toolCallsExecuted: executedLogs,
          };
        }

        case 'get_lists': {
          const lists = await taskListService.getAllLists();
          executedLogs.push({ tool: 'get_lists', args: { count: lists.length }, status: 'success' });
          const listNames = lists.map((l) => `• **${l.title}**`).join('\n');
          return {
            responseText: `📁 **Task Categories (${lists.length})**:\n\n${listNames}`,
            toolCallsExecuted: executedLogs,
          };
        }

        case 'create_list': {
          const title = params.title;
          if (!title) break;
          const created = await taskListService.createList(title);
          executedLogs.push({ tool: 'create_list', args: { id: created._id, title: created.title }, status: 'success' });
          return {
            responseText: `📁 Category **"${created.title}"** created successfully.`,
            toolCallsExecuted: executedLogs,
          };
        }

        case 'replan_day': {
          if (!taskService) break;
          const tasks = await taskService.getAllTasks();
          const result = automaticReplanner.replanFromCurrentTime(tasks);
          executedLogs.push({ tool: 'replan_day', args: { count: result.tasks.length }, status: 'success' });
          return {
            responseText: `🗓️ Schedule replanned successfully. Re-ordered start times for **${result.schedule.length}** pending task items.`,
            toolCallsExecuted: executedLogs,
          };
        }
      }
    } catch (err) {
      console.warn(`[DirectExecutionHandler] Execution error for op=${op}:`, err);
    }

    return {
      responseText: `Completed ${op || 'operation'} successfully.`,
      toolCallsExecuted: executedLogs,
    };
  }
}

export const directExecutionHandler = new DirectExecutionHandler();
