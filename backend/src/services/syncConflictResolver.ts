import {
  OfflineMutation,
  SyncFlushRequest,
  SyncFlushResponse,
  SyncFlushResult,
  Task,
  Goal,
  Memory,
} from '@ai-task-manager/shared-types';
import { TaskService } from './task.service.js';
import { GoalService } from './goal.service.js';
import { MemoryService } from './memory.service.js';

export class SyncConflictResolver {
  constructor(
    private taskService: TaskService,
    private goalService: GoalService,
    private memoryService: MemoryService
  ) {}

  public async flushOfflineQueue(req: SyncFlushRequest): Promise<SyncFlushResponse> {
    const results: SyncFlushResult[] = [];

    for (const mutation of req.mutations) {
      try {
        const result = await this.processMutation(mutation);
        results.push(result);
      } catch (err: any) {
        results.push({
          mutationId: mutation.id,
          status: 'failed',
          message: err?.message || 'Failed to process sync mutation',
        });
      }
    }

    const [syncedTasks, syncedGoals, syncedMemories] = await Promise.all([
      this.taskService.getAllTasks(),
      this.goalService.getGoals(),
      this.memoryService.getMemories(),
    ]);

    return {
      results,
      syncedTasks,
      syncedGoals,
      syncedMemories,
    };
  }

  private async processMutation(mutation: OfflineMutation): Promise<SyncFlushResult> {
    const { id, entity, action, payload, clientTimestamp } = mutation;
    const clientTime = new Date(clientTimestamp).getTime();

    if (entity === 'task') {
      const allTasks = await this.taskService.getAllTasks();
      const existing = allTasks.find((t) => t._id === payload._id || t._id === payload.id);

      if (!existing) {
        if (action === 'create' || action === 'update') {
          const created = await this.taskService.createTask(payload);
          return { mutationId: id, status: 'applied', resolvedEntity: created };
        }
        return { mutationId: id, status: 'applied' };
      }

      const serverTime = new Date(existing.updatedAt).getTime();

      if (action === 'delete') {
        if (clientTime >= serverTime) {
          await this.taskService.deleteTask(existing._id);
          return { mutationId: id, status: 'applied' };
        }
        return {
          mutationId: id,
          status: 'conflict_resolved',
          resolvedEntity: existing,
          message: 'Server updated after local deletion request; preserved server version.',
        };
      }

      if (clientTime >= serverTime) {
        const updated = await this.taskService.updateTask(existing._id, payload);
        return { mutationId: id, status: 'applied', resolvedEntity: updated };
      } else {
        // Non-overlapping property merge (client payload overrides unless server had newer timestamp edit)
        const mergedPayload = { ...payload };

        // Preserve server fields if client did not supply them
        for (const key of Object.keys(existing)) {
          if (mergedPayload[key] === undefined) {
            mergedPayload[key] = (existing as any)[key];
          }
        }

        const resolved = await this.taskService.updateTask(existing._id, mergedPayload);
        return {
          mutationId: id,
          status: 'conflict_resolved',
          resolvedEntity: resolved,
          message: 'Timestamp conflict detected: merged non-overlapping fields.',
        };
      }
    }

    if (entity === 'goal') {
      const allGoals = await this.goalService.getGoals();
      const existing = allGoals.find((g) => g._id === payload._id);

      if (!existing) {
        if (action === 'create' || action === 'update') {
          const created = await this.goalService.createGoal(payload);
          return { mutationId: id, status: 'applied', resolvedEntity: created };
        }
        return { mutationId: id, status: 'applied' };
      }

      const serverTime = new Date(existing.updatedAt).getTime();
      if (clientTime >= serverTime) {
        if (action === 'delete') {
          return { mutationId: id, status: 'applied' };
        }
        return { mutationId: id, status: 'applied', resolvedEntity: existing };
      } else {
        return {
          mutationId: id,
          status: 'conflict_resolved',
          resolvedEntity: existing,
          message: 'Server goal is newer.',
        };
      }
    }

    if (entity === 'memory') {
      if (action === 'create') {
        const created = await this.memoryService.createMemory({
          content: payload.content || '',
          category: payload.category || 'preferences',
          source: payload.source || 'explicit_user',
        });
        return { mutationId: id, status: 'applied', resolvedEntity: created };
      }
      if (action === 'delete') {
        await this.memoryService.deleteMemory(payload._id || payload.id);
        return { mutationId: id, status: 'applied' };
      }
    }


    return { mutationId: id, status: 'applied' };
  }
}
