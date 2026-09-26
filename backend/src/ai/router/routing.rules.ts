import { LayaRoutingResult } from './routing.types.js';

export class LayaRuleEngine {
  public evaluateRules(prompt: string): LayaRoutingResult | null {
    const p = prompt.trim();
    const lower = p.toLowerCase();

    // 1. Simple Greetings & Casual Chat
    if (/^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you)[\s!?.]*$/i.test(p)) {
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
        reason: 'Casual greeting or non-task conversational prompt',
        parameters: {},
      };
    }

    // 2. Direct Task Completion
    const completeMatch = lower.match(/^(?:mark|complete|check\s*off)\s+(?:task\s+)?(.+?)(?:\s+as\s+(?:done|completed))?$/i);
    if (completeMatch && completeMatch[1]) {
      const taskTitle = completeMatch[1].trim().replace(/^["']|["']$/g, '');
      if (taskTitle.length > 0) {
        return {
          route: 'DIRECT',
          operation: 'complete_task',
          confidence: 0.98,
          reasoningLevel: 'NONE',
          promptModules: ['taskMutation'],
          tools: ['complete_task'],
          context: ['TASKS'],
          history: false,
          memory: false,
          requiresClarification: false,
          reason: 'Unambiguous direct task completion command',
          parameters: { taskTitle },
        };
      }
    }

    // 3. Direct Task Queries & Agenda
    if (/^(show|get|list|view|display)\s+(?:my\s+)?(?:all\s+)?tasks$/i.test(p) || lower === 'tasks') {
      return {
        route: 'DIRECT',
        operation: 'get_tasks',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['taskQuery'],
        tools: ['get_tasks'],
        context: ['TASKS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Direct task list retrieval request',
        parameters: { filter: 'pending' },
      };
    }

    if (/^(show|get|view|display)\s+(?:my\s+)?(?:today'?s?\s+)?agenda$/i.test(p) || lower === 'agenda' || lower === "today's agenda") {
      return {
        route: 'DIRECT',
        operation: 'get_today_agenda',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['taskQuery'],
        tools: ['get_today_agenda'],
        context: ['TODAY_AGENDA', 'TASKS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Direct today agenda retrieval request',
        parameters: {},
      };
    }

    // 4. Multi-Task Creation / Dynamic Goal Breakdown (Agent Route)
    if (
      /^(?:create|add|schedule|generate|suggest|break\s+down)\s+(?:all\s+)?(?:necessary\s+)?tasks?\b/i.test(p) ||
      lower.includes('add all necessary tasks') ||
      lower.includes('add tasks') ||
      lower.includes('create tasks') ||
      lower.includes('suggest tasks') ||
      lower.includes('generate tasks')
    ) {
      return {
        route: 'AGENT',
        confidence: 0.95,
        reasoningLevel: 'MEDIUM',
        promptModules: ['base', 'taskCreation', 'scheduling', 'agentReasoning'],
        tools: ['create_task', 'batch_create_tasks', 'get_tasks', 'get_today_agenda', 'replan_day'],
        context: ['TASKS', 'TODAY_AGENDA'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Multi-task creation / dynamic planning prompt requiring tool calls',
        parameters: {},
      };
    }

    // 5. Direct Single Task Creation
    const createMatch = lower.match(/^(?:create|add|schedule)\s+(?:a\s+)?task\s+(?:called|named\s+|:\s*)?(.+)$/i);
    if (createMatch && createMatch[1]) {
      const rawTitle = createMatch[1].trim().replace(/^["']|["']$/g, '');
      if (rawTitle.length > 0 && !rawTitle.toLowerCase().startsWith('tasks')) {
        return {
          route: 'DIRECT',
          operation: 'create_task',
          confidence: 0.95,
          reasoningLevel: 'NONE',
          promptModules: ['taskCreation'],
          tools: ['create_task'],
          context: ['TASKS', 'TASK_LISTS'],
          history: false,
          memory: false,
          requiresClarification: false,
          reason: 'Direct single task creation command',
          parameters: { title: rawTitle },
        };
      }
    }

    // 6. Direct Task Deletion
    const deleteMatch = lower.match(/^(?:delete|remove)\s+(?:the\s+)?task\s+(.+)$/i);
    if (deleteMatch && deleteMatch[1]) {
      const target = deleteMatch[1].trim().replace(/^["']|["']$/g, '');
      if (target === 'that' || target === 'it' || target.length === 0) {
        return {
          route: 'DIRECT',
          operation: 'delete_task',
          confidence: 0.5,
          reasoningLevel: 'LOW',
          promptModules: ['taskDeletion'],
          tools: ['delete_task'],
          context: ['TASKS'],
          history: true,
          memory: false,
          requiresClarification: true,
          reason: 'Ambiguous task deletion target requires user clarification',
          parameters: {},
        };
      }
      return {
        route: 'DIRECT',
        operation: 'delete_task',
        confidence: 0.95,
        reasoningLevel: 'NONE',
        promptModules: ['taskDeletion'],
        tools: ['delete_task'],
        context: ['TASKS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Direct single task deletion command',
        parameters: { taskTitle: target },
      };
    }

    // 7. Direct List / Category Operations
    const createListMatch = lower.match(/^(?:create|add)\s+(?:a\s+)?(?:category|list)\s+(?:called|named\s+)?(.+)$/i);
    if (createListMatch && createListMatch[1]) {
      const listTitle = createListMatch[1].trim().replace(/^["']|["']$/g, '');
      return {
        route: 'DIRECT',
        operation: 'create_list',
        confidence: 0.95,
        reasoningLevel: 'NONE',
        promptModules: ['lists'],
        tools: ['create_list'],
        context: ['TASK_LISTS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Direct category creation command',
        parameters: { title: listTitle },
      };
    }

    if (/^(show|get|view|list)\s+(?:my\s+)?(?:categories|lists)$/i.test(p) || lower === 'lists' || lower === 'categories') {
      return {
        route: 'DIRECT',
        operation: 'get_lists',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['lists'],
        tools: ['get_lists'],
        context: ['TASK_LISTS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Direct lists retrieval request',
        parameters: {},
      };
    }

    // 8. Direct Replanning
    if (/^(replan\s+my\s+day|replan\s+schedule|auto\s+replan)$/i.test(p)) {
      return {
        route: 'DIRECT',
        operation: 'replan_day',
        confidence: 0.95,
        reasoningLevel: 'LOW',
        promptModules: ['scheduling'],
        tools: ['replan_day'],
        context: ['TASKS', 'TODAY_AGENDA', 'USER_PREFERENCES'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Direct day replanning command',
        parameters: {},
      };
    }

    // 9. Simple LLM Reasoning (Summarization, Focus Advice, Task Queries)
    if (
      lower.includes('which task should i prioritize') ||
      lower.includes('why is my schedule overloaded') ||
      lower.includes('summarize my tasks') ||
      lower.includes('help me decide what to work on') ||
      lower.includes('which of my tasks are related')
    ) {
      return {
        route: 'SIMPLE_LLM',
        confidence: 0.92,
        reasoningLevel: 'LOW',
        promptModules: ['base', 'prioritization', 'scheduling'],
        tools: [],
        context: ['TASKS', 'TODAY_AGENDA', 'USER_PREFERENCES'],
        history: false,
        memory: true,
        requiresClarification: false,
        reason: 'Lightweight reasoning / prioritization request suitable for single LLM call',
        parameters: {},
      };
    }

    // 10. Multi-step Agentic Replanning
    if (
      lower.includes('reorganize my entire day') ||
      lower.includes('create a complete study plan') ||
      lower.includes('clean up my task system')
    ) {
      return {
        route: 'AGENT',
        confidence: 0.95,
        reasoningLevel: 'HIGH',
        promptModules: ['base', 'scheduling', 'prioritization', 'agentReasoning'],
        tools: ['get_tasks', 'get_today_agenda', 'replan_day', 'update_task', 'bulk_update_tasks', 'create_task'],
        context: ['TASKS', 'TODAY_AGENDA', 'USER_PREFERENCES', 'GOALS'],
        history: true,
        memory: true,
        requiresClarification: false,
        reason: 'Multi-step complex replanning / restructuring request requiring LangGraph agent',
        parameters: {},
      };
    }

    return null; // Fallback to LLM classifier if no rule matched
  }
}

export const layaRuleEngine = new LayaRuleEngine();
