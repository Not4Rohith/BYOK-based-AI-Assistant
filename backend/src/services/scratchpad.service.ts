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
  public getPendingAction(sessionId: string): PendingActionState | null {
    const key = sessionId || 'default';
    const state = this.store.get(key);
    if (!state || !state.pendingAction) return null;
    return state.pendingAction;
  }

  /**
   * One-time read: Retrieves and atomicaly flushes the pending action.
   */
  public consumePendingAction(sessionId: string): PendingActionState | null {
    const key = sessionId || 'default';
    const state = this.store.get(key);
    if (!state || !state.pendingAction) return null;

    const action = state.pendingAction;
    this.store.delete(key);
    console.log(`[ScratchpadService] 🧹 Consumed & flushed pending action for session "${key}":`, action.operation);
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
