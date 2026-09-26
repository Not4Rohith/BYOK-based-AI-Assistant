import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatMessage, AIProviderConfig } from '@ai-task-manager/shared-types';
import { memoryExtractor } from './memoryExtractor.js';
import { TaskService } from './task.service.js';
import { MemoryService } from './memory.service.js';
import { PlanningService } from './planning.service.js';
import { dbConnection } from '../db/connection.js';
import { chatStorageService } from './chatStorage.service.js';
import { langGraphAgentEngine } from '../ai/langgraph.agent.js';
import { layaRouter } from '../ai/router/laya.router.js';
import { contextSelector } from '../ai/context/selector.js';
import { composeSystemPrompt } from '../ai/prompts/composer.js';
import { LayaTelemetryMetrics } from '../ai/router/routing.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.resolve(__dirname, '../../data/ai-config.json');

export class AIService {
  private config: AIProviderConfig = {
    openrouter: {
      enabled: true,
      defaultModel: '',
      fallbackModels: [],
      apiKey: '',
    },
    gemini: {
      enabled: true,
      defaultModel: '',
      fallbackModels: [],
      apiKey: '',
    },
    grok: {
      enabled: false,
      defaultModel: '',
      fallbackModels: [],
      apiKey: '',
    },
    systemPrompt: "You are Rohith's Personal AI Task Assistant. Assist in managing tasks, creating categories, and maintaining an optimal schedule.",
    dailySchedule: '',
    mongoUri: '',
  };

  private messages: ChatMessage[] = [];

  constructor(
    private taskService?: TaskService,
    private memoryService?: MemoryService,
    private planningService?: PlanningService
  ) {
    this.loadConfig();
  }

  private loadConfig(): void {
    const envMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    const envOpenRouterKey = process.env.OPENROUTER_API_KEY || '';

    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const fileData = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(fileData);
        this.config = { ...this.config, ...parsed };
      } else {
        // Auto-generate empty template ai-config.json if missing on disk
        if (envMongoUri) this.config.mongoUri = envMongoUri;
        if (envOpenRouterKey) this.config.openrouter.apiKey = envOpenRouterKey;
        this.saveConfig();
        console.log('[AIService] Auto-generated backend/data/ai-config.json file.');
      }
    } catch (err) {
      console.warn('[AIService] Failed to load persisted AI config:', err);
    }

    // Override from environment variables if set in cloud environment
    if (envMongoUri) {
      this.config.mongoUri = envMongoUri;
    }
    if (envOpenRouterKey) {
      this.config.openrouter.apiKey = envOpenRouterKey;
    }
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(CONFIG_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AIService] Failed to save AI config to file:', err);
    }
  }

  public getConfig(): AIProviderConfig {
    return this.config;
  }

  public updateConfig(newConfig: AIProviderConfig): AIProviderConfig {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    if (newConfig.mongoUri) {
      dbConnection.connect(newConfig.mongoUri).then((connected) => {
        if (connected) {
          console.log('[AIService] Reconnected to MongoDB Atlas using URI from app settings.');
        }
      }).catch((err) => {
        console.warn('[AIService] Dynamic MongoDB connection failed:', err);
      });
    }
    return this.config;
  }

  public async getMessages(sessionId?: string): Promise<ChatMessage[]> {
    if (sessionId) {
      return await chatStorageService.getMessagesBySession(sessionId);
    }
    const activeSess = await chatStorageService.getOrCreateDailySession();
    return await chatStorageService.getMessagesBySession(activeSess._id);
  }

  public async processMessage(
    userPrompt: string,
    targetSessionId?: string,
    localTime?: string
  ): Promise<{ userMsg: ChatMessage; aiMsg: ChatMessage }> {
    const activeSession = targetSessionId
      ? { _id: targetSessionId, date: targetSessionId.replace('session_', '') }
      : await chatStorageService.getOrCreateDailySession();

    // 1. Save user message to MongoDB Atlas
    const userMsg = await chatStorageService.saveMessage({
      sessionId: activeSession._id,
      date: activeSession.date,
      role: 'user',
      content: userPrompt,
    });
    this.messages.push(userMsg);

    let toolCalls: NonNullable<ChatMessage['toolCalls']> = [];

    // 2. Automatically extract atomic memories from conversation
    const extractedMemory = memoryExtractor.extractFromPrompt(userPrompt);
    if (extractedMemory && this.memoryService) {
      const createdMem = await this.memoryService.createMemory({
        content: extractedMemory.content,
        memoryTier: extractedMemory.memoryTier,
        category: extractedMemory.category,
        validUntil: extractedMemory.validUntil,
        tags: extractedMemory.tags,
        metadata: extractedMemory.metadata,
        importance: extractedMemory.importance,
        confidence: extractedMemory.confidence,
        source: extractedMemory.source,
      });
      toolCalls.push({
        tool: 'auto_memory_extraction',
        args: { tier: createdMem.memoryTier, category: createdMem.category, content: createdMem.content },
        status: 'success',
      });
    }

    // 3. Load chat history from active session
    const sessionMessages = await chatStorageService.getMessagesBySession(activeSession._id);
    const chatHistory = sessionMessages.filter((m) => m._id !== userMsg._id);

    let responseText = '';
    let agentMetadata: Record<string, any> = {};
    const startTime = Date.now();

    // 4. Laya Decision Router Layer
    try {
      console.log('[AIService] 🧭 Routing prompt via Laya Router...');
      const decision = await layaRouter.route(userPrompt, {
        systemPrompt: this.config.systemPrompt,
        dailySchedule: this.config.dailySchedule,
        localTime,
        openrouterApiKey: this.config.openrouter?.apiKey,
        defaultModel: this.config.openrouter?.defaultModel,
        sessionId: activeSession._id,
      });

      // Safety guard: Elevate SIMPLE_LLM to AGENT if action tools are present or prompt implies task creation/action
      if (decision.route === 'SIMPLE_LLM') {
        const actionTools = ['create_task', 'batch_create_tasks', 'update_task', 'complete_task', 'delete_task', 'replan_day', 'create_list', 'bulk_update_tasks'];
        const hasActionTool = decision.tools && decision.tools.some((t) => actionTools.includes(t));
        const startsWithAction = /^(?:create|add|schedule|delete|remove|update|complete|replan)\b/i.test(userPrompt.trim());

        if (hasActionTool || startsWithAction) {
          console.log(`[AIService] 🔄 SIMPLE_LLM route was assigned, but action tools/prompt require tool execution. Elevating to AGENT route...`);
          decision.route = 'AGENT';
          if (!decision.tools || decision.tools.length === 0) {
            decision.tools = ['create_task', 'batch_create_tasks', 'get_tasks', 'get_today_agenda', 'replan_day'];
          }
          if (!decision.promptModules || decision.promptModules.length === 0) {
            decision.promptModules = ['base', 'taskCreation', 'scheduling', 'agentReasoning'];
          }
        }
      }

      const telemetry: LayaTelemetryMetrics = {
        route: decision.route,
        operation: decision.operation,
        confidence: decision.confidence,
        selectedPromptModules: decision.promptModules,
        selectedTools: decision.tools,
        selectedContext: decision.context,
        llmTokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        llmCalls: 0,
        langGraphIterations: 0,
        latencyMs: 0,
      };

      // ROUTE 1 — SINGLE_TOOL & AGENT (AI execution with selected tools via LangGraph engine)
      if (decision.route === 'SINGLE_TOOL' || decision.route === 'AGENT') {
        console.log(`[AIService] 🛠️ Route ${decision.route} selected (Operation=${decision.operation || 'none'}, Tools=[${decision.tools.join(', ')}]). Executing AI tool runner...`);
        const agentResult = await langGraphAgentEngine.processMessage(
          userPrompt,
          chatHistory,
          this.config,
          this.taskService,
          localTime,
          decision.tools,
          decision.promptModules,
          decision.context
        );
        responseText = agentResult.responseText;
        toolCalls = [...toolCalls, ...agentResult.toolCallsExecuted];
        telemetry.latencyMs = Date.now() - startTime;
        agentMetadata = {
          ...(agentResult.metadata || {}),
          telemetry,
        };
      }

      // ROUTE 2 — SIMPLE_LLM (Conversational single LLM call with 0 tools)
      else if (decision.route === 'SIMPLE_LLM') {
        console.log(`[AIService] 🧠 Route SIMPLE_LLM selected (Modules=[${decision.promptModules.join(', ')}])...`);
        telemetry.llmCalls = 1;

        const openrouterKey = (this.config.openrouter?.apiKey || '').trim();
        const timeContext = localTime || new Date().toLocaleString();

        const systemPromptText = composeSystemPrompt(decision.promptModules, {
          systemPrompt: this.config.systemPrompt,
          dailySchedule: this.config.dailySchedule,
          timeContext,
        });

        const loadedContext = await contextSelector.loadContext(decision.context, {
          taskService: this.taskService,
          memoryService: this.memoryService,
          dailySchedule: this.config.dailySchedule,
          chatHistory: decision.history ? chatHistory : [],
          localTime,
        });

        let contextSummary = '';
        if (loadedContext.tasks && loadedContext.tasks.length > 0) {
          contextSummary += `\nTasks Context: ${JSON.stringify(loadedContext.tasks.slice(0, 10).map((t) => ({ id: t._id, title: t.title, status: t.status, priority: t.priority })))}`;
        }
        if (loadedContext.agenda && loadedContext.agenda.length > 0) {
          contextSummary += `\nToday Agenda Context: ${JSON.stringify(loadedContext.agenda.map((t) => t.title))}`;
        }
        if (loadedContext.memories && loadedContext.memories.length > 0) {
          contextSummary += `\nUser Memory Context: ${JSON.stringify(loadedContext.memories.slice(0, 5).map((m) => m.content))}`;
        }

        const candidateModels = [this.config.openrouter?.defaultModel, ...(this.config.openrouter?.fallbackModels || [])].filter(Boolean);
        const modelToUse = candidateModels[0] || 'google/gemini-2.5-flash';

        if (openrouterKey) {
          const payloadMessages = [
            { role: 'system', content: `${systemPromptText}${contextSummary}` },
            ...(decision.history ? chatHistory.slice(-2).map((m) => ({ role: m.role, content: m.content })) : []),
            { role: 'user', content: userPrompt },
          ];

          const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://aitaskmanager.app',
              'X-Title': 'Personal AI Task Manager',
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: payloadMessages,
              temperature: 0.7,
              max_tokens: 4096,
            }),
          });

          if (openrouterRes.ok) {
            const data = await openrouterRes.json();
            responseText = data.choices?.[0]?.message?.content || 'Completed your request.';
            const usage = data.usage || {};
            telemetry.llmTokens = {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            };
            telemetry.latencyMs = Date.now() - startTime;
            agentMetadata = {
              model: modelToUse,
              provider: 'openrouter',
              tokenUsage: telemetry.llmTokens,
              telemetry,
            };
          } else {
            const agentResult = await langGraphAgentEngine.processMessage(
              userPrompt,
              chatHistory,
              this.config,
              this.taskService,
              localTime,
              []
            );
            responseText = agentResult.responseText;
            toolCalls = [...toolCalls, ...agentResult.toolCallsExecuted];
            agentMetadata = agentResult.metadata || {};
          }
        } else {
          const agentResult = await langGraphAgentEngine.processMessage(
            userPrompt,
            chatHistory,
            this.config,
            this.taskService,
            localTime,
            []
          );
          responseText = agentResult.responseText;
          toolCalls = [...toolCalls, ...agentResult.toolCallsExecuted];
          agentMetadata = agentResult.metadata || {};
        }
      }
    } catch (err) {
      console.warn('[AIService] Laya routing execution failed, executing safe fallback agent:', err);
      const agentResult = await langGraphAgentEngine.processMessage(
        userPrompt,
        chatHistory,
        this.config,
        this.taskService,
        localTime
      );
      responseText = agentResult.responseText;
      toolCalls = [...toolCalls, ...agentResult.toolCallsExecuted];
      agentMetadata = agentResult.metadata || {};
    }

    if (!responseText || responseText.trim() === '') {
      if (toolCalls && toolCalls.length > 0) {
        const executedNames = Array.from(new Set(toolCalls.map((t) => t.tool))).join(', ');
        responseText = `Executed tools (${executedNames}) successfully.`;
      } else {
        responseText = `I'm ready to assist you. What would you like to manage?`;
      }
    }

    // 5. Save assistant message and tool execution logs to MongoDB Atlas
    const aiMsg = await chatStorageService.saveMessage({
      sessionId: activeSession._id,
      date: activeSession.date,
      role: 'assistant',
      content: responseText,
      toolCalls,
      metadata: agentMetadata,
    });

    this.messages.push(aiMsg);
    return { userMsg, aiMsg };
  }
}
