import { PromptModuleKey } from '../router/routing.types.js';
import { getBasePromptModule } from './base.js';
import { getTaskManagementModule } from './taskManagement.js';
import { getTaskQueryModule } from './taskQuery.js';
import { getTaskMutationModule } from './taskMutation.js';
import { getTaskCreationModule } from './taskCreation.js';
import { getTaskDeletionModule } from './taskDeletion.js';
import { getSubtasksModule } from './subtasks.js';
import { getListsModule } from './lists.js';
import { getSchedulingModule } from './scheduling.js';
import { getPrioritizationModule } from './prioritization.js';
import { getMemoryModule } from './memory.js';
import { getAutonomousAgentModule } from './autonomousAgent.js';
import { getAgentReasoningModule } from './agentReasoning.js';

export interface ComposePromptOptions {
  systemPrompt?: string;
  dailySchedule?: string;
  timeContext: string;
}

export function composeSystemPrompt(
  modules: PromptModuleKey[],
  options: ComposePromptOptions
): string {
  const parts: string[] = [];
  const base = options.systemPrompt || getBasePromptModule(options.timeContext);
  parts.push(base);

  const uniqueModules = Array.from(new Set(modules));

  for (const mod of uniqueModules) {
    switch (mod) {
      case 'taskManagement':
        parts.push(getTaskManagementModule(options.dailySchedule));
        break;
      case 'taskQuery':
        parts.push(getTaskQueryModule());
        break;
      case 'taskMutation':
        parts.push(getTaskMutationModule());
        break;
      case 'taskCreation':
        parts.push(getTaskCreationModule());
        break;
      case 'taskDeletion':
        parts.push(getTaskDeletionModule());
        break;
      case 'subtasks':
        parts.push(getSubtasksModule());
        break;
      case 'lists':
        parts.push(getListsModule());
        break;
      case 'scheduling':
        parts.push(getSchedulingModule());
        break;
      case 'prioritization':
        parts.push(getPrioritizationModule());
        break;
      case 'memory':
        parts.push(getMemoryModule());
        break;
      case 'autonomousAgent':
        parts.push(getAutonomousAgentModule());
        break;
      case 'agentReasoning':
        parts.push(getAgentReasoningModule());
        break;
    }
  }

  return parts.join('\n\n');
}
