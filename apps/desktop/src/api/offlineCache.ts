import { Task, Goal, Memory, OfflineMutation, SyncFlushResponse, AIProviderConfig } from '@ai-task-manager/shared-types';

const STORAGE_KEYS = {
  TASKS: 'ai_task_manager_cached_tasks',
  GOALS: 'ai_task_manager_cached_goals',
  MEMORIES: 'ai_task_manager_cached_memories',
  AI_CONFIG: 'ai_task_manager_cached_aiconfig',
  SERVER_URL: 'ai_task_manager_server_url',
  OFFLINE_QUEUE: 'ai_task_manager_offline_queue',
};

export class OfflineCacheManager {
  // Server URL Cache
  public getServerUrl(): string {
    try {
      const url = localStorage.getItem(STORAGE_KEYS.SERVER_URL);
      if (url && url.trim()) return url.trim();
    } catch {}
    // Default fallback: if running on mobile Android device, try host network IP
    const isMobile = typeof window !== 'undefined' && (
      !!(window as any).__TAURI_INTERNALS__ ||
      /android/i.test(navigator?.userAgent || '')
    );
    if (isMobile) {
      return 'http://10.143.32.161:3001/api';
    }
    return 'http://localhost:3001/api';
  }

  public setServerUrl(url: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVER_URL, url.trim());
    } catch {}
  }

  // AI Config Cache
  public getCachedAIConfig(): AIProviderConfig | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AI_CONFIG);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public setCachedAIConfig(config: AIProviderConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(config));
    } catch {}
  }
  // Task Cache
  public getCachedTasks(): Task[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public setCachedTasks(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {}
  }

  // Goal Cache
  public getCachedGoals(): Goal[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public setCachedGoals(goals: Goal[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    } catch {}
  }

  // Memory Cache
  public getCachedMemories(): Memory[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public setCachedMemories(memories: Memory[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories));
    } catch {}
  }

  // Offline Mutation Queue
  public getOfflineQueue(): OfflineMutation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public enqueueMutation(mutation: Omit<OfflineMutation, 'id' | 'clientTimestamp'>): OfflineMutation {
    const queue = this.getOfflineQueue();
    const item: OfflineMutation = {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      clientTimestamp: new Date().toISOString(),
    };
    queue.push(item);
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch {}
    return item;
  }

  public clearOfflineQueue(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    } catch {}
  }

  // Flush offline operations to backend
  public async flush(baseUrl: string): Promise<SyncFlushResponse | null> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return null;

    try {
      const res = await fetch(`${baseUrl}/sync/flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: queue }),
      });

      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        this.clearOfflineQueue();
        const response: SyncFlushResponse = json.data;
        if (response.syncedTasks) this.setCachedTasks(response.syncedTasks);
        if (response.syncedGoals) this.setCachedGoals(response.syncedGoals);
        if (response.syncedMemories) this.setCachedMemories(response.syncedMemories);
        return response;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const offlineCache = new OfflineCacheManager();
