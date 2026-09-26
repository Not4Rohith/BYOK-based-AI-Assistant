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

    let toolCalls: ChatMessage['toolCalls'] = [];

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

    // 4. Process user request via LangGraph Agent State Machine (Agent -> Tools -> Agent)
    try {
      console.log('[AIService] Processing prompt via LangGraphAgentEngine...');
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
    } catch (err) {
      console.warn('[AIService] LangGraph agent execution failed:', err);
      responseText = `I encountered an issue processing your request: ${(err as Error).message}`;
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
