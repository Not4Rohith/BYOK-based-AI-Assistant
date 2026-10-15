import { MemorySource } from '@ai-task-manager/shared-types';

export interface ExtractedMemory {
  content: string;
  memoryTier?: 'short_term' | 'medium_term' | 'long_term' | string;
  category: string;
  importance: number;
  confidence: number;
  source: MemorySource;
  validUntil?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class MemoryExtractor {
  /**
   * Evaluates user prompt text and extracts atomic memories across 3 tiers (short, medium, long term).
   * Ignores small talk, greetings, raw transcripts, and credentials.
   */
  public extractFromPrompt(prompt: string): ExtractedMemory | null {
    const lower = prompt.toLowerCase().trim();

    // Ignore greetings & small talk
    const smallTalkPatterns = [/^(hi|hello|hey|good morning|good evening|thanks|thank you|bye)/i];
    if (smallTalkPatterns.some((pattern) => pattern.test(lower))) {
      return null;
    }

    // Ignore credentials
    if (lower.includes('api_key') || lower.includes('password') || lower.includes('secret') || lower.includes('token')) {
      return null;
    }

    // Ignore explicit goal/task scheduling prompts (e.g. "I have a test in 5 days", "create a task")
    if (/\b(test|interview|exam|deadline)\s+in\s+\d+/i.test(lower) || lower.startsWith('create task') || lower.startsWith('plan my')) {
      return null;
    }

    // 1. Detect Constraints (Long-Term User Rules & Constraints)
    if (lower.includes("don't") || lower.includes('never') || lower.includes('no study') || lower.includes('cannot') || lower.includes('do not schedule')) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'constraints',
        tags: ['constraint', 'scheduling'],
        importance: 0.9,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    // 2. Detect Personal Preferences & Habits (Long-Term)
    if (lower.includes('prefer') || lower.includes('like to') || lower.includes('favorite') || lower.includes('enjoy')) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'preferences',
        tags: ['preference', 'user_habit'],
        importance: 0.85,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    // 3. Detect Sensitive Personal Relationships
    if (lower.includes('breakup') || lower.includes('relationship') || lower.includes('feeling down') || lower.includes('girlfriend') || lower.includes('partner')) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'relationships',
        tags: ['relationship', 'emotional_support'],
        metadata: { suggestMoviesOnSadness: true },
        importance: 0.95,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    return null;
  }
}

export const memoryExtractor = new MemoryExtractor();
