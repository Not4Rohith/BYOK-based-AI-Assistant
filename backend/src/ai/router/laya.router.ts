import { LayaRoutingResult, LayaRouterOptions } from './routing.types.js';
import { layaRuleEngine } from './routing.rules.js';
import { transientScratchpadService } from '../../services/scratchpad.service.js';

export class LayaRouter {
  public async route(
    userPrompt: string,
    options: LayaRouterOptions = {}
  ): Promise<LayaRoutingResult> {
    const trimmed = (userPrompt || '').trim();
    const sessionId = options.sessionId || 'default';

    // 0. Transient Scratchpad Pending Action Check
    const pendingAction = transientScratchpadService.getPendingAction(sessionId);
    if (pendingAction) {
      const cleanLower = trimmed.replace(/[.!?]+$/, '').trim().toLowerCase();
      const isAffirmative = /^(yes|yeah|yep|sure|confirm|do\s+it|go\s+ahead|ok|okay|proceed|y|correct|please\s+delete|do\s+delete)[\s!?.]*$/i.test(cleanLower);
      const isNegative = /^(no|nope|cancel|stop|don'?t|nevermind|n|abort)[\s!?.]*$/i.test(cleanLower);

      if (isAffirmative) {
        const action = transientScratchpadService.consumePendingAction(sessionId);
        if (action) {
          console.log(`[LayaRouter] ⚡ Transient Scratchpad Confirmed: Operation=${action.operation}`);
          return {
            route: 'SINGLE_TOOL',
            operation: action.operation,
            confidence: 1.0,
            reasoningLevel: 'NONE',
            promptModules: action.promptModules || ['taskDeletion'],
            tools: action.tools,
            context: action.context || ['TASKS'],
            history: false,
            memory: false,
            requiresClarification: false,
            reason: `Confirmed pending scratchpad action: ${action.operation}`,
            parameters: action.parameters || {},
          };
        }
      } else if (isNegative) {
        transientScratchpadService.clear(sessionId);
        console.log(`[LayaRouter] 🚫 Transient Scratchpad Cancelled by user`);
        return {
          route: 'SIMPLE_LLM',
          confidence: 1.0,
          reasoningLevel: 'NONE',
          promptModules: ['base'],
          tools: [],
          context: [],
          history: false,
          memory: false,
          requiresClarification: false,
          reason: 'User cancelled pending scratchpad operation',
          parameters: {},
        };
      }
    }

    // 1. Fast deterministic rule evaluation (< 1ms, 0 API cost)
    const ruleMatch = layaRuleEngine.evaluateRules(trimmed, sessionId);
    if (ruleMatch) {
      console.log(`[LayaRouter] ⚡ Deterministic Rule Match: Route=${ruleMatch.route} | Operation=${ruleMatch.operation || 'none'} | Confidence=${ruleMatch.confidence}`);
      return ruleMatch;
    }

    // 2. Fast lightweight semantic classifier for all intents (Fast Router LLM)
    const openrouterKey = options.openrouterApiKey?.trim();
    if (openrouterKey) {
      try {
        console.log('[LayaRouter] 🔍 Executing Fast Router LLM Semantic Classifier...');
        const classifierPrompt = `You are Laya, an ultra-fast typed decision router for an AI Task Manager.
Analyze the user prompt and respond with ONLY a raw valid JSON object without markdown codeblocks:
{
  "route": "SIMPLE_LLM" | "SINGLE_TOOL" | "AGENT",
  "operation": "get_tasks" | "create_task" | "update_task" | "complete_task" | "delete_task" | "delete_all_tasks" | "replan_day" | "get_lists" | "create_list" | "none",
  "confidence": 0.95,
  "reasoningLevel": "NONE" | "LOW" | "MEDIUM" | "HIGH",
  "promptModules": ["base", "taskQuery", "taskMutation", "taskCreation", "taskDeletion", "scheduling", "prioritization"],
  "tools": ["get_tasks", "get_lists", "complete_task", "create_task", "delete_task", "delete_all_tasks", "replan_day"],
  "context": ["TASKS", "TASK_LISTS", "TODAY_AGENDA", "USER_PREFERENCES"],
  "history": false,
  "memory": false,
  "requiresClarification": false,
  "reason": "Short intent summary",
  "parameters": {}
}

CRITICAL ROUTING & CONTEXT RULES:
1. PLANNING & SCHEDULING (e.g. "plan my day", "i haven't done anything today", "schedule my time", "what should I do now"):
   - Set "route": "AGENT"
   - Set "operation": "replan_day"
   - Set "context": ["TASKS", "TODAY_AGENDA"]
   - Set "tools": ["get_tasks", "replan_day"]
   - Set "promptModules": ["base", "taskQuery", "scheduling", "prioritization"]

2. VIEW / QUERY TASKS (e.g. "show my tasks", "list tasks", "what's on my board"):
   - Set "route": "SINGLE_TOOL"
   - Set "operation": "get_tasks"
   - Set "context": ["TASKS"]
   - Set "tools": ["get_tasks"]

3. CREATE / ADD TASKS (e.g. "remind me to buy milk", "add a task"):
   - Set "route": "SINGLE_TOOL" or "AGENT"
   - Set "operation": "create_task"
   - Set "context": ["TASKS"]
   - Set "tools": ["create_task"]

4. SIMPLE_LLM is strictly reserved for pure greetings ("hello", "hi"), casual small talk, or general non-task informational advice where NO database context or tools are required.

User Prompt: "${trimmed}"`;

        const candidateModels = [
          options.defaultModel?.trim(),
          'google/gemini-2.5-flash',
          'openrouter/auto',
        ].filter((m): m is string => Boolean(m && typeof m === 'string'));

        const modelToUse = candidateModels[0] || 'google/gemini-2.5-flash';
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aitaskmanager.app',
            'X-Title': 'Personal AI Task Manager',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [{ role: 'user', content: classifierPrompt }],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.choices?.[0]?.message?.content || '';
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned) as LayaRoutingResult;

          if (parsed && (parsed.route === 'SINGLE_TOOL' || parsed.route === 'SIMPLE_LLM' || parsed.route === 'AGENT')) {
            console.log(`[LayaRouter] 🧠 Fast Router LLM Match: Route=${parsed.route} | Operation=${parsed.operation || 'none'} | Context=[${(parsed.context || []).join(', ')}] | Confidence=${parsed.confidence}`);
            return {
              route: parsed.route,
              operation: parsed.operation || undefined,
              confidence: Number(parsed.confidence) || 0.95,
              reasoningLevel: parsed.reasoningLevel || 'LOW',
              promptModules: (parsed.promptModules || ['base']) as any,
              tools: parsed.tools || [],
              context: (parsed.context || ['TASKS']) as any,
              history: Boolean(parsed.history),
              memory: Boolean(parsed.memory),
              requiresClarification: Boolean(parsed.requiresClarification),
              reason: parsed.reason || 'Fast Router LLM semantic classification',
              parameters: parsed.parameters || {},
            };
          }
        }
      } catch (err) {
        console.warn('[LayaRouter] Fast Router LLM classification fallback warning:', (err as Error).message);
      }
    }

    // 3. Default Safe Fallback: SINGLE_LLM with minimal tools
    console.log('[LayaRouter] 🛡️ Fallback to default SIMPLE_LLM route.');
    return {
      route: 'SIMPLE_LLM',
      confidence: 0.7,
      reasoningLevel: 'LOW',
      promptModules: ['base', 'taskQuery'],
      tools: ['get_tasks', 'get_today_agenda'],
      context: ['TASKS', 'TODAY_AGENDA'],
      history: false,
      memory: false,
      requiresClarification: false,
      reason: 'Default safe fallback route',
      parameters: {},
    };
  }
}

export const layaRouter = new LayaRouter();
