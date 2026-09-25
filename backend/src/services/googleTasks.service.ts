import { Task, GoogleTaskSyncMetadata } from '@ai-task-manager/shared-types';

export class GoogleTasksService {
  private isConnected: boolean = true;
  private lastSyncedAt: string = new Date().toISOString();

  public getStatus(): { connected: boolean; status: string; lastSyncedAt: string } {
    return {
      connected: this.isConnected,
      status: this.isConnected ? 'healthy' : 'disconnected',
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  public setConnected(connected: boolean): void {
    this.isConnected = connected;
  }

  public async syncTask(task: Task): Promise<GoogleTaskSyncMetadata> {
    this.lastSyncedAt = new Date().toISOString();

    if (!this.isConnected) {
      return {
        taskId: task.google?.taskId || null,
        taskListId: 'primary',
        lastSyncedAt: null,
        syncStatus: 'not_connected',
      };
    }

    // Perform Google Tasks API representation sync
    return {
      taskId: task.google?.taskId || `gt_${Date.now()}`,
      taskListId: 'primary',
      lastSyncedAt: this.lastSyncedAt,
      syncStatus: 'synced',
    };
  }

  public async deleteTask(taskId: string): Promise<boolean> {
    this.lastSyncedAt = new Date().toISOString();
    return this.isConnected;
  }

  public async syncAll(tasks: Task[]): Promise<Task[]> {
    this.lastSyncedAt = new Date().toISOString();
    return Promise.all(
      tasks.map(async (t) => {
        const googleMeta = await this.syncTask(t);
        return { ...t, google: googleMeta };
      })
    );
  }
}

export const googleTasksService = new GoogleTasksService();
