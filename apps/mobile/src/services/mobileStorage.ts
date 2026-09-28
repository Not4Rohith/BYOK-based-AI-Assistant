import { Task, Goal, Memory, AIProviderConfig } from '@ai-task-manager/shared-types';
import { mobileSecureStore, SecureCredentials } from './secureStore';

export class MobileStorageService {
  private tasks: Task[] = [

  ];

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
    return this.tasks;
  }

  public async toggleTask(id: string): Promise<Task[]> {
    this.tasks = this.tasks.map((t) =>
      t._id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
    );
    return this.tasks;
  }

  public async addTask(title: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<Task[]> {
    const newTask: Task = {
      _id: `mob_task_${Date.now()}`,
      userId: 'usr_1',
      title,
      status: 'pending',
      priority,
      estimatedMinutes: 45,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.unshift(newTask);
    return this.tasks;
  }
}

export const mobileStorage = new MobileStorageService();
