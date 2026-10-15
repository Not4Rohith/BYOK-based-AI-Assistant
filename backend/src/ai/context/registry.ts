import { ContextCategory } from '../router/routing.types.js';

export interface ContextPayload {
  tasks?: any[];
  lists?: any[];
  agenda?: any[];
  calendarEvents?: any[];
  userPreferences?: any;
  personalInstructions?: string;
  goals?: any[];
  memories?: any[];
  relevantMemories?: any[];
  shortTermMemories?: any[];
  mediumTermMemories?: any[];
  longTermMemories?: any[];
  scratchpad?: string;
  chatHistory?: any[];
  currentTime?: string;
}

export const CONTEXT_CATEGORIES: ContextCategory[] = [
  'TASKS',
  'TASK_LISTS',
  'TODAY_AGENDA',
  'CALENDAR',
  'USER_PREFERENCES',
  'PERSONAL_INSTRUCTIONS',
  'GOALS',
  'MEMORY',
  'RELEVANT_MEMORIES',
  'CHAT_HISTORY',
  'CURRENT_TIME',
  'TRANSIENT_SCRATCHPAD',
];
