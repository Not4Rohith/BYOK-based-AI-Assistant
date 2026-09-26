import { Task, TaskList, Goal, Memory, ChatMessage, ChatSession, AIProviderConfig, ProductivityAnalytics, AIAgentGoal } from '@ai-task-manager/shared-types';
import { offlineCache } from './offlineCache';

export const getApiBaseUrl = (): string => {
  return offlineCache.getServerUrl();
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second request timeout
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.data !== undefined) return json.data as T;
    return json as T;
  } catch (err) {
    // Android auto-fallback: if target host failed, test candidates (host IP & emulator bridge)
    const currentBase = getApiBaseUrl();
    const candidates = [
      'http://10.143.32.161:3001/api',
      'http://10.0.2.2:3001/api',
    ].filter((c) => !url.startsWith(c));

    for (const candidateBase of candidates) {
      try {
        const fallbackUrl = url.replace(currentBase, candidateBase);
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
        const res2 = await fetch(fallbackUrl, {
          headers: { 'Content-Type': 'application/json' },
          signal: controller2.signal,
          ...options,
        });
        clearTimeout(timeoutId2);
        if (res2.ok) {
          offlineCache.setServerUrl(candidateBase);
          const json2 = await res2.json();
          if (json2.data !== undefined) return json2.data as T;
          return json2 as T;
        }
      } catch { }
    }
    return null;
  }
}

export const api = {
  getTasks: async (): Promise<Task[] | null> => {
    // Attempt automatic flush if pending mutations exist
    offlineCache.flush(getApiBaseUrl()).catch(() => { });

    const tasks = await fetchJson<Task[]>(`${getApiBaseUrl()}/tasks`);
    if (tasks) {
      offlineCache.setCachedTasks(tasks);
      return tasks;
    }
    const cached = offlineCache.getCachedTasks();
    return cached.length > 0 ? cached : null;
  },

  createTask: async (task: Partial<Task>): Promise<Task | null> => {
    const created = await fetchJson<Task>(`${getApiBaseUrl()}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
    if (created) {
      const cached = offlineCache.getCachedTasks();
      offlineCache.setCachedTasks([created, ...cached]);
      return created;
    }
    // Offline fallback
    const offlineTask: Task = {
      _id: `offline_task_${Date.now()}`,
      userId: task.userId || 'usr_1',
      title: task.title || 'Untitled Task',
      description: task.description,
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    offlineCache.enqueueMutation({ entity: 'task', action: 'create', payload: offlineTask });
    const cached = offlineCache.getCachedTasks();
    offlineCache.setCachedTasks([offlineTask, ...cached]);
    return offlineTask;
  },

  updateTask: async (id: string, updates: Partial<Task>): Promise<Task | null> => {
    const updated = await fetchJson<Task>(`${getApiBaseUrl()}/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (updated) {
      const cached = offlineCache.getCachedTasks().map((t) => (t._id === id ? updated : t));
      offlineCache.setCachedTasks(cached);
      return updated;
    }
    // Offline fallback
    const cached = offlineCache.getCachedTasks();
    const existing = cached.find((t) => t._id === id);
    if (!existing) return null;

    const modified = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    offlineCache.enqueueMutation({ entity: 'task', action: 'update', payload: modified });
    offlineCache.setCachedTasks(cached.map((t) => (t._id === id ? modified : t)));
    return modified;
  },

  toggleTask: async (id: string): Promise<Task | null> => {
    const updated = await fetchJson<Task>(`${getApiBaseUrl()}/tasks/${id}/toggle`, {
      method: 'PATCH',
    });
    if (updated) {
      const cached = offlineCache.getCachedTasks().map((t) => (t._id === id ? updated : t));
      offlineCache.setCachedTasks(cached);
      return updated;
    }
    // Offline fallback
    const cached = offlineCache.getCachedTasks();
    const existing = cached.find((t) => t._id === id);
    if (!existing) return null;

    const isDone = existing.status === 'completed';
    const modified: Task = {
      ...existing,
      status: isDone ? 'pending' : 'completed',
      completedAt: isDone ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    offlineCache.enqueueMutation({ entity: 'task', action: 'update', payload: modified });
    offlineCache.setCachedTasks(cached.map((t) => (t._id === id ? modified : t)));
    return modified;
  },

  deleteTask: async (id: string): Promise<{ message: string } | null> => {
    const res = await fetchJson<{ message: string }>(`${getApiBaseUrl()}/tasks/${id}`, {
      method: 'DELETE',
    });
    if (res) {
      const cached = offlineCache.getCachedTasks().filter((t) => t._id !== id);
      offlineCache.setCachedTasks(cached);
      return res;
    }
    // Offline fallback
    offlineCache.enqueueMutation({ entity: 'task', action: 'delete', payload: { _id: id } });
    const cached = offlineCache.getCachedTasks().filter((t) => t._id !== id);
    offlineCache.setCachedTasks(cached);
    return { message: 'Task deleted locally (queued for sync)' };
  },

  // Subtask client endpoints
  addSubtask: (taskId: string, title: string) =>
    fetchJson<Task>(`${getApiBaseUrl()}/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  toggleSubtask: (taskId: string, subtaskId: string) =>
    fetchJson<Task>(`${getApiBaseUrl()}/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH',
    }),
  deleteSubtask: (taskId: string, subtaskId: string) =>
    fetchJson<Task>(`${getApiBaseUrl()}/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
    }),

  getGoals: async (): Promise<Goal[] | null> => {
    const goals = await fetchJson<Goal[]>(`${getApiBaseUrl()}/goals`);
    if (goals) {
      offlineCache.setCachedGoals(goals);
      return goals;
    }
    const cached = offlineCache.getCachedGoals();
    return cached.length > 0 ? cached : null;
  },

  getAIAgentGoals: () => fetchJson<AIAgentGoal[]>(`${getApiBaseUrl()}/goals/agent-goals`),

  toggleMilestone: (goalId: string, milestoneId: string) =>
    fetchJson<Goal>(`${getApiBaseUrl()}/goals/${goalId}/milestones/${milestoneId}/toggle`, {
      method: 'PATCH',
    }),

  getMemories: async (): Promise<Memory[] | null> => {
    const memories = await fetchJson<Memory[]>(`${getApiBaseUrl()}/memory`);
    if (memories) {
      offlineCache.setCachedMemories(memories);
      return memories;
    }
    const cached = offlineCache.getCachedMemories();
    return cached.length > 0 ? cached : null;
  },

  getTieredMemories: () => fetchJson<{ mediumTerm: Memory[]; longTerm: Memory[] }>(`${getApiBaseUrl()}/memory/tiered`),

  createMemory: (memory: Partial<Memory>) =>
    fetchJson<Memory>(`${getApiBaseUrl()}/memory`, {
      method: 'POST',
      body: JSON.stringify(memory),
    }),

  deleteMemory: (id: string) =>
    fetchJson<{ message: string }>(`${getApiBaseUrl()}/memory/${id}`, {
      method: 'DELETE',
    }),

  getChatMessages: (sessionId?: string) =>
    fetchJson<ChatMessage[]>(`${getApiBaseUrl()}/chat${sessionId ? `?sessionId=${sessionId}` : ''}`),
  getChatSessions: () => fetchJson<ChatSession[]>(`${getApiBaseUrl()}/chat/sessions`),
  getSessionMessages: (sessionId: string) => fetchJson<ChatMessage[]>(`${getApiBaseUrl()}/chat/sessions/${sessionId}/messages`),
  getDailySummary: () => fetchJson<{ summary: string }>(`${getApiBaseUrl()}/chat/daily-summary`),

  sendChatMessage: async (message: string, sessionId?: string, localTime?: string) => {
    const serverRes = await fetchJson<{ userMsg: ChatMessage; aiMsg: ChatMessage }>(`${getApiBaseUrl()}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, sessionId, localTime }),
    });
    if (serverRes) return serverRes;

    const now = new Date().toISOString();
    const sessId = sessionId || `session_${now.substring(0, 10)}`;
    const userMsg: ChatMessage = {
      _id: `msg_u_${Date.now()}`,
      sessionId: sessId,
      role: 'user',
      content: message,
      createdAt: now,
    };

    // Direct Mobile Device Fallback: Execute via OpenRouter API if backend server is offline/unreachable
    try {
      const config = offlineCache.getCachedAIConfig();
      const openRouterKey = (config?.openrouter?.apiKey || '').trim();
      const selectedModel = config?.openrouter?.defaultModel || 'openai/gpt-4o-mini';

      if (openRouterKey) {
        const sysPrompt = config?.systemPrompt || 'You are an intelligent AI task management assistant.';
        const candidateModels = [
          config?.openrouter?.defaultModel,
          ...(config?.openrouter?.fallbackModels || []),
        ]
          .filter(Boolean)
          .map((m) => m!.replace(/^~/, '').trim())
          .filter((m, i, arr) => m.length > 0 && arr.indexOf(m) === i);

        if (candidateModels.length === 0) {
          candidateModels.push(selectedModel);
        }

        let lastErrStatus = 402;
        let lastErrText = '';

        for (const candidateModel of candidateModels) {
          const maxTokenTiers = [1000, 300, 150];
          for (const tokens of maxTokenTiers) {
            try {
              const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openRouterKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://aitaskmanager.app',
                  'X-Title': 'Personal AI Task Manager',
                },
                body: JSON.stringify({
                  model: candidateModel,
                  messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: message },
                  ],
                  temperature: 0.7,
                  max_tokens: tokens,
                }),
              });

              if (apiRes.ok) {
                const data = await apiRes.json();
                const replyText = data.choices?.[0]?.message?.content || 'Task processed successfully.';

                const aiMsg: ChatMessage = {
                  _id: `msg_a_${Date.now() + 1}`,
                  sessionId: sessId,
                  role: 'assistant',
                  content: replyText,
                  createdAt: new Date().toISOString(),
                  metadata: { model: candidateModel },
                };

                return { userMsg, aiMsg };
              } else {
                lastErrStatus = apiRes.status;
                lastErrText = await apiRes.text();
                console.warn(`[Client] Model "${candidateModel}" (tokens=${tokens}) returned ${apiRes.status}:`, lastErrText);

                // If NOT a 402 / max_tokens credit error, stop token tier retries for this model and move to NEXT candidate model
                if (!lastErrText.includes('402') && !lastErrText.includes('max_tokens') && !lastErrText.includes('credits')) {
                  break;
                }
              }
            } catch (err) {
              console.warn(`[Client] Model "${candidateModel}" fetch error:`, err);
              break;
            }
          }
        }

        const aiMsg: ChatMessage = {
          _id: `msg_a_${Date.now() + 1}`,
          sessionId: sessId,
          role: 'assistant',
          content: `OpenRouter API returned status ${lastErrStatus}: ${lastErrText.substring(0, 150)}. Please verify your OpenRouter API Key and balance in Settings.`,
          createdAt: new Date().toISOString(),
        };
        return { userMsg, aiMsg };
      } else {
        const aiMsg: ChatMessage = {
          _id: `msg_a_${Date.now() + 1}`,
          sessionId: sessId,
          role: 'assistant',
          content: 'Please configure your OpenRouter API Key in Settings to enable live AI Assistant chat responses.',
          createdAt: new Date().toISOString(),
        };
        return { userMsg, aiMsg };
      }
    } catch (err) {
      console.warn('[Client] Direct chat fallback failed:', err);
      const aiMsg: ChatMessage = {
        _id: `msg_a_${Date.now() + 1}`,
        sessionId: sessId,
        role: 'assistant',
        content: `Error connecting to AI Provider: ${(err as Error).message}`,
        createdAt: new Date().toISOString(),
      };
      return { userMsg, aiMsg };
    }
  },

replanDay: () =>
  fetchJson<Task[]>(`${getApiBaseUrl()}/planning/replan`, {
    method: 'POST',
  }),

  getAIConfig: async (): Promise<AIProviderConfig | null> => {
    const cached = offlineCache.getCachedAIConfig();
    const serverConfig = await fetchJson<AIProviderConfig>(`${getApiBaseUrl()}/settings/config`);
    if (serverConfig) {
      // Merge cached local keys if server didn't have them
      const merged: AIProviderConfig = {
        ...serverConfig,
        openrouter: {
          ...serverConfig.openrouter,
          apiKey: (cached?.openrouter?.apiKey && cached.openrouter.apiKey.trim()) ? cached.openrouter.apiKey : (serverConfig.openrouter?.apiKey || ''),
          defaultModel: (cached?.openrouter?.defaultModel && cached.openrouter.defaultModel.trim()) ? cached.openrouter.defaultModel : (serverConfig.openrouter?.defaultModel || ''),
          fallbackModels: (cached?.openrouter?.fallbackModels?.length ? cached.openrouter.fallbackModels : serverConfig.openrouter?.fallbackModels) || [],
        },
        gemini: {
          ...serverConfig.gemini,
          apiKey: (cached?.gemini?.apiKey && cached.gemini.apiKey.trim()) ? cached.gemini.apiKey : (serverConfig.gemini?.apiKey || ''),
          defaultModel: (cached?.gemini?.defaultModel && cached.gemini.defaultModel.trim()) ? cached.gemini.defaultModel : (serverConfig.gemini?.defaultModel || ''),
          fallbackModels: (cached?.gemini?.fallbackModels?.length ? cached.gemini.fallbackModels : serverConfig.gemini?.fallbackModels) || [],
        },
        grok: {
          ...serverConfig.grok,
          apiKey: (cached?.grok?.apiKey && cached.grok.apiKey.trim()) ? cached.grok.apiKey : (serverConfig.grok?.apiKey || ''),
          defaultModel: (cached?.grok?.defaultModel && cached.grok.defaultModel.trim()) ? cached.grok.defaultModel : (serverConfig.grok?.defaultModel || ''),
          fallbackModels: (cached?.grok?.fallbackModels?.length ? cached.grok.fallbackModels : serverConfig.grok?.fallbackModels) || [],
        },
        dailySchedule: cached?.dailySchedule || serverConfig.dailySchedule || '',
        mongoUri: cached?.mongoUri || serverConfig.mongoUri || '',
      };
      offlineCache.setCachedAIConfig(merged);
      return merged;
    }
    return cached;
  },

    updateAIConfig: async (config: AIProviderConfig): Promise<AIProviderConfig | null> => {
      // Save to local device storage immediately
      offlineCache.setCachedAIConfig(config);
      const updated = await fetchJson<AIProviderConfig>(`${getApiBaseUrl()}/settings/config`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (updated) {
        const merged: AIProviderConfig = {
          ...updated,
          openrouter: {
            ...updated.openrouter,
            apiKey: config.openrouter.apiKey || updated.openrouter?.apiKey || '',
            defaultModel: config.openrouter.defaultModel || updated.openrouter?.defaultModel || '',
            fallbackModels: config.openrouter.fallbackModels || updated.openrouter?.fallbackModels || [],
          },
          gemini: {
            ...updated.gemini,
            apiKey: config.gemini.apiKey || updated.gemini?.apiKey || '',
            defaultModel: config.gemini.defaultModel || updated.gemini?.defaultModel || '',
            fallbackModels: config.gemini.fallbackModels || updated.gemini?.fallbackModels || [],
          },
          grok: {
            ...updated.grok,
            apiKey: config.grok.apiKey || updated.grok?.apiKey || '',
            defaultModel: config.grok.defaultModel || updated.grok?.defaultModel || '',
            fallbackModels: config.grok.fallbackModels || updated.grok?.fallbackModels || [],
          },
          dailySchedule: config.dailySchedule || updated.dailySchedule || '',
          mongoUri: config.mongoUri || updated.mongoUri || '',
        };
        offlineCache.setCachedAIConfig(merged);
        return merged;
      }
      return config;
    },

      getAvailableModels: async (provider: string, apiKey?: string) => {
        const serverResult = await fetchJson<{ id: string; name: string; contextLength?: number }[]>(
          `${getApiBaseUrl()}/settings/models?provider=${encodeURIComponent(provider)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`
        );
        if (serverResult && Array.isArray(serverResult) && serverResult.length > 0) {
          return serverResult;
        }

        // Direct Client Fallback (Fetches directly when mobile app is offline or backend server unreachable)
        try {
          if (provider === 'openrouter') {
            const headers: Record<string, string> = {
              'HTTP-Referer': 'https://aitaskmanager.app',
              'X-Title': 'Personal AI Task Manager',
            };
            const key = apiKey || offlineCache.getCachedAIConfig()?.openrouter?.apiKey;
            if (key && key.trim()) {
              headers['Authorization'] = `Bearer ${key.trim()}`;
            }
            const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
            if (res.ok) {
              const json = await res.json();
              return (json.data || []).map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
                contextLength: m.context_length,
              }));
            }
          } else if (provider === 'gemini') {
            const key = (apiKey || offlineCache.getCachedAIConfig()?.gemini?.apiKey || '').trim();
            if (key) {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
              if (res.ok) {
                const json = await res.json();
                return (json.models || [])
                  .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                  .map((m: any) => ({
                    id: m.name.replace('models/', ''),
                    name: m.displayName || m.name,
                  }));
              }
            }
            const res = await fetch('https://openrouter.ai/api/v1/models');
            if (res.ok) {
              const json = await res.json();
              return (json.data || [])
                .filter((m: any) => m.id.includes('gemini') || m.id.startsWith('google/'))
                .map((m: any) => ({
                  id: m.id,
                  name: m.name || m.id,
                  contextLength: m.context_length,
                }));
            }
          } else if (provider === 'grok') {
            const res = await fetch('https://openrouter.ai/api/v1/models');
            if (res.ok) {
              const json = await res.json();
              return (json.data || [])
                .filter((m: any) => m.id.includes('grok') || m.id.startsWith('x-ai/'))
                .map((m: any) => ({
                  id: m.id,
                  name: m.name || m.id,
                  contextLength: m.context_length,
                }));
            }
          }
        } catch (e) {
          console.warn('[Client] Direct model fetch fallback failed:', e);
        }
        return null;
      },

        getAnalyticsSummary: () => fetchJson<ProductivityAnalytics>(`${getApiBaseUrl()}/analytics/summary`),

          getTaskLists: () => fetchJson<TaskList[]>(`${getApiBaseUrl()}/lists`),
            createTaskList: (title: string) =>
              fetchJson<TaskList>(`${getApiBaseUrl()}/lists`, {
                method: 'POST',
                body: JSON.stringify({ title }),
              }),
              updateTaskList: (id: string, updates: Partial<TaskList>) =>
                fetchJson<TaskList>(`${getApiBaseUrl()}/lists/${id}`, {
                  method: 'PUT',
                  body: JSON.stringify(updates),
                }),
                deleteTaskList: (idOrTitle: string) =>
                  fetchJson<{ deletedList: string; deletedTaskCount: number }>(`${getApiBaseUrl()}/lists/${idOrTitle}`, {
                    method: 'DELETE',
                  }),

                  checkHealth: async (): Promise<boolean> => {
                    try {
                      const url = `${getApiBaseUrl()}/health`;
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 4000);
                      const res = await fetch(url, {
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                      });
                      clearTimeout(timeoutId);
                      if (res.ok) {
                        const json = await res.json();
                        return json.status === 'ok' || json.status === 'healthy';
                      }
                      return false;
                    } catch {
                      return false;
                    }
                  },

                    flushSync: () => offlineCache.flush(getApiBaseUrl()),
};

