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
import { dynamicPromptChunker } from './dynamicChunker.js';

export interface ComposePromptOptions {
  systemPrompt?: string;
  dailySchedule?: string;
  timeContext: string;
  userQuery?: string;
}

export async function composeSystemPromptAsync(
  modules: PromptModuleKey[],
  options: ComposePromptOptions
): Promise<string> {
  const parts: string[] = [];

  if (options.systemPrompt && options.systemPrompt.trim().length > 0) {
    const customPromptChunk = await dynamicPromptChunker.selectRelevantPromptChunks(
      options.systemPrompt,
      options.userQuery
    );
    parts.push(customPromptChunk || getBasePromptModule(options.timeContext));
  } else {
    parts.push(getBasePromptModule(options.timeContext));
  }

  let scheduleChunk = options.dailySchedule;
  if (options.dailySchedule && options.dailySchedule.trim().length > 0) {
    scheduleChunk = await dynamicPromptChunker.selectRelevantScheduleChunks(
      options.dailySchedule,
      options.timeContext,
      options.userQuery
    );
  }

  const uniqueModules = Array.from(new Set(modules));

  for (const mod of uniqueModules) {
    switch (mod) {
      case 'taskManagement':
        parts.push(getTaskManagementModule(scheduleChunk));
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
