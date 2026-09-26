import { TaskList } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { TaskListModel } from '../db/models/TaskList.model.js';
import { TaskModel } from '../db/models/Task.model.js';
import { TaskService } from './task.service.js';

export const DEFAULT_TASK_LISTS: TaskList[] = [];

export class TaskListService {
  private inMemoryLists: TaskList[] = [];

  constructor(private taskService?: TaskService) {}

  public async getAllLists(): Promise<TaskList[]> {
    const now = new Date();
    const nowIso = now.toISOString();

    if (dbConnection.getStatus().connected) {
      const existingDocs = await TaskListModel.find({
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      }).sort({ createdAt: 1 });
      if (existingDocs.length === 0) {
        const defaultDoc = await TaskListModel.create({
          _id: 'list_default',
          userId: 'usr_1',
          title: 'My Tasks',
        });
        return [this.mapDocToList(defaultDoc)];
      }
      return existingDocs.map(this.mapDocToList);
    }

    if (this.inMemoryLists.length === 0) {
      this.inMemoryLists = [{
        _id: 'list_default',
        userId: 'usr_1',
        title: 'My Tasks',
        createdAt: nowIso,
        updatedAt: nowIso,
      }];
    }
    return this.inMemoryLists.filter(
      (l) => !l.expiresAt || l.expiresAt > nowIso
    );
  }

  public async createList(title: string, expiresAt?: string): Promise<TaskList> {
    const cleanTitle = title.trim();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = normalize(cleanTitle);

    const existing = (await this.getAllLists()).find(
      (l) => normalize(l.title) === targetNorm
    );
    if (existing) return existing;

    const slugId = `list_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;

    if (dbConnection.getStatus().connected) {
      const doc = await TaskListModel.create({
        _id: slugId,
        userId: 'usr_1',
        title: cleanTitle,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      return this.mapDocToList(doc);
    }

    const newList: TaskList = {
      _id: slugId,
      userId: 'usr_1',
      title: cleanTitle,
      expiresAt: expiresAt || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryLists.push(newList);
    return newList;
  }

  public async updateList(id: string, updates: Partial<TaskList>): Promise<TaskList | null> {
    if (dbConnection.getStatus().connected) {
      const doc = await TaskListModel.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );
      if (!doc) return null;
      return this.mapDocToList(doc);
    }

    const item = this.inMemoryLists.find((l) => l._id === id);
    if (!item) return null;
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    return item;
  }

  public async deleteListAndTasks(listIdOrTitle: string): Promise<{ deletedList: string; deletedTaskCount: number; success: boolean }> {
    const cleanTarget = listIdOrTitle.trim().toLowerCase();
    const allLists = await this.getAllLists();
    const targetList = allLists.find(
      (l) => l._id.toLowerCase() === cleanTarget || l.title.toLowerCase() === cleanTarget
    );

    if (!targetList) {
      if (dbConnection.getStatus().connected) {
        const listRes = await TaskListModel.deleteMany({
          $or: [{ _id: listIdOrTitle }, { title: { $regex: `^${listIdOrTitle}$`, $options: 'i' } }],
        });
        const taskRes = await TaskModel.deleteMany({ listId: listIdOrTitle });
        const success = (listRes.deletedCount || 0) > 0;
        return { deletedList: listIdOrTitle, deletedTaskCount: taskRes.deletedCount || 0, success };
      }
      return { deletedList: listIdOrTitle, deletedTaskCount: 0, success: false };
    }

    const targetListId = targetList._id;
    let deletedTaskCount = 0;

    if (dbConnection.getStatus().connected) {
      await TaskListModel.findByIdAndDelete(targetListId);
      const res = await TaskModel.deleteMany({ listId: targetListId });
      deletedTaskCount = res.deletedCount || 0;
    } else {
      this.inMemoryLists = this.inMemoryLists.filter((l) => l._id !== targetListId);
      if (this.taskService) {
        const allTasks = await this.taskService.getAllTasks();
        const tasksToDelete = allTasks.filter((t) => t.listId === targetListId);
        for (const t of tasksToDelete) {
          await this.taskService.deleteTask(t._id);
        }
        deletedTaskCount = tasksToDelete.length;
      }
    }

    console.log(`[TaskListService] Deleted list "${targetList.title}" (${targetListId}) and ${deletedTaskCount} associated tasks.`);
    return { deletedList: targetList.title, deletedTaskCount, success: true };
  }

  public async deleteAllLists(): Promise<number> {
    let count = 0;
    if (dbConnection.getStatus().connected) {
      const res = await TaskListModel.deleteMany({});
      count = res.deletedCount || 0;
    } else {
      count = this.inMemoryLists.length;
      this.inMemoryLists = [];
    }
    console.log(`[TaskListService] Deleted all ${count} task lists/categories.`);
    return count;
  }

  private mapDocToList(doc: any): TaskList {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      icon: doc.icon,
      color: doc.color,
      expiresAt: doc.expiresAt ? (doc.expiresAt instanceof Date ? doc.expiresAt.toISOString() : doc.expiresAt) : undefined,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
    };
  }
}

export const taskListService = new TaskListService();
