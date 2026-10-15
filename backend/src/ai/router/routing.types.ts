export type RouteType = 'SIMPLE_LLM' | 'SINGLE_TOOL' | 'AGENT';

export type ReasoningLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type PromptModuleKey =
  | 'base'
  | 'taskManagement'
  | 'taskQuery'
  | 'taskMutation'
  | 'taskCreation'
  | 'taskDeletion'
  | 'subtasks'
  | 'lists'
  | 'scheduling'
  | 'prioritization'
  | 'memory'
  | 'goalPlanning'
  | 'taskDecomposition'
  | 'autonomousAgent'
  | 'agentReasoning';

export type ContextCategory =
  | 'TASKS'
  | 'TASK_LISTS'
  | 'TODAY_AGENDA'
  | 'CALENDAR'
  | 'USER_PREFERENCES'
  | 'PERSONAL_INSTRUCTIONS'
  | 'GOALS'
  | 'MEMORY'
  | 'RELEVANT_MEMORIES'
  | 'CHAT_HISTORY'
  | 'CURRENT_TIME'
  | 'TRANSIENT_SCRATCHPAD';

export interface LayaRoutingResult {
  route: RouteType;
  operation?: string;
  confidence: number;
  reasoningLevel: ReasoningLevel;
  promptModules: PromptModuleKey[];
  tools: string[];
  context: ContextCategory[];
  history: boolean;
  memory: boolean;
  requiresClarification: boolean;
  reason: string;
  parameters: Record<string, any>;
}

export interface LayaRouterOptions {
  systemPrompt?: string;
  dailySchedule?: string;
  localTime?: string;
  openrouterApiKey?: string;
  geminiApiKey?: string;
  grokApiKey?: string;
  activeProvider?: 'openrouter' | 'gemini' | 'grok';
  sessionId?: string;
  layaEndpoint?: string;
  endpoint?: string;
}

export interface LayaTelemetryMetrics {
  route: RouteType;
  operation?: string;
  confidence: number;
  selectedPromptModules: PromptModuleKey[];
  selectedTools: string[];
  selectedContext: ContextCategory[];
  llmTokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  llmCalls: number;
  langGraphIterations: number;
  latencyMs: number;
}
