import { Task, GoogleTaskSyncMetadata } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { TaskModel } from '../db/models/Task.model.js';
import { googleTasksService } from './googleTasks.service.js';

export const DEFAULT_INITIAL_TASKS: Task[] = [];

export class TaskService {
  private inMemoryTasks: Task[] = [];

  public async getAllTasks(): Promise<Task[]> {
    const now = new Date();
    const nowIso = now.toISOString();

    if (dbConnection.getStatus().connected) {
      // 1. Remove any invalid meta-tasks created by LLM prompt echoing
      await TaskModel.deleteMany({
        $or: [
          { title: { $regex: /^(delete all|add today's tasks|add all tasks|add tasks)/i } },
          { title: { $regex: /delete.*available.*tasks/i } },
        ],
      });

      const existingDocs = await TaskModel.find({
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      }).sort({ createdAt: -1 });
      return existingDocs.map(this.mapDocToTask);
    }
    return this.inMemoryTasks.filter(
      (t) => !t.expiresAt || t.expiresAt > nowIso
    );
  }

  public async deleteAllTasks(): Promise<number> {
    if (dbConnection.getStatus().connected) {
      const res = await TaskModel.deleteMany({});
      return res.deletedCount || 0;
    }
    const count = this.inMemoryTasks.length;
    this.inMemoryTasks = [];
    return count;
  }

  public async createTask(data: Partial<Task>): Promise<Task> {
    const targetTitle = (data.title || '').trim().toLowerCase();
    if (targetTitle && data.listId) {
      const all = await this.getAllTasks();
      const existing = all.find(
        (t) => t.status !== 'completed' && t.title.trim().toLowerCase() === targetTitle && t.listId === data.listId
      );
      if (existing) {
        console.log(`[TaskService] Preventing duplicate task creation for "${data.title}" in list ${data.listId}. Returning existing task ${existing._id}.`);
        if (data.scheduledStart || data.description || data.recurrence) {
          const updated = await this.updateTask(existing._id, {
            ...(data.scheduledStart ? { scheduledStart: data.scheduledStart } : {}),
            ...(data.description ? { description: data.description } : {}),
            ...(data.recurrence ? { recurrence: data.recurrence } : {}),
          });
          if (updated) return updated;
        }
        return existing;
      }
    }

    const defaultGoogleMeta: GoogleTaskSyncMetadata = {
      taskId: `gt_${Date.now()}`,
      taskListId: 'primary',
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'synced',
    };

    const recurrenceConfig = data.recurrence || {
      enabled: !!(data.tags?.includes('recurring') || (data as any).category?.startsWith('FREQ=')),
      rule: (data as any).category?.startsWith('FREQ=') ? (data as any).category : 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      timezone: 'Asia/Kolkata',
    };

    if (dbConnection.getStatus().connected) {
      const doc = await TaskModel.create({
        userId: data.userId || 'usr_1',
        title: data.title || 'Untitled Task',
        description: data.description,
        status: data.status || 'pending',
        priority: data.priority || 'medium',
        starred: !!data.starred,
        listId: data.listId || null,
        estimatedMinutes: data.estimatedMinutes || 30,
        scheduledStart: data.scheduledStart || new Date().toISOString(),
        scheduledEnd:
          data.scheduledEnd ||
          new Date(Date.now() + (data.estimatedMinutes || 30) * 60000).toISOString(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        subtasks: data.subtasks || [],
        recurrence: recurrenceConfig,
        google: defaultGoogleMeta,
      });

      const task = this.mapDocToTask(doc);
      googleTasksService.syncTask(task).catch(() => {});
      return task;
    }

    const newTask: Task = {
      _id: `task_${Date.now()}`,
      userId: data.userId || 'usr_1',
      title: data.title || 'Untitled Task',
      description: data.description,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      starred: !!data.starred,
      listId: data.listId || undefined,
      estimatedMinutes: data.estimatedMinutes || 30,
      scheduledStart: data.scheduledStart || new Date().toISOString(),
      scheduledEnd:
        data.scheduledEnd ||
        new Date(Date.now() + (data.estimatedMinutes || 30) * 60000).toISOString(),
      expiresAt: data.expiresAt || undefined,
      subtasks: data.subtasks || [],
      recurrence: recurrenceConfig,
      google: defaultGoogleMeta,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryTasks.unshift(newTask);
    googleTasksService.syncTask(newTask).catch(() => {});
    return newTask;
  }

  public async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    if (dbConnection.getStatus().connected) {
      const doc = await TaskModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? this.mapDocToTask(doc) : null;
    }

    const index = this.inMemoryTasks.findIndex((t) => t._id === id);
    if (index === -1) return null;
    this.inMemoryTasks[index] = {
      ...this.inMemoryTasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.inMemoryTasks[index];
  }

  public async toggleTask(id: string): Promise<Task | null> {
    if (dbConnection.getStatus().connected) {
      const doc = await TaskModel.findById(id);
      if (!doc) return null;
      doc.status = doc.status === 'completed' ? 'pending' : 'completed';
      doc.completedAt = doc.status === 'completed' ? new Date().toISOString() : null;
      await doc.save();
      return this.mapDocToTask(doc);
    }

    const index = this.inMemoryTasks.findIndex((t) => t._id === id);
    if (index === -1) return null;
    const isDone = this.inMemoryTasks[index].status === 'completed';
    this.inMemoryTasks[index] = {
      ...this.inMemoryTasks[index],
      status: isDone ? 'pending' : 'completed',
      completedAt: isDone ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.inMemoryTasks[index];
  }

  public async deleteTask(id: string): Promise<boolean> {
    if (dbConnection.getStatus().connected) {
      const res = await TaskModel.findByIdAndDelete(id);
      return res !== null;
    }

    const index = this.inMemoryTasks.findIndex((t) => t._id === id);
    if (index === -1) return false;
    this.inMemoryTasks.splice(index, 1);
    return true;
  }

  // Subtask Management Engine
  public async addSubtask(taskId: string, subtaskTitle: string): Promise<Task | null> {
    const newSubtask = { _id: `st_${Date.now()}`, title: subtaskTitle, completed: false };

    if (dbConnection.getStatus().connected) {
      const doc = await TaskModel.findById(taskId);
      if (!doc) return null;
      if (!doc.subtasks) (doc as any).subtasks = [];
      (doc.subtasks as any[]).push(newSubtask);
      await doc.save();
      return this.mapDocToTask(doc);
    }

    const task = this.inMemoryTasks.find((t) => t._id === taskId);
    if (!task) return null;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push(newSubtask);
    task.updatedAt = new Date().toISOString();
    return task;
  }

  public async toggleSubtask(taskId: string, subtaskId: string): Promise<Task | null> {
    if (dbConnection.getStatus().connected) {
      const doc = await TaskModel.findById(taskId);
      if (!doc || !doc.subtasks) return null;
      const st = doc.subtasks.find((s: any) => s._id.toString() === subtaskId || s._id === subtaskId);
      if (st) st.completed = !st.completed;
      await doc.save();
      return this.mapDocToTask(doc);
    }

    const task = this.inMemoryTasks.find((t) => t._id === taskId);
    if (!task || !task.subtasks) return null;
    const st = task.subtasks.find((s) => s._id === subtaskId);
    if (st) st.completed = !st.completed;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  public async deleteSubtask(taskId: string, subtaskId: string): Promise<Task | null> {
    if (dbConnection.getStatus().connected) {
      const doc = await TaskModel.findById(taskId);
      if (!doc || !doc.subtasks) return null;
      doc.subtasks = doc.subtasks.filter(
        (s: any) => s._id.toString() !== subtaskId && s._id !== subtaskId
      ) as any;
      await doc.save();
      return this.mapDocToTask(doc);
    }

    const task = this.inMemoryTasks.find((t) => t._id === taskId);
    if (!task || !task.subtasks) return null;
    task.subtasks = task.subtasks.filter((s) => s._id !== subtaskId);
    task.updatedAt = new Date().toISOString();
    return task;
  }

  private mapDocToTask(doc: any): Task {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      priority: doc.priority,
      starred: doc.starred,
      listId: doc.listId,
      parentTaskId: doc.parentTaskId,
      goalId: doc.goalId,
      estimatedMinutes: doc.estimatedMinutes,
      actualMinutes: doc.actualMinutes,
      dueAt: doc.dueAt,
      scheduledStart: doc.scheduledStart,
      scheduledEnd: doc.scheduledEnd,
      expiresAt: doc.expiresAt ? (doc.expiresAt instanceof Date ? doc.expiresAt.toISOString() : doc.expiresAt) : undefined,
      tags: doc.tags,
      source: doc.source,
      recurrence: doc.recurrence,
      google: doc.google,
      calendar: doc.calendar,
      subtasks: doc.subtasks
        ? doc.subtasks.map((st: any) => ({
            _id: st._id.toString(),
            title: st.title,
            completed: st.completed,
          }))
        : [],
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
      completedAt: doc.completedAt,
    };
  }

}
