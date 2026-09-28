import { LayaRoutingResult } from './routing.types.js';
import { transientScratchpadService } from '../../services/scratchpad.service.js';

export class LayaRuleEngine {
  public evaluateRules(prompt: string, sessionId?: string): LayaRoutingResult | null {
    const p = prompt.trim();
    const cleanPrompt = p.replace(/[.!?]+$/, '').trim();
    const lower = cleanPrompt.toLowerCase();

    // 1. Ultra-fast path for pure 1-word greetings & casual chat (< 1ms, 0 API cost)
    if (/^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you)[\s!?.]*$/i.test(p)) {
      return {
        route: 'SIMPLE_LLM',
        confidence: 0.95,
        reasoningLevel: 'NONE',
        promptModules: ['base'],
        tools: [],
        context: [],
        history: true,
        memory: false,
        requiresClarification: false,
        reason: 'Casual greeting or informational chat',
        parameters: {},
      };
    }

    // 2. High-risk bulk deletion scratchpad staging
    const isBulkDelete =
      /^(?:please\s+)?(?:can\s+you\s+)?(?:delete|remove|clear|erase|purge|drop)\s+(?:all\s+)?(?:my\s+)?tasks$/i.test(cleanPrompt) ||
      /^(?:delete|clear|remove|erase|purge|drop)\s+(?:all|everything|all\s+tasks|all\s+my\s+tasks|all\s+of\s+my\s+tasks)$/i.test(cleanPrompt) ||
      lower === 'delete all tasks' ||
      lower === 'clear all tasks' ||
      lower === 'delete all' ||
      lower === 'delete everything';

    if (isBulkDelete) {
      transientScratchpadService.setPendingAction(sessionId || 'default', {
        operation: 'delete_all_tasks',
        tools: ['delete_all_tasks'],
        promptModules: ['taskDeletion'],
        context: ['TASKS'],
      });

      return {
        route: 'SIMPLE_LLM',
        operation: 'delete_all_tasks',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['taskDeletion'],
        tools: [],
        context: ['TASKS'],
        history: false,
        memory: false,
        requiresClarification: true,
        reason: 'Asking for confirmation via transient scratchpad before bulk task deletion',
        parameters: {},
      };
    }

    // Delegate all semantic routing, tool selection, and context requirements to the Fast Router LLM
    return null;
  }
}

export const layaRuleEngine = new LayaRuleEngine();
