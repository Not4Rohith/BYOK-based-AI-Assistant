import { LayaRoutingResult } from './routing.types.js';
import { transientScratchpadService } from '../../services/scratchpad.service.js';

// Semantic Concept Dictionaries for Intent Normalization
const CREATE_VERBS = [
  'create', 'add', 'schedule', 'generate', 'suggest', 'put', 'insert',
  'build', 'setup', 'set up', 'organize', 'draft', 'make', 'populate',
  'list', 'prepare', 'construct', 'formulate', 'assign', 'fill in',
  'lay out', 'write down', 'break down', 'plan', 'structure'
];

const TASK_NOUNS = [
  'task', 'tasks', 'to-do', 'to-dos', 'todos', 'todo', 'item', 'items',
  'checklist', 'agenda', 'schedule', 'plan', 'work', 'job', 'jobs',
  'activity', 'activities', 'things to do', 'duties', 'goals',
  'assignments', 'routine'
];

const COMPLETE_VERBS = [
  'mark', 'complete', 'finish', 'check off', 'check-off', 'done',
  'tick off', 'tick-off', 'cross off', 'cross-off', 'wrap up', 'fulfill'
];

const DELETE_VERBS = [
  'delete', 'remove', 'clear', 'erase', 'drop', 'cancel', 'get rid of',
  'trash', 'discard'
];

export class LayaRuleEngine {
  public evaluateRules(prompt: string, sessionId?: string): LayaRoutingResult | null {
    const p = prompt.trim();
    const cleanPrompt = p.replace(/[.!?]+$/, '').trim();
    const lower = cleanPrompt.toLowerCase();

    // 1. Simple Greetings, Casual Chat & Ambiguous Single Words
    if (/^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you|all|what|help|do)[\s!?.]*$/i.test(p)) {
      return {
        route: 'SIMPLE_LLM',
        confidence: 0.9,
        reasoningLevel: 'NONE',
        promptModules: ['base'],
        tools: [],
        context: [],
        history: true,
        memory: false,
        requiresClarification: false,
        reason: 'Casual greeting or ambiguous single-word prompt',
        parameters: {},
      };
    }

    // Semantic Intent Helper Checks
    const hasCreateVerb = CREATE_VERBS.some((v) => lower.includes(v));
    const hasTaskNoun = TASK_NOUNS.some((n) => lower.includes(n));
    const hasCompleteVerb = COMPLETE_VERBS.some((v) => lower.includes(v));
    const hasDeleteVerb = DELETE_VERBS.some((v) => lower.includes(v));

    // 2. Semantic Task Completion Intent
    if (hasCompleteVerb) {
      for (const verb of COMPLETE_VERBS) {
        if (lower.includes(verb)) {
          const idx = lower.indexOf(verb);
          const rawTarget = cleanPrompt.substring(idx + verb.length).replace(/^(?:task|the task|as done|as completed|as finished|\s)+/i, '').trim();
          const taskTitle = rawTarget.replace(/^["']|["']$/g, '');
          if (taskTitle.length > 0) {
            return {
              route: 'SINGLE_TOOL',
              operation: 'complete_task',
              confidence: 0.98,
              reasoningLevel: 'NONE',
              promptModules: ['taskMutation'],
              tools: ['complete_task'],
              context: ['TASKS'],
              history: false,
              memory: false,
              requiresClarification: false,
              reason: `Semantic match for task completion (verb: ${verb})`,
              parameters: { taskTitle },
            };
          }
        }
      }
    }

    // 3. Semantic Task Deletion Intent (Single Task or Bulk Deletion)
    const isBulkDelete =
      /^(?:please\s+)?(?:can\s+you\s+)?(?:delete|remove|clear|erase|purge|drop)\s+(?:all\s+)?(?:my\s+)?tasks$/i.test(cleanPrompt) ||
      /^(?:delete|clear|remove|erase|purge|drop)\s+(?:all|everything|all\s+tasks|all\s+my\s+tasks|all\s+of\s+my\s+tasks)$/i.test(cleanPrompt) ||
      lower === 'delete all tasks' ||
      lower === 'clear all tasks' ||
      lower === 'delete all' ||
      lower === 'clear tasks' ||
      lower === 'remove all tasks' ||
      lower === 'delete everything';

    if (isBulkDelete) {
      // Set one-time transient scratchpad state for confirmation
      transientScratchpadService.setPendingAction(sessionId || 'default', {
        operation: 'delete_all_tasks',
        tools: ['delete_all_tasks'],
        promptModules: ['taskDeletion'],
        context: ['TASKS'],
      });

      return {
        route: 'SIMPLE_LLM',
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

    if (hasDeleteVerb) {
      for (const verb of DELETE_VERBS) {
        if (lower.includes(verb)) {
          const idx = lower.indexOf(verb);
          const rawTarget = cleanPrompt.substring(idx + verb.length).replace(/^(?:task|the task|\s)+/i, '').trim();
          const target = rawTarget.replace(/^["']|["']$/g, '').toLowerCase().replace(/[.!?]+$/, '');

          if (
            ['all tasks', 'all', 'all my tasks', 'everything', 'every task', 'all of my tasks', 'all of the tasks'].includes(target)
          ) {
            transientScratchpadService.setPendingAction(sessionId || 'default', {
              operation: 'delete_all_tasks',
              tools: ['delete_all_tasks'],
              promptModules: ['taskDeletion'],
              context: ['TASKS'],
            });

            return {
              route: 'SIMPLE_LLM',
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

          if (target === 'that' || target === 'it' || target.length === 0) {
            return {
              route: 'SINGLE_TOOL',
              operation: 'delete_task',
              confidence: 0.5,
              reasoningLevel: 'LOW',
              promptModules: ['taskDeletion'],
              tools: ['delete_task'],
              context: ['TASKS'],
              history: true,
              memory: false,
              requiresClarification: true,
              reason: 'Ambiguous task deletion target',
              parameters: {},
            };
          }
          return {
            route: 'SINGLE_TOOL',
            operation: 'delete_task',
            confidence: 0.95,
            reasoningLevel: 'NONE',
            promptModules: ['taskDeletion'],
            tools: ['delete_task'],
            context: ['TASKS'],
            history: false,
            memory: false,
            requiresClarification: false,
            reason: `Semantic match for task deletion (verb: ${verb})`,
            parameters: { taskTitle: target },
          };
        }
      }
    }

    // 4. Semantic Task List / Categories Query Intent
    if (
      /^(show|get|list|view|display|fetch|retrieve|see)\s+(?:my\s+)?(?:all\s+)?(?:lists|categories|task\s+lists)$/i.test(cleanPrompt) ||
      lower === 'lists' ||
      lower === 'my lists' ||
      lower === 'all lists' ||
      lower === 'categories' ||
      lower === 'my categories' ||
      lower === 'all categories'
    ) {
      return {
        route: 'SINGLE_TOOL',
        operation: 'get_lists',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['taskQuery'],
        tools: ['get_lists'],
        context: ['TASK_LISTS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Semantic task list categories retrieval request',
        parameters: {},
      };
    }

    // 4.5. Semantic Task Query & Agenda Intent
    if (/^(show|get|list|view|display|fetch|retrieve|see)\s+(?:my\s+)?(?:all\s+)?tasks$/i.test(cleanPrompt) || lower === 'tasks' || lower === 'my tasks') {
      return {
        route: 'SINGLE_TOOL',
        operation: 'get_tasks',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['taskQuery'],
        tools: ['get_tasks'],
        context: ['TASKS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Semantic task list retrieval request',
        parameters: { filter: 'pending' },
      };
    }

    if (/^(show|get|view|display|fetch)\s+(?:my\s+)?(?:today'?s?\s+)?agenda$/i.test(p) || lower === 'agenda' || lower === "today's agenda") {
      return {
        route: 'SINGLE_TOOL',
        operation: 'get_today_agenda',
        confidence: 0.98,
        reasoningLevel: 'NONE',
        promptModules: ['taskQuery'],
        tools: ['get_today_agenda'],
        context: ['TODAY_AGENDA', 'TASKS'],
        history: false,
        memory: false,
        requiresClarification: false,
        reason: 'Semantic today agenda retrieval request',
        parameters: {},
      };
    }

    // 5. Semantic Multi-Task Creation / Dynamic Goal Breakdown (Agent Route)
    // Matches ANY prompt that combines a creation verb with task nouns or temporal planning concepts
    const isMultiTaskCreationIntent =
      (hasCreateVerb && hasTaskNoun) ||
      lower.includes('checklist') ||
      lower.includes('to-dos') ||
      lower.includes('todos') ||
      lower.includes('what i need to do') ||
      lower.includes('what i ought to do') ||
      lower.includes('things for me today') ||
      lower.includes('my daily schedule') ||
      lower.includes('plan for today');

    if (isMultiTaskCreationIntent && !lower.startsWith('add task ') && !lower.startsWith('create task ')) {
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
        reason: 'Semantic multi-task creation & dynamic planning intent detected',
        parameters: {},
      };
    }

    // 6. Direct Single Task Creation
    const createMatch = lower.match(/^(?:create|add|schedule|insert|put)\s+(?:a\s+)?task\s+(?:called|named\s+|:\s*)?(.+)$/i);
    if (createMatch && createMatch[1]) {
      const rawTitle = createMatch[1].trim().replace(/^["']|["']$/g, '');
      if (rawTitle.length > 0 && !rawTitle.toLowerCase().startsWith('tasks')) {
        return {
          route: 'SINGLE_TOOL',
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

    // 7. Direct Replanning Intent
    if (/^(replan\s+my\s+day|replan\s+schedule|auto\s+replan|reschedule\s+today)$/i.test(p)) {
      return {
        route: 'SINGLE_TOOL',
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

    // 8. Simple Read-Only Reasoning (Summarization, Focus Advice)
    if (
      lower.includes('which task should i prioritize') ||
      lower.includes('why is my schedule overloaded') ||
      lower.includes('summarize my tasks') ||
      lower.includes('help me decide what to work on')
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
        reason: 'Lightweight read-only reasoning request suitable for single LLM call',
        parameters: {},
      };
    }

    return null; // Fallback to semantic LLM classifier if rule confidence is uncertain
  }
}

export const layaRuleEngine = new LayaRuleEngine();
