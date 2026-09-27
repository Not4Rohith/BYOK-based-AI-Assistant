import { PromptModuleKey, ContextCategory } from '../ai/router/routing.types.js';

export interface PendingActionState {
  operation: string;
  tools: string[];
  parameters?: Record<string, any>;
  promptModules?: PromptModuleKey[];
  context?: ContextCategory[];
  reason?: string;
}

export interface TransientScratchpadState {
  pendingAction?: PendingActionState;
  scratchpadData?: Record<string, any>;
  createdAt: number;
}

export class TransientScratchpadService {
  private store: Map<string, TransientScratchpadState> = new Map();

  /**
   * Store a transient pending action for a session.
   */
  public setPendingAction(sessionId: string, action: PendingActionState): void {
    const key = sessionId || 'default';
    this.store.set(key, {
      pendingAction: action,
      createdAt: Date.now(),
    });
    console.log(`[ScratchpadService] 📝 Set pending action for session "${key}":`, action.operation);
  }

  /**
   * Peek at the pending action without flushing.
   */
  public getPendingAction(sessionId?: string): PendingActionState | null {
    const key = sessionId || 'default';
    let state = this.store.get(key);
    if (!state && this.store.size > 0) {
      state = Array.from(this.store.values())[0];
    }
    if (!state || !state.pendingAction) return null;
    return state.pendingAction;
  }

  /**
   * One-time read: Retrieves and atomicaly flushes the pending action.
   */
  public consumePendingAction(sessionId?: string): PendingActionState | null {
    const key = sessionId || 'default';
    let stateKey = key;
    let state = this.store.get(key);
    if (!state && this.store.size > 0) {
      const firstEntry = Array.from(this.store.entries())[0];
      if (firstEntry) {
        stateKey = firstEntry[0];
        state = firstEntry[1];
      }
    }
    if (!state || !state.pendingAction) return null;

    const action = state.pendingAction;
    this.store.delete(stateKey);
    console.log(`[ScratchpadService] 🧹 Consumed & flushed pending action for session "${stateKey}":`, action.operation);
    return action;
  }

  /**
   * Clear all scratchpad data for a session.
   */
  public clear(sessionId: string): void {
    const key = sessionId || 'default';
    this.store.delete(key);
    console.log(`[ScratchpadService] 🗑️ Cleared scratchpad for session "${key}"`);
  }
}

export const transientScratchpadService = new TransientScratchpadService();
