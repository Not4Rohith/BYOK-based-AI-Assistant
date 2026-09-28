import { embeddingService } from '../embeddings.service.js';

export interface PromptChunk {
  id: string;
  header?: string;
  content: string;
  isCore: boolean;
  tokens: string[];
}

export interface ScheduleChunk {
  id: string;
  content: string;
  startMinutes?: number;
  endMinutes?: number;
  tokens: string[];
}

export class DynamicPromptChunker {
  /**
   * Split arbitrary system prompt text into logical markdown/structural chunks.
   */
  public parseSystemPromptChunks(systemPrompt: string): PromptChunk[] {
    if (!systemPrompt || !systemPrompt.trim()) return [];

    const lines = systemPrompt.split('\n');
    const chunks: PromptChunk[] = [];
    let currentHeader = '';
    let currentLines: string[] = [];

    const finalizeChunk = () => {
      const content = currentLines.join('\n').trim();
      if (content.length > 0) {
        const lower = content.toLowerCase();
        const isCore =
          chunks.length === 0 ||
          lower.includes('identity') ||
          lower.includes('persona') ||
          lower.includes('role') ||
          lower.includes('always');

        const tokens = lower
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length > 2);

        chunks.push({
          id: `chunk_${chunks.length + 1}`,
          header: currentHeader,
          content,
          isCore,
          tokens,
        });
      }
      currentLines = [];
    };

    for (const line of lines) {
      if (/^#{1,4}\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        finalizeChunk();
        currentHeader = line.replace(/^#{1,4}\s+/, '').replace(/^\d+\.\s+/, '').trim();
        currentLines.push(line);
      } else if (line.trim() === '' && currentLines.length >= 3) {
        finalizeChunk();
      } else {
        currentLines.push(line);
      }
    }
    finalizeChunk();

    return chunks;
  }

  /**
   * Split arbitrary daily schedule into time-aware schedule chunks.
   */
  public parseScheduleChunks(dailySchedule: string): ScheduleChunk[] {
    if (!dailySchedule || !dailySchedule.trim()) return [];

    const rawBlocks = dailySchedule.split('\n').filter((b) => b.trim().length > 0);
    const chunks: ScheduleChunk[] = [];

    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i].trim();
      const lower = block.toLowerCase();

      let startMinutes: number | undefined;
      let endMinutes: number | undefined;

      const timeMatch = block.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let h1 = parseInt(timeMatch[1], 10);
        const m1 = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const p1 = timeMatch[3]?.toLowerCase();

        let h2 = parseInt(timeMatch[4], 10);
        const m2 = timeMatch[5] ? parseInt(timeMatch[5], 10) : 0;
        const p2 = timeMatch[6]?.toLowerCase();

        if (p1 === 'pm' && h1 < 12) h1 += 12;
        if (p1 === 'am' && h1 === 12) h1 = 0;

        if (p2 === 'pm' && h2 < 12) h2 += 12;
        if (p2 === 'am' && h2 === 12) h2 = 0;

        startMinutes = h1 * 60 + m1;
        endMinutes = h2 * 60 + m2;
      }

      const tokens = lower
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      chunks.push({
        id: `sched_${i + 1}`,
        content: block,
        startMinutes,
        endMinutes,
        tokens,
      });
    }

    return chunks;
  }

  /**
   * Dynamically select relevant prompt chunks using hybrid TF-IDF token overlap + vector similarity.
   */
  public async selectRelevantPromptChunks(
    systemPrompt: string,
    userQuery?: string,
    maxChunks = 3
  ): Promise<string> {
    const chunks = this.parseSystemPromptChunks(systemPrompt);
    if (chunks.length === 0) return '';
    if (!userQuery || userQuery.trim().length === 0) {
      return chunks.map((c) => c.content).join('\n\n');
    }

    const queryLower = userQuery.toLowerCase();
    const queryTokens = queryLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const queryEmbedding = await embeddingService.generateEmbedding(userQuery);

    const scoredChunks = await Promise.all(
      chunks.map(async (chunk) => {
        if (chunk.isCore) {
          return { chunk, score: 1.5 };
        }

        const matchingTokens = chunk.tokens.filter((t) => queryTokens.includes(t));
        const keywordScore = queryTokens.length > 0 ? matchingTokens.length / queryTokens.length : 0;

        const chunkEmbedding = await embeddingService.generateEmbedding(chunk.content);
        const vectorScore = embeddingService.cosineSimilarity(queryEmbedding, chunkEmbedding);

        const totalScore = keywordScore * 0.4 + vectorScore * 0.6;
        return { chunk, score: totalScore };
      })
    );

    scoredChunks.sort((a, b) => b.score - a.score);
    const selected = scoredChunks.slice(0, maxChunks).map((sc) => sc.chunk.content);

    return selected.join('\n\n');
  }

  /**
   * Dynamically select relevant schedule chunks based on current local time & user query.
   */
  public async selectRelevantScheduleChunks(
    dailySchedule: string,
    timeContext?: string,
    userQuery?: string,
    maxChunks = 2
  ): Promise<string> {
    const chunks = this.parseScheduleChunks(dailySchedule);
    if (chunks.length === 0) return '';

    let currentMinutes: number | undefined;
    if (timeContext) {
      const match = timeContext.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        currentMinutes = h * 60 + m;
      }
    }

    const queryLower = (userQuery || '').toLowerCase();
    const queryTokens = queryLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const queryEmbedding = userQuery ? await embeddingService.generateEmbedding(userQuery) : null;

    const scored = await Promise.all(
      chunks.map(async (chunk) => {
        let score = 0;

        if (currentMinutes !== undefined && chunk.startMinutes !== undefined && chunk.endMinutes !== undefined) {
          if (currentMinutes >= chunk.startMinutes && currentMinutes <= chunk.endMinutes) {
            score += 1.0;
          } else if (currentMinutes < chunk.startMinutes && chunk.startMinutes - currentMinutes <= 180) {
            score += 0.5;
          }
        }

        if (queryTokens.length > 0) {
          const matchingTokens = chunk.tokens.filter((t) => queryTokens.includes(t));
          score += (matchingTokens.length / queryTokens.length) * 0.4;
        }

        if (queryEmbedding && chunk.content) {
          const chunkEmb = await embeddingService.generateEmbedding(chunk.content);
          score += embeddingService.cosineSimilarity(queryEmbedding, chunkEmb) * 0.4;
        }

        return { chunk, score };
      })
    );

    scored.sort((a, b) => b.score - a.score);
    const selected = scored
      .filter((sc) => sc.score > 0.1 || chunks.length <= 2)
      .slice(0, maxChunks)
      .map((sc) => sc.chunk.content);

    return selected.join('\n');
  }
}

export const dynamicPromptChunker = new DynamicPromptChunker();
