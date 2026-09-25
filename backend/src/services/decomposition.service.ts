import { Task } from '@ai-task-manager/shared-types';

export interface DecomposedSubtask {
  title: string;
  estimatedMinutes: number;
}

export class DecompositionService {
  /**
   * Generates actionable subtasks with duration estimates for a complex task or goal
   */
  public decomposeTask(title: string): DecomposedSubtask[] {
    const lower = title.toLowerCase();

    if (lower.includes('ml') || lower.includes('machine learning')) {
      return [
        { title: 'Prepare & clean dataset pipeline', estimatedMinutes: 30 },
        { title: 'Implement model architecture in PyTorch', estimatedMinutes: 60 },
        { title: 'Train model & log validation loss', estimatedMinutes: 45 },
        { title: 'Evaluate metrics & save final weights', estimatedMinutes: 30 },
      ];
    }

    if (lower.includes('dbms') || lower.includes('database')) {
      return [
        { title: 'Review ER diagram requirements', estimatedMinutes: 20 },
        { title: 'Solve relational algebra query problems', estimatedMinutes: 40 },
        { title: 'Write B-Tree index insertion steps', estimatedMinutes: 30 },
      ];
    }

    if (lower.includes('dsa') || lower.includes('algorithm') || lower.includes('leetcode')) {
      return [
        { title: 'Review core data structure principles', estimatedMinutes: 20 },
        { title: 'Solve Medium difficulty problem', estimatedMinutes: 40 },
        { title: 'Analyze time & space complexity', estimatedMinutes: 15 },
      ];
    }

    // Default decomposition
    return [
      { title: `Initial research & requirements for ${title}`, estimatedMinutes: 25 },
      { title: `Core implementation for ${title}`, estimatedMinutes: 50 },
      { title: `Testing & final review`, estimatedMinutes: 20 },
    ];
  }
}

export const decompositionService = new DecompositionService();
