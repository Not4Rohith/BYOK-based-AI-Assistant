import { embeddingService } from '../embeddings.service.js';

export type AtomicChunkCategory =
  | 'bedtime_sleep'
  | 'schedule_routine'
  | 'preference_constraint'
  | 'identity_tone'
  | 'general_instruction';

export interface PromptChunk {
  id: string;
  header?: string;
  content: string;
  category: AtomicChunkCategory;
  isCore: boolean;
  tokens: string[];
}

export interface ScheduleChunk {
  id: string;
  content: string;
  category: AtomicChunkCategory;
  startMinutes?: number;
  endMinutes?: number;
  tokens: string[];
}

export class DynamicPromptChunker {
  /**
   * Split arbitrary system prompt text into its smallest atomic semantic parts (individual rules, constraints, routines, instructions).
   */
  public parseSystemPromptChunks(systemPrompt: string): PromptChunk[] {
    if (!systemPrompt || !systemPrompt.trim()) return [];

    const lines = systemPrompt.split('\n');
    const rawUnits: { header: string; text: string }[] = [];
    let currentHeader = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^#{1,4}\s+/.test(line)) {
        currentHeader = line.replace(/^#{1,4}\s+/, '').trim();
        continue;
      }

      // Check if line is a bullet item or numbered item
      const bulletMatch = line.match(/^[-*•\d+.)]\s*(.*)$/);
      if (bulletMatch && bulletMatch[1].trim().length > 0) {
        rawUnits.push({ header: currentHeader, text: bulletMatch[1].trim() });
      } else {
        // Split complex multi-sentence paragraphs into atomic sentences
        const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter((s) => s.trim().length > 0);
        if (sentences.length > 1) {
          for (const s of sentences) {
            rawUnits.push({ header: currentHeader, text: s.trim() });
          }
        } else {
          rawUnits.push({ header: currentHeader, text: line });
        }
      }
    }

    const chunks: PromptChunk[] = [];

    for (let i = 0; i < rawUnits.length; i++) {
      const { header, text } = rawUnits[i];
      if (text.length === 0) continue;

      const lower = text.toLowerCase();
      let category: AtomicChunkCategory = 'general_instruction';

      if (/(bed\s*time|sleep(ing)?|wake\s*up|waking|night\s*routine|asleep|go\s+to\s+bed)/i.test(lower)) {
        category = 'bedtime_sleep';
      } else if (/(routine|schedule|daily|morning|evening|afternoon|lunch|dinner|breakfast|work\s*hours|commitments?|\d{1,2}(:\d{2})?\s*(am|pm))/i.test(lower)) {
        category = 'schedule_routine';
      } else if (/(prefer|priority|buffer|always|never|avoid|constraint|habit|do\s+not|focus|rule)/i.test(lower)) {
        category = 'preference_constraint';
      } else if (/(identity|persona|role|tone|style|act\s+as|you\s+are|assistant\s+is)/i.test(lower)) {
        category = 'identity_tone';
      }

      const isCore =
        i === 0 ||
        category === 'identity_tone' ||
        lower.includes('always') ||
        lower.includes('never') ||
        lower.includes('rule');

      const tokens = lower
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      chunks.push({
        id: `chunk_${i + 1}`,
        header: header || undefined,
        content: text,
        category,
        isCore,
        tokens,
      });
    }

    return chunks;
  }

  /**
   * Split arbitrary daily schedule text into smallest atomic schedule items.
   */
  public parseScheduleChunks(dailySchedule: string): ScheduleChunk[] {
    if (!dailySchedule || !dailySchedule.trim()) return [];

    // Split on newlines, semicolons, or bullet points
    const rawBlocks = dailySchedule
      .split(/[\n;]+/)
      .map((b) => b.replace(/^[-*•\d+.)]\s*/, '').trim())
      .filter((b) => b.length > 0);

    const chunks: ScheduleChunk[] = [];

    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i];
      const lower = block.toLowerCase();

      let startMinutes: number | undefined;
      let endMinutes: number | undefined;

      // Match time range like 9:00 AM - 5:00 PM or 9am to 5pm
      const timeRangeMatch = block.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeRangeMatch) {
        let h1 = parseInt(timeRangeMatch[1], 10);
        const m1 = timeRangeMatch[2] ? parseInt(timeRangeMatch[2], 10) : 0;
        const p1 = timeRangeMatch[3]?.toLowerCase();

        let h2 = parseInt(timeRangeMatch[4], 10);
        const m2 = timeRangeMatch[5] ? parseInt(timeRangeMatch[5], 10) : 0;
        const p2 = timeRangeMatch[6]?.toLowerCase();

        if (p1 === 'pm' && h1 < 12) h1 += 12;
        if (p1 === 'am' && h1 === 12) h1 = 0;
        if (p2 === 'pm' && h2 < 12) h2 += 12;
        if (p2 === 'am' && h2 === 12) h2 = 0;

        startMinutes = h1 * 60 + m1;
        endMinutes = h2 * 60 + m2;
      } else {
        // Match single time e.g. Bedtime: 11:00 PM or Wake at 7:00 AM
        const singleTimeMatch = block.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
        if (singleTimeMatch) {
          let h = parseInt(singleTimeMatch[1], 10);
          const m = singleTimeMatch[2] ? parseInt(singleTimeMatch[2], 10) : 0;
          const p = singleTimeMatch[3]?.toLowerCase();
          if (p === 'pm' && h < 12) h += 12;
          if (p === 'am' && h === 12) h = 0;
          startMinutes = h * 60 + m;
        }
      }

      let category: AtomicChunkCategory = 'schedule_routine';
      if (/(bed\s*time|sleep|wake|night|asleep)/i.test(lower)) {
        category = 'bedtime_sleep';
      }

      const tokens = lower
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      chunks.push({
        id: `sched_${i + 1}`,
        content: block,
        category,
        startMinutes,
        endMinutes,
        tokens,
      });
    }

    return chunks;
  }

  /**
   * Dynamically select relevant prompt chunks using smallest parts retrieval.
   */
  public async selectRelevantPromptChunks(
    systemPrompt: string,
    userQuery?: string,
    maxChunks = 12
  ): Promise<string> {
    const chunks = this.parseSystemPromptChunks(systemPrompt);
    if (chunks.length === 0) return '';
    if (!userQuery || userQuery.trim().length === 0) {
      return chunks.map((c) => `- ${c.content}`).join('\n');
    }

    const queryLower = userQuery.toLowerCase();
    const isBedtimeInquiry = /(bed\s*time|sleep|wake|night|nap|asleep|hours)/i.test(queryLower);
    const isRoutineInquiry = /(routine|schedule|habit|plan|day|timing)/i.test(queryLower);

    const queryTokens = queryLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await embeddingService.generateEmbedding(userQuery);
    } catch {
      queryEmbedding = null;
    }

    const scoredChunks = await Promise.all(
      chunks.map(async (chunk) => {
        let score = chunk.isCore ? 1.0 : 0.0;

        if (isBedtimeInquiry && chunk.category === 'bedtime_sleep') {
          score += 3.0;
        }
        if (isRoutineInquiry && (chunk.category === 'schedule_routine' || chunk.category === 'bedtime_sleep')) {
          score += 2.0;
        }

        const matchingTokens = chunk.tokens.filter((t) => queryTokens.includes(t));
        if (queryTokens.length > 0) {
          score += (matchingTokens.length / queryTokens.length) * 1.5;
        }

        if (queryEmbedding) {
          try {
            const chunkEmbedding = await embeddingService.generateEmbedding(chunk.content);
            const vectorScore = embeddingService.cosineSimilarity(queryEmbedding, chunkEmbedding);
            score += vectorScore * 1.2;
          } catch {
            // ignore embedding failures gracefully
          }
        }

        return { chunk, score };
      })
    );

    scoredChunks.sort((a, b) => b.score - a.score);

    // If total chunks are small (<= maxChunks), return all to preserve complete instructions
    if (chunks.length <= maxChunks) {
      return chunks.map((c) => `- ${c.content}`).join('\n');
    }

    const selected = scoredChunks.slice(0, maxChunks).map((sc) => `- ${sc.chunk.content}`);
    return selected.join('\n');
  }

  /**
   * Dynamically select relevant schedule chunks based on current local time & user query.
   */
  public async selectRelevantScheduleChunks(
    dailySchedule: string,
    timeContext?: string,
    userQuery?: string,
    maxChunks = 10
  ): Promise<string> {
    const chunks = this.parseScheduleChunks(dailySchedule);
    if (chunks.length === 0) return '';

    // If entire schedule has fewer than maxChunks, include all of it so nothing is missed
    if (chunks.length <= maxChunks) {
      return chunks.map((c) => `- ${c.content}`).join('\n');
    }

    const queryLower = (userQuery || '').toLowerCase();
    const isBedtimeInquiry = /(bed\s*time|sleep|wake|night|asleep|hours)/i.test(queryLower);

    const scored = chunks.map((chunk) => {
      let score = 0;
      if (isBedtimeInquiry && chunk.category === 'bedtime_sleep') {
        score += 3.0;
      }
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxChunks).map((sc) => `- ${sc.chunk.content}`).join('\n');
  }
}

export const dynamicPromptChunker = new DynamicPromptChunker();
