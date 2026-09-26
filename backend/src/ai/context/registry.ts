import { ContextCategory } from '../router/routing.types.js';

export interface ContextPayload {
  tasks?: any[];
  lists?: any[];
  agenda?: any[];
  userPreferences?: string;
  goals?: any[];
  memories?: any[];
  chatHistory?: any[];
  currentTime?: string;
}

export const CONTEXT_CATEGORIES: ContextCategory[] = [
  'TASKS',
  'TASK_LISTS',
  'TODAY_AGENDA',
  'CALENDAR',
  'USER_PREFERENCES',
  'GOALS',
  'MEMORY',
  'CHAT_HISTORY',
  'CURRENT_TIME',
];
