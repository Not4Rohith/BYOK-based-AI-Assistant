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
  | 'autonomousAgent'
  | 'agentReasoning';

export type ContextCategory =
  | 'TASKS'
  | 'TASK_LISTS'
  | 'TODAY_AGENDA'
  | 'CALENDAR'
  | 'USER_PREFERENCES'
  | 'GOALS'
  | 'MEMORY'
  | 'CHAT_HISTORY'
  | 'CURRENT_TIME';

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
