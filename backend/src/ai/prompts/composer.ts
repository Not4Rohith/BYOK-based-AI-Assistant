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

  // Always include the core foundation (identity, time context, tool execution guidelines)
  parts.push(getBasePromptModule(options.timeContext));

  // Break custom system prompt into smallest atomic parts and inject relevant parts
  if (options.systemPrompt && options.systemPrompt.trim().length > 0) {
    const chunkedInstructions = await dynamicPromptChunker.selectRelevantPromptChunks(
      options.systemPrompt,
      options.userQuery
    );
    if (chunkedInstructions.trim().length > 0) {
      parts.push(`=== USER CUSTOM SYSTEM INSTRUCTIONS & CONSTRAINTS ===\n${chunkedInstructions}`);
    }
  }

  const scheduleChunk = options.dailySchedule || '';

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
        parts.push(getSchedulingModule(scheduleChunk));
        break;
      case 'prioritization':
        parts.push(getPrioritizationModule());
        break;
      case 'memory':
        parts.push(getMemoryModule());
        break;
      case 'goalPlanning':
        parts.push(`=== GOAL PLANNING & ALIGNMENT ===
- Evaluate the user's active goals, target dates, and priority levels from context.
- Align scheduled work with goal milestones, prioritizing imminent target dates.`);
        break;
      case 'taskDecomposition':
        parts.push(`=== TASK DECOMPOSITION ===
- Break higher-level goals and project milestones down into clear, single-action work blocks.
- Create concrete tasks on the user's task board with specific scheduled start and end times.`);
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
        parts.push(getSchedulingModule(options.dailySchedule));
        break;
      case 'prioritization':
        parts.push(getPrioritizationModule());
        break;
      case 'memory':
        parts.push(getMemoryModule());
        break;
      case 'goalPlanning':
        parts.push(`=== GOAL PLANNING & ALIGNMENT ===
- Evaluate the user's active goals, target dates, and priority levels from context.
- Align scheduled work with goal milestones, prioritizing imminent target dates.`);
        break;
      case 'taskDecomposition':
        parts.push(`=== TASK DECOMPOSITION ===
- Break higher-level goals and project milestones down into clear, single-action work blocks.
- Create concrete tasks on the user's task board with specific scheduled start and end times.`);
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
