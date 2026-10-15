export interface ActiveScratchpadMemory {
  lastUserPrompt?: string;
  lastAssistantResponse?: string;
  activeIntent?: string;
  compressedSummary?: string;
  lastLayaDecision?: any;
  updatedAt: number;
}

export class CompressedScratchpadService {
  private store: Map<string, ActiveScratchpadMemory> = new Map();

  /**
   * Compress multi-turn context into a 2-line token-efficient memory (~30 tokens)
   */
  public updateScratchpad(
    sessionId: string,
    userPrompt: string,
    assistantResponse: string,
    activeIntent?: string
  ): void {
    const key = sessionId || 'default';
    const summary = this.generateSummary(userPrompt, assistantResponse, activeIntent);
    this.store.set(key, {
      lastUserPrompt: userPrompt,
      lastAssistantResponse: assistantResponse,
      activeIntent,
      compressedSummary: summary,
      updatedAt: Date.now(),
    });
    console.log(`[ScratchpadService] 📝 Updated compressed scratchpad for session "${key}":\n${summary}`);
  }

  /**
   * Retrieve token-efficient compressed scratchpad summary for prompt context
   */
  public getScratchpadSummary(sessionId?: string): string {
    const key = sessionId || 'default';
    let mem = this.store.get(key);
    if (!mem && this.store.size > 0) {
      mem = Array.from(this.store.values())[0];
    }
    return mem?.compressedSummary || '';
  }

  public getPendingAction(sessionId?: string): string | null {
    const key = sessionId || 'default';
    const mem = this.store.get(key);
    return mem?.activeIntent || null;
  }

  public setLastLayaDecision(sessionId: string, decision: any): void {
    const key = sessionId || 'default';
    const existing = this.store.get(key) || { updatedAt: Date.now() };
    this.store.set(key, { ...existing, lastLayaDecision: decision, updatedAt: Date.now() });
  }

  public getLastLayaDecision(sessionId?: string): any | null {
    const key = sessionId || 'default';
    const mem = this.store.get(key);
    return mem?.lastLayaDecision || null;
  }

  private generateSummary(userPrompt: string, assistantResponse: string, activeIntent?: string): string {
    const lines: string[] = [];
    if (activeIntent && activeIntent !== 'none') {
      lines.push(`[Active Intent Memory]: ${activeIntent}`);
    }
    if (assistantResponse) {
      const isQuestion = assistantResponse.includes('?') || assistantResponse.includes('confirm') || assistantResponse.includes('Reply');
      const cleanResp = assistantResponse.split('\n')[0].substring(0, 120);
      lines.push(`[Prior Assistant Action]: ${cleanResp}${isQuestion ? ' (Awaiting user confirmation/response)' : ''}`);
    }
    if (userPrompt) {
      lines.push(`[Prior User Input]: ${userPrompt.substring(0, 80)}`);
    }
    return lines.join('\n');
  }

  public clear(sessionId?: string): void {
    const key = sessionId || 'default';
    this.store.delete(key);
    console.log(`[ScratchpadService] 🗑️ Cleared scratchpad for session "${key}"`);
  }
}

export const compressedScratchpadService = new CompressedScratchpadService();
export const transientScratchpadService = compressedScratchpadService;
