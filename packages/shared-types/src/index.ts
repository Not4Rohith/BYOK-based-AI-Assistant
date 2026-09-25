export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type MemoryCategory =
  | 'profile'
  | 'goals'
  | 'preferences'
  | 'routines'
  | 'relationships'
  | 'scheduling'
  | 'learning'
  | 'projects'
  | 'constraints'
  | 'patterns'
  | 'decisions'
  | 'temporary_context';

export type MemorySource = 'explicit_user' | 'conversation' | 'manual' | 'system_import';

export interface RecurrenceRule {
  enabled: boolean;
  rule: string | null; // e.g. RRULE string "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
  timezone: string;
}

export interface GoogleTaskSyncMetadata {
  taskId: string | null;
  taskListId: string | null;
  lastSyncedAt: string | null;
  syncStatus: 'synced' | 'pending' | 'failed' | 'not_connected';
}

export interface GoogleCalendarSyncMetadata {
  eventId: string | null;
  calendarId: string | null;
  lastSyncedAt: string | null;
  syncStatus: 'synced' | 'pending' | 'failed' | 'not_connected';
}

export interface TaskList {
  _id: string;
  userId?: string;
  title: string;
  icon?: string;
  color?: string;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  starred?: boolean;
  listId?: string;
  parentTaskId?: string | null;
  goalId?: string | null;
  estimatedMinutes?: number;
  actualMinutes?: number | null;
  dueAt?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  expiresAt?: string | null;
  tags?: string[];
  source?: 'user' | 'ai' | 'routine';
  recurrence?: RecurrenceRule;
  google?: GoogleTaskSyncMetadata;
  calendar?: GoogleCalendarSyncMetadata;
  subtasks?: { _id?: string; title: string; completed: boolean }[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}


export interface GoalMilestone {
  _id: string;
  title: string;
  status: 'pending' | 'completed';
}

export interface Goal {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'paused';
  priority: Priority;
  targetDate?: string | null;
  progress: number; // 0 - 100
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface Routine {
  _id: string;
  userId: string;
  title: string;
  type: 'fixed' | 'flexible';
  daysOfWeek: number[]; // 1 = Monday, 7 = Sunday
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  timezone: string;
  flexible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  _id: string;
  userId: string;
  memoryTier?: 'short_term' | 'medium_term' | 'long_term' | string;
  category: MemoryCategory | string;
  content: string;
  importance?: number;
  confidence?: number;
  source: MemorySource;
  status: 'active' | 'archived' | 'expired' | 'disabled' | string;
  validFrom?: string | null;
  validUntil?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
}

export interface ChatSession {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  sessionType?: 'daily_chat' | 'topic_discussion' | 'planning' | string;
  title: string;
  summary?: string;
  messageCount?: number;
  lastMessageAt?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleItem {
  _id: string;
  taskId?: string;
  title?: string;
  start: string;
  end: string;
  type: 'task' | 'calendar' | 'routine' | 'break';
  completed?: boolean;
}

export interface Schedule {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  items: ScheduleItem[];
  generatedBy: 'ai' | 'user';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  timezone: string;
}

export interface UserAiInstructions {
  systemPrompt: string;
}

export interface UserPlanningPreferences {
  preferredStartTime: string;
  preferredEndTime: string;
  defaultBufferMinutes: number;
  preferRealisticSchedules: boolean;
  maxContinuousWorkMinutes: number;
}

export interface User {
  _id: string;
  profile: UserProfile;
  aiInstructions: UserAiInstructions;
  planningPreferences: UserPlanningPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSetting {
  enabled: boolean;
  defaultModel: string;
  fallbackModels?: string[];
  apiKey?: string; // Stored locally on device, never sent in plain DB
}

export interface AIProviderConfig {
  openrouter: ProviderSetting;
  gemini: ProviderSetting;
  grok: ProviderSetting;
  systemPrompt?: string;
  dailySchedule?: string;
  mongoUri?: string;
}

export interface ChatMessage {
  _id: string;
  sessionId: string;
  date?: string; // YYYY-MM-DD
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: {
    tool: string;
    args: Record<string, any>;
    status: 'pending' | 'success' | 'failed';
    result?: string;
  }[];
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface OfflineMutation {
  id: string;
  entity: 'task' | 'goal' | 'memory';
  action: 'create' | 'update' | 'delete';
  payload: any;
  clientTimestamp: string;
}

export interface SyncFlushRequest {
  mutations: OfflineMutation[];
}

export interface SyncFlushResult {
  mutationId: string;
  status: 'applied' | 'conflict_resolved' | 'failed';
  resolvedEntity?: any;
  message?: string;
}

export interface SyncFlushResponse {
  results: SyncFlushResult[];
  syncedTasks: Task[];
  syncedGoals: Goal[];
  syncedMemories: Memory[];
}

export interface ProductivityAnalytics {
  productivityScore: number; // 0 - 100
  tasksCompleted: number;
  totalTasks: number;
  completionRate: number; // 0 - 100
  estimationAccuracyRatio: number; // e.g. 0.95
  goalMilestonesCompleted: number;
  totalGoalMilestones: number;
  highPriorityCompletionRate: number;
  aiCoachingTips: string[];
}

export interface AIAgentGoal {
  _id: string;
  userId: string;
  title: string;
  actionType: 'delete_list_and_tasks' | 'check_in_reminder' | 'custom_system_action' | string;
  targetExecutionTime: string; // ISO date string
  payload?: Record<string, any>;
  status: 'pending' | 'executed' | 'cancelled' | string;
  executedAt?: string | null;
  lastLogMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}


