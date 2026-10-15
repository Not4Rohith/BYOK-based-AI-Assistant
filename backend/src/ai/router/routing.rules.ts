import { LayaRoutingResult } from './routing.types.js';
import { transientScratchpadService } from '../../services/scratchpad.service.js';

export class LayaRuleEngine {
  public evaluateRules(prompt: string, sessionId?: string): LayaRoutingResult | null {
    const p = prompt.trim();
    const cleanPrompt = p.replace(/[.!?]+$/, '').trim();
    const lower = cleanPrompt.toLowerCase();

    // Fast 1ms path for greetings & casual smalltalk
    if (/^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you)(\s+(there|everyone|all|friend))?[\s!?.]*$/i.test(p)) {
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

    // Direct inquiries about user routine, bedtime, wake-up, habits, or schedule preferences
    if (
      /^(what('?s| is) my (usual |typical )?(bed\s*time|sleep(ing)?\s*time|wake\s*up\s*time|daily routine|routine|schedule)|when do i (usually |typically )?(sleep|go to bed|wake up)|tell me (about )?my (routine|schedule|bedtime))/i.test(cleanPrompt)
    ) {
      return {
        route: 'SIMPLE_LLM',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['base', 'memory'],
        tools: [],
        context: ['CURRENT_TIME', 'USER_PREFERENCES', 'PERSONAL_INSTRUCTIONS', 'RELEVANT_MEMORIES'],
        history: true,
        memory: true,
        requiresClarification: false,
        reason: 'Direct inquiry about user routine, bedtime, or personal preferences',
        parameters: {},
      };
    }

    // Delegate all semantic intent analysis and tool selection to Laya Semantic Router LLM
    return null;
  }
}

export const layaRuleEngine = new LayaRuleEngine();
