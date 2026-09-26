import { LayaRoutingResult, LayaRouterOptions } from './routing.types.js';
import { layaRuleEngine } from './routing.rules.js';

export class LayaRouter {
  public async route(
    userPrompt: string,
    options: LayaRouterOptions = {}
  ): Promise<LayaRoutingResult> {
    const trimmed = (userPrompt || '').trim();

    // 1. Fast deterministic rule evaluation (< 1ms, 0 API cost)
    const ruleMatch = layaRuleEngine.evaluateRules(trimmed);
    if (ruleMatch) {
      console.log(`[LayaRouter] ⚡ Deterministic Rule Match: Route=${ruleMatch.route} | Operation=${ruleMatch.operation || 'none'} | Confidence=${ruleMatch.confidence}`);
      return ruleMatch;
    }

    // 2. Fast lightweight semantic fallback for complex prompts
    const openrouterKey = options.openrouterApiKey?.trim();
    if (openrouterKey) {
      try {
        console.log('[LayaRouter] 🔍 Executing lightweight semantic classification...');
        const classifierPrompt = `You are Laya, an ultra-fast typed decision router for an AI Task Manager.
Analyze the user prompt and respond with ONLY a raw valid JSON object without codeblocks:
{
  "route": "SIMPLE_LLM" | "SINGLE_TOOL" | "AGENT",
  "operation": "get_tasks" | "create_task" | "update_task" | "complete_task" | "delete_task" | "delete_all_tasks" | "replan_day" | "get_lists" | "create_list" | "none",
  "confidence": 0.85,
  "reasoningLevel": "NONE" | "LOW" | "MEDIUM" | "HIGH",
  "promptModules": ["base", "taskQuery", "taskMutation", "taskCreation", "taskDeletion", "scheduling", "prioritization"],
  "tools": ["get_tasks", "get_lists", "complete_task", "create_task", "delete_task", "delete_all_tasks", "replan_day"],
  "context": ["TASKS", "TASK_LISTS", "TODAY_AGENDA", "USER_PREFERENCES"],
  "history": false,
  "memory": false,
  "requiresClarification": false,
  "reason": "Short summary",
  "parameters": {}
}

CRITICAL ROUTING RULES:
1. If the user prompt asks to show, list, or view task lists/categories (e.g. "list all lists", "show lists", "categories"), set route to SINGLE_TOOL and operation to "get_lists".
2. If the user prompt asks to delete all tasks, clear all tasks, or delete everything, set route to SINGLE_TOOL and operation to "delete_all_tasks".
3. If the user prompt is a single ambiguous word (e.g. "all", "delete", "list", "show", "what"), DO NOT route to SINGLE_TOOL or call get_tasks. Set route to SIMPLE_LLM, operation to "none", and tools to [].
4. If the user prompt asks to CREATE, ADD, EDIT, COMPLETE, DELETE, or REPLAN tasks/categories, set route to AGENT or SINGLE_TOOL.
5. SIMPLE_LLM is strictly reserved for greetings ("hello", "hi"), casual conversation, ambiguous short words, and pure informational advice where NO tool actions are performed.

User Prompt: "${trimmed}"`;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aitaskmanager.app',
            'X-Title': 'Personal AI Task Manager',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: classifierPrompt }],
            temperature: 0.1,
            max_tokens: 150,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.choices?.[0]?.message?.content || '';
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned) as LayaRoutingResult;

          if (parsed && (parsed.route === 'SINGLE_TOOL' || parsed.route === 'SIMPLE_LLM' || parsed.route === 'AGENT')) {
            console.log(`[LayaRouter] 🧠 Semantic LLM Classification: Route=${parsed.route} | Operation=${parsed.operation || 'none'} | Confidence=${parsed.confidence}`);
            return {
              route: parsed.route,
              operation: parsed.operation || undefined,
              confidence: Number(parsed.confidence) || 0.85,
              reasoningLevel: parsed.reasoningLevel || 'LOW',
              promptModules: (parsed.promptModules || ['base']) as any,
              tools: parsed.tools || [],
              context: (parsed.context || ['TASKS']) as any,
              history: Boolean(parsed.history),
              memory: Boolean(parsed.memory),
              requiresClarification: Boolean(parsed.requiresClarification),
              reason: parsed.reason || 'Semantic classification',
              parameters: parsed.parameters || {},
            };
          }
        }
      } catch (err) {
        console.warn('[LayaRouter] Lightweight classifier fallback warning:', (err as Error).message);
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
