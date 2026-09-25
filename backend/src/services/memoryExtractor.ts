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

    // Ignore potential credential strings
    if (lower.includes('api_key') || lower.includes('password') || lower.includes('secret') || lower.includes('token')) {
      return null;
    }

    // 1. Detect Medium-Term Time-Bounded Events / Exams (e.g., NPTEL exam on Sunday, midterms this week)
    if (lower.includes('exam') || lower.includes('nptel') || lower.includes('midterm') || lower.includes('due this week')) {
      // Calculate next Sunday or 7 days from now as default validUntil date
      const d = new Date();
      const day = d.getDay();
      const daysUntilSunday = day === 0 ? 7 : 7 - day;
      const validUntilDate = new Date(d.getTime() + daysUntilSunday * 86400000).toISOString().substring(0, 10);

      return {
        content: prompt,
        memoryTier: 'medium_term',
        category: 'exams',
        validUntil: validUntilDate,
        tags: ['exam', 'time_bounded', 'weekly_focus'],
        importance: 0.95,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    // 2. Detect Sensitive Personal Relationships & Emotional Guidance (Long-Term)
    if (lower.includes('breakup') || lower.includes('relationship') || lower.includes('feeling down') || lower.includes('movie') || lower.includes('girlfriend') || lower.includes('partner')) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'relationships',
        tags: ['relationship', 'emotional_support', 'movies'],
        metadata: { suggestMoviesOnSadness: true },
        importance: 0.95,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    // 3. Detect Recurring Commitments & Meetings (Long-Term, Routines)
    if (lower.includes('coders high') || lower.includes('meeting') || (lower.includes('every day') && lower.includes('join'))) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'routines',
        tags: ['meeting', 'daily_routine', 'coders_high'],
        metadata: { reserveDailyTime: true },
        importance: 0.95,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    // 4. Detect Constraints (Long-Term)
    if (lower.includes("don't") || lower.includes('never') || lower.includes('no study') || lower.includes('cannot')) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'constraints',
        tags: ['constraint'],
        importance: 0.9,
        confidence: 0.95,
        source: 'conversation',
      };
    }

    // 5. Detect Preferences (Long-Term)
    if (lower.includes('prefer') || lower.includes('like') || lower.includes('favorite') || lower.includes('enjoy')) {
      return {
        content: prompt,
        memoryTier: 'long_term',
        category: 'preferences',
        tags: ['preference'],
        importance: 0.8,
        confidence: 0.9,
        source: 'conversation',
      };
    }

    return null;
  }
}

export const memoryExtractor = new MemoryExtractor();
