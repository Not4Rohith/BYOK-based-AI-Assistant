import { Task, TaskList } from '@ai-task-manager/shared-types';
import { mobileSecureStore, SecureCredentials } from './secureStore';

const CANDIDATE_API_BASES = [
  'http://10.0.2.2:3001/api',       // Android emulator bridge to host loopback
  'http://10.164.151.34:3001/api',  // Active host LAN IP
  'http://10.143.32.161:3001/api',  // Previous host LAN IP
  'http://localhost:3001/api',      // Web & iOS simulator
];

export class MobileStorageService {
  private activeBaseUrl: string = CANDIDATE_API_BASES[0];
  private isConnected: boolean = false;
  private tasks: Task[] = [];
  private taskLists: TaskList[] = [];

  private async fetchWithFallback<T>(endpoint: string, options?: RequestInit, timeoutMs = 4000): Promise<T | null> {
    const urlsToTry = [
      `${this.activeBaseUrl}${endpoint}`,
      ...CANDIDATE_API_BASES.filter((b) => b !== this.activeBaseUrl).map((b) => `${b}${endpoint}`),
    ];

    for (const url of urlsToTry) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          ...options,
        });
        clearTimeout(timer);

        if (res.ok) {
          const matchedBase = CANDIDATE_API_BASES.find((b) => url.startsWith(b));
          if (matchedBase) this.activeBaseUrl = matchedBase;
          this.isConnected = true;
          const json = await res.json();
          return (json.data !== undefined ? json.data : json) as T;
        }
      } catch {
        // Continue to candidate
      }
    }

    this.isConnected = false;
    return null;
  }

  public getOnlineStatus(): boolean {
    return this.isConnected;
  }

  public async saveEncryptedCredentials(creds: SecureCredentials): Promise<void> {
    if (creds.openrouterKey) await mobileSecureStore.setItem('openrouter_key', creds.openrouterKey);
    if (creds.geminiKey) await mobileSecureStore.setItem('gemini_key', creds.geminiKey);
    if (creds.grokKey) await mobileSecureStore.setItem('grok_key', creds.grokKey);
    if (creds.mongoUri) await mobileSecureStore.setItem('mongo_uri', creds.mongoUri);
  }

  public async getEncryptedCredentials(): Promise<SecureCredentials> {
    return {
      openrouterKey: (await mobileSecureStore.getItem('openrouter_key')) || undefined,
      geminiKey: (await mobileSecureStore.getItem('gemini_key')) || undefined,
      grokKey: (await mobileSecureStore.getItem('grok_key')) || undefined,
      mongoUri: (await mobileSecureStore.getItem('mongo_uri')) || undefined,
    };
  }

  public async getTasks(): Promise<Task[]> {
    const remote = await this.fetchWithFallback<Task[]>('/tasks');
    if (remote) {
      this.tasks = remote;
      return this.tasks;
    }
    return this.tasks;
  }

  public async getTaskLists(): Promise<TaskList[]> {
    const remote = await this.fetchWithFallback<TaskList[]>('/lists');
    if (remote) {
      this.taskLists = remote;
      return this.taskLists;
    }
    return this.taskLists;
  }

  public async toggleTask(id: string): Promise<Task[]> {
    const target = this.tasks.find((t) => t._id === id);
    if (!target) return this.tasks;

    const nextStatus = target.status === 'completed' ? 'pending' : 'completed';
    this.tasks = this.tasks.map((t) => (t._id === id ? { ...t, status: nextStatus } : t));

    this.fetchWithFallback(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => {});

    return this.tasks;
  }

  public async toggleStar(id: string): Promise<Task[]> {
    const target = this.tasks.find((t) => t._id === id);
    if (!target) return this.tasks;

    const nextStarred = !target.starred;
    this.tasks = this.tasks.map((t) => (t._id === id ? { ...t, starred: nextStarred } : t));

    this.fetchWithFallback(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ starred: nextStarred }),
    }).catch(() => {});

    return this.tasks;
  }

  public async addTask(title: string, listId?: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<Task[]> {
    const newTask: Task = {
      _id: `mob_task_${Date.now()}`,
      userId: 'usr_1',
      listId: listId || (this.taskLists[0]?._id ?? 'default'),
      title,
      status: 'pending',
      priority,
      estimatedMinutes: 45,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.unshift(newTask);

    const remoteCreated = await this.fetchWithFallback<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(newTask),
    });

    if (remoteCreated && remoteCreated._id) {
      this.tasks = this.tasks.map((t) => (t._id === newTask._id ? remoteCreated : t));
    }

    return this.tasks;
  }

  public async deleteTask(id: string): Promise<Task[]> {
    this.tasks = this.tasks.filter((t) => t._id !== id);
    this.fetchWithFallback(`/tasks/${id}`, { method: 'DELETE' }).catch(() => {});
    return this.tasks;
  }
}

export const mobileStorage = new MobileStorageService();
