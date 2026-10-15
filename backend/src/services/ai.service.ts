import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatMessage, AIProviderConfig } from '@ai-task-manager/shared-types';
import { memoryExtractor } from './memoryExtractor.js';
import { TaskService } from './task.service.js';
import { MemoryService } from './memory.service.js';
import { GoalService } from './goal.service.js';
import { dbConnection } from '../db/connection.js';
import { chatStorageService } from './chatStorage.service.js';
import { langGraphAgentEngine } from '../ai/langgraph.agent.js';
import { layaRouter } from '../ai/router/laya.router.js';
import { contextSelector } from '../ai/context/selector.js';
import { composeSystemPrompt, composeSystemPromptAsync } from '../ai/prompts/composer.js';
import { LayaTelemetryMetrics } from '../ai/router/routing.types.js';
import { compressedScratchpadService, transientScratchpadService } from './scratchpad.service.js';
import { UserModel } from '../db/models/User.model.js';
import { parseScheduleToRoutines } from './scheduleParser.js';

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
    private goalService?: GoalService
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

    if (dbConnection.getStatus().connected) {
      const routines = parseScheduleToRoutines(newConfig.dailySchedule || '');
      UserModel.findOne({}).then((user) => {
        if (user) {
          if (newConfig.systemPrompt !== undefined) {
            user.aiInstructions.systemPrompt = newConfig.systemPrompt;
          }
          if (routines.length > 0) {
            user.planningPreferences.fixedRoutines = routines as any;
          }
          user.save().catch((err) => console.warn('[AIService] Failed to update user preferences in DB:', err));
        }
      }).catch((err) => console.warn('[AIService] Failed to query user document:', err));
    }

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
    localTime?: string,
    userId?: string
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
      const geminiKey = (this.config.gemini?.apiKey || '').trim();
      const openrouterKey = (this.config.openrouter?.apiKey || '').trim();
      const grokKey = (this.config.grok?.apiKey || '').trim();

      // Determine model and key for Laya Router classification layer:
      const preferredProv = (this.config.activeProvider as 'openrouter' | 'gemini' | 'grok') || (geminiKey ? 'gemini' : openrouterKey ? 'openrouter' : 'grok');
      let layaProvider: 'openrouter' | 'gemini' | 'grok' = preferredProv;

      if (layaProvider === 'gemini' && (!geminiKey || this.config.gemini?.enabled === false)) {
        layaProvider = openrouterKey && this.config.openrouter?.enabled !== false ? 'openrouter' : grokKey && this.config.grok?.enabled !== false ? 'grok' : 'gemini';
      } else if (layaProvider === 'openrouter' && (!openrouterKey || this.config.openrouter?.enabled === false)) {
        layaProvider = geminiKey && this.config.gemini?.enabled !== false ? 'gemini' : grokKey && this.config.grok?.enabled !== false ? 'grok' : 'openrouter';
      } else if (layaProvider === 'grok' && (!grokKey || this.config.grok?.enabled === false)) {
        layaProvider = geminiKey && this.config.gemini?.enabled !== false ? 'gemini' : openrouterKey && this.config.openrouter?.enabled !== false ? 'openrouter' : 'grok';
      }

      const decision = await layaRouter.route(userPrompt, {
        systemPrompt: this.config.systemPrompt,
        dailySchedule: this.config.dailySchedule,
        localTime,
        openrouterApiKey: openrouterKey,
        geminiApiKey: geminiKey,
        grokApiKey: grokKey,
        activeProvider: layaProvider,
        sessionId: activeSession._id,
      });

      transientScratchpadService.setLastLayaDecision(activeSession._id, decision);

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

      // UNIFIED AGENT EXECUTION: Pass prompt through LangGraph Agent Engine with Laya precision tools enabled
      console.log(`[AIService] 🛠️ Processing prompt via LangGraph Agent Engine (Route=${decision.route}, Operation=${decision.operation || 'none'}, PrecisionTools=[${(decision.tools || []).join(', ')}]).`);

      const agentResult = await langGraphAgentEngine.processMessage(
        userPrompt,
        chatHistory,
        this.config,
        this.taskService,
        this.memoryService,
        this.goalService,
        localTime,
        decision.tools, // Precision selected tools from Laya Router for maximum token efficiency
        decision.promptModules,
        decision.context,
        userId
      );
      responseText = agentResult.responseText;
      toolCalls = [...toolCalls, ...agentResult.toolCallsExecuted];

      telemetry.latencyMs = Date.now() - startTime;
      agentMetadata = {
        ...(agentResult.metadata || {}),
        layaDecision: decision,
        telemetry,
      };
    } catch (err) {
      console.warn('[AIService] Laya routing execution failed, executing safe fallback agent:', err);
      try {
        const agentResult = await langGraphAgentEngine.processMessage(
          userPrompt,
          chatHistory,
          this.config,
          this.taskService,
          this.memoryService,
          this.goalService,
          localTime,
          undefined,
          undefined,
          undefined,
          userId
        );
        responseText = agentResult.responseText;
        toolCalls = [...toolCalls, ...agentResult.toolCallsExecuted];
        agentMetadata = agentResult.metadata || {};
      } catch (finalErr) {
        console.error('[AIService] All candidate models and safe fallback agent failed:', finalErr);
        responseText = `[AI Provider Notice]: All configured AI models encountered errors (${(finalErr as Error).message || finalErr}). Please verify your OpenRouter, Grok, or Gemini API keys in Settings.`;
        agentMetadata = { provider: 'local_fallback', error: String(finalErr) };
      }
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
    compressedScratchpadService.updateScratchpad(
      activeSession._id,
      userPrompt,
      responseText,
      agentMetadata?.layaDecision?.operation || agentMetadata?.layaDecision?.route
    );
    return { userMsg, aiMsg };
  }
}
