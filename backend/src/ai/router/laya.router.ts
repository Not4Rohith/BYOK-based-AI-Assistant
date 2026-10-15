import { Laya, type Question, type SystemOneResult } from 'laya-ts';
import {
  LayaRoutingResult,
  LayaRouterOptions,
  RouteType,
  ReasoningLevel,
  PromptModuleKey,
  ContextCategory,
} from './routing.types.js';
import { layaRuleEngine } from './routing.rules.js';
import { transientScratchpadService } from '../../services/scratchpad.service.js';
import { transientScratchpad } from '../scratchpad.js';

export const TOOL_CATALOG: Record<string, { description: string }> = {
  get_tasks: {
    description: "Fetch the user's tasks with optional status or category filters.",
  },
  search_tasks: {
    description: "Keyword search across task titles, descriptions, and tags.",
  },
  get_today_agenda: {
    description: "Fetch today's schedule agenda, time blocks, and pending tasks.",
  },
  create_task: {
    description: "Create a single new task on the task board.",
  },
  batch_create_tasks: {
    description: "Create multiple tasks in one operation with automatic time sequencing.",
  },
  update_task: {
    description: "Modify an existing task's title, priority, status, or scheduled dates.",
  },
  bulk_update_tasks: {
    description: "Update status, priority, or schedule for multiple tasks simultaneously.",
  },
  complete_task: {
    description: "Mark a task or subtask as completed.",
  },
  snooze_task: {
    description: "Postpone or reschedule a task to later today or tomorrow.",
  },
  delete_task: {
    description: "Delete a specific task by title or ID.",
  },
  delete_all_tasks: {
    description: "Delete every task from the task board. Destructive operation.",
  },
  create_subtask: {
    description: "Add a sub-action item to an existing task.",
  },
  delete_subtask: {
    description: "Remove a subtask from a parent task.",
  },
  get_lists: {
    description: "Retrieve all task categories and lists.",
  },
  create_list: {
    description: "Create a new task category or list.",
  },
  delete_list: {
    description: "Delete a task category and all tasks contained inside it.",
  },
  delete_all_lists: {
    description: "Delete all task categories and lists.",
  },
  create_ai_agent_goal: {
    description: "Register an autonomous background goal for scheduled execution.",
  },
  get_active_ai_goals: {
    description: "Fetch scheduled autonomous background goals.",
  },
  cancel_ai_agent_goal: {
    description: "Cancel a scheduled background goal by ID.",
  },
  schedule_self_alarm: {
    description: "Schedule an autonomous self-invoking alarm for the AI model to wake itself up and trigger operations at a future time or delay.",
  },
  read_scratchpad: {
    description: "Access and retrieve previous tool execution results and compressed multi-step reasoning summaries from the transient scratchpad.",
  },
};

export const MODULE_CATALOG: Record<string, { description: string }> = {
  base: { description: "Core identity, time awareness, and conversational style." },
  taskQuery: { description: "Rules for reading, querying, and displaying tasks." },
  taskCreation: { description: "Rules for creating tasks and extracting task attributes." },
  taskMutation: { description: "Rules for modifying, completing, and snoozing tasks." },
  taskDeletion: { description: "Rules for handling single and bulk task deletion safely." },
  scheduling: { description: "Rules for LLM-driven day planning, time-blocking, and schedule buffers." },
  prioritization: { description: "Rules for task ordering, urgency, and priority levels." },
  memory: { description: "Rules for utilizing short-term (daily focus/actions), medium-term (weekly projects/exams), and long-term (enduring habits/constraints) memories." },
  goalPlanning: { description: "Rules for aligning schedule with user's active goals and target dates." },
  taskDecomposition: { description: "Rules for breaking goals and projects into concrete timed tasks." },
  agentReasoning: { description: "Rules for multi-step agent reasoning and tool orchestration." },
  autonomousAgent: { description: "Rules for autonomous background goal scheduling, self-invoking AI alarms, and delayed self-trigger execution." },
};

export const CONTEXT_CATALOG: Record<string, { description: string }> = {
  TASKS: { description: "Current user task board state, incomplete tasks, and deadlines." },
  TASK_LISTS: { description: "User task categories and lists." },
  TODAY_AGENDA: { description: "Today's scheduled agenda, calendar events, and time slots." },
  CALENDAR: { description: "Google Calendar events and external appointments." },
  USER_PREFERENCES: { description: "User structured planning preferences and fixed routines." },
  PERSONAL_INSTRUCTIONS: { description: "User-specific instructions and preferences for how the AI should behave." },
  GOALS: { description: "User active goals, target dates, priorities, and milestones." },
  RELEVANT_MEMORIES: { description: "User long-term preferences, medium-term weekly focus/exams, and short-term recent actions retrieved semantically via embeddings." },
  CURRENT_TIME: { description: "Current local date, time, weekday, and timezone." },
  CHAT_HISTORY: { description: "Recent conversation history." },
  TRANSIENT_SCRATCHPAD: { description: "Transient scratchpad holding compressed summaries of previous tool calls and multi-step reasoning notes in the active session." },
};

export class LayaRouter {
  private layaClient: Laya | null = null;
  private layaLoadingPromise: Promise<Laya> | null = null;

  /**
   * Warm up / preload the local Laya ONNX runtime instance in background.
   */
  public async warmup(): Promise<void> {
    try {
      await this.getLayaClient();
    } catch (err: any) {
      console.warn('[LayaRouter] Warmup background notice:', err?.message || String(err));
    }
  }

  /**
   * Lazily loads and caches the local Laya ONNX runtime instance.
   */
  private async getLayaClient(): Promise<Laya> {
    if (this.layaClient) {
      return this.layaClient;
    }
    if (this.layaLoadingPromise) {
      return this.layaLoadingPromise;
    }

    this.layaLoadingPromise = (async () => {
      const modelDir = process.env.LAYA_MODEL_DIR;
      console.log('[LayaRouter] 🚀 Loading Laya System 1 decision engine...');
      const client = await Laya.load(modelDir ? { modelDir } : {});
      console.log(`[LayaRouter] ✅ Laya System 1 engine ready (loaded from ${client.modelDir}).`);
      this.layaClient = client;
      return client;
    })();

    return this.layaLoadingPromise;
  }

  public async route(
    userPrompt: string,
    options: LayaRouterOptions = {}
  ): Promise<LayaRoutingResult> {
    const trimmed = (userPrompt || '').trim();
    const sessionId = options.sessionId || 'default';

    // 0. Contextual Follow-up Detection (Reuse previous turn's Laya decision)
    const cleanLower = trimmed.replace(/[.!?]+$/, '').trim().toLowerCase();
    const isContextualFollowup = /^(yes|yeah|yep|sure|confirm|do\s+it|go\s+ahead|ok|okay|proceed|y|correct|please|no|nope|cancel|stop|don'?t|nevermind|n|abort)[\s!?.]*$/i.test(cleanLower);

    if (isContextualFollowup) {
      const prevDecision = transientScratchpadService.getLastLayaDecision(sessionId);
      if (prevDecision) {
        console.log(`[LayaRouter] 🔄 Contextual Follow-up ("${trimmed}"). Reusing previous turn routing decision (Tools=[${(prevDecision.tools || []).join(', ')}]).`);
        return {
          ...prevDecision,
          confidence: 0.98,
          history: true,
          reason: 'Contextual follow-up reusing previous turn route decision',
        };
      }
    }

    // 1. Fast deterministic rule evaluation (< 1ms, 0 API cost)
    const ruleMatch = layaRuleEngine.evaluateRules(trimmed, sessionId);
    if (ruleMatch) {
      console.log(`[LayaRouter] ⚡ Deterministic Rule Match: Route=${ruleMatch.route} | Operation=${ruleMatch.operation || 'none'} | Confidence=${ruleMatch.confidence}`);
      return ruleMatch;
    }

    // 2. Build Multi-Question Semantic Decision Questions for Laya System 1 Model
    const toolCriteria: Record<string, string> = {
      none: 'No tool required. Conversational inquiry, general assistance, advice, or questions.',
    };
    for (const [name, meta] of Object.entries(TOOL_CATALOG)) {
      toolCriteria[name] = meta.description;
    }

    const questions = {
      command_type: {
        type: 'choice' as const,
        instructions: 'What primary type of command or user intent is this prompt expressing?',
        criteria: {
          TASK_CREATION: 'Creating, adding, scheduling, or entering new tasks, todos, reminders, or assignments.',
          TASK_QUERY: 'Viewing, reading, searching, listing, or checking existing tasks or status.',
          TASK_MUTATION: 'Modifying, updating, marking complete or done, snoozing, or managing subtasks for existing tasks.',
          TASK_DELETION: 'Deleting, removing, or clearing tasks from the board.',
          SCHEDULE_PLANNING: 'Planning, organizing, structuring, or time-blocking today schedule or routine.',
          LIST_MANAGEMENT: 'Creating, viewing, listing, or deleting task categories or lists.',
          GOAL_MANAGEMENT: 'Creating, scheduling, viewing, or managing autonomous background goals, self-invoking AI alarms, or milestones.',
          MEMORY_AND_PREFERENCES: 'Viewing, recording, or asking about user memories, habits, daily routine, bed time, sleep schedule, or planning preferences across short-term, medium-term, or long-term tiers.',
          SCRATCHPAD_INSPECTION: 'Checking, inspecting, or continuing multi-step work from the transient scratchpad memory.',
          CONVERSATIONAL: 'General conversation, asking questions, advice, greetings, or explanations without task modifications.',
        },
      },
      tool_selection: {
        type: 'choice' as const,
        instructions: 'Which exact database tool is required to execute the user request?',
        criteria: toolCriteria,
      },
      needs_memories: {
        type: 'noul' as const,
        instructions: 'Does this prompt mention, ask about, or rely on user habits, personal preferences, daily routine, bed time, sleep schedule, memories, weekly focus, or scheduling constraints?',
      },
      needs_chat_history: {
        type: 'noul' as const,
        instructions: 'Does this prompt refer to prior messages, earlier statements, or follow-up conversation?',
      },
      needs_calendar: {
        type: 'noul' as const,
        instructions: 'Does this prompt involve calendar events, meetings, or external appointments?',
      },
      needs_self_alarm: {
        type: 'noul' as const,
        instructions: 'Does this prompt request an autonomous self-alarm, follow-up wake-up timer, or future background execution?',
      },
    };

    try {
      const endpoint = (
        options.layaEndpoint ||
        options.endpoint ||
        process.env.LAYA_ENDPOINT ||
        process.env.LAYA_API_URL ||
        ''
      ).trim();

      let systemOneResult: any;

      if (endpoint) {
        // Fast self-hosted HTTP endpoint (e.g., /v1/systemone compatible with TypeSafe Jev / Laya)
        const targetUrl = endpoint.endsWith('/systemone') ? endpoint : `${endpoint.replace(/\/+$/, '')}/v1/systemone`;
        console.log(`[LayaRouter] 🌐 Routing prompt via self-hosted Laya endpoint (${targetUrl})...`);
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: { prompt: trimmed },
            questions,
          }),
        });
        if (!response.ok) {
          throw new Error(`Self-hosted Laya HTTP ${response.status}: ${response.statusText}`);
        }
        systemOneResult = await response.json();
      } else {
        // Local ONNX Runtime evaluation via laya-ts SDK
        console.log('[LayaRouter] 🧠 Evaluating prompt via laya-ts System 1 decision engine...');
        const laya = await this.getLayaClient();
        systemOneResult = await laya.systemOne({ prompt: trimmed }, questions);
      }

      const answers = systemOneResult?.answers || {};
      const commandAnswer = answers.command_type;
      const toolAnswer = answers.tool_selection;
      const memoryAnswer = answers.needs_memories;
      const historyAnswer = answers.needs_chat_history;
      const calendarAnswer = answers.needs_calendar;
      const alarmAnswer = answers.needs_self_alarm;

      const commandType = commandAnswer?.type === 'choice' ? commandAnswer.choice : 'CONVERSATIONAL';
      const commandConfidence = commandAnswer?.confidence ?? 0.85;

      const selectedTools: string[] = [];
      const selectedModules: PromptModuleKey[] = ['base'];
      const selectedContext: ContextCategory[] = ['CURRENT_TIME'];

      // 1. Semantic Classification: Map Command Type to precision Tools, Modules & Context
      switch (commandType) {
        case 'TASK_CREATION':
          selectedModules.push('taskCreation', 'taskManagement');
          selectedContext.push('TASKS', 'TASK_LISTS', 'USER_PREFERENCES');
          if (/multiple|several|batch|all of (the following|these)|list of tasks/i.test(trimmed)) {
            selectedTools.push('batch_create_tasks', 'create_task');
          } else {
            selectedTools.push('create_task', 'batch_create_tasks');
          }
          break;

        case 'TASK_QUERY':
          selectedModules.push('taskQuery', 'taskManagement');
          selectedContext.push('TASKS', 'TODAY_AGENDA');
          if (/search|find|filter|look for/i.test(trimmed)) {
            selectedTools.push('search_tasks', 'get_tasks');
          } else if (/today|agenda|schedule/i.test(trimmed)) {
            selectedTools.push('get_today_agenda', 'get_tasks');
          } else {
            selectedTools.push('get_tasks', 'search_tasks');
          }
          break;

        case 'TASK_MUTATION':
          selectedModules.push('taskMutation', 'subtasks');
          selectedContext.push('TASKS');
          if (/snooze|postpone|delay|push to tomorrow/i.test(trimmed)) {
            selectedTools.push('snooze_task', 'update_task');
          } else if (/subtask|step|sub-item/i.test(trimmed)) {
            selectedTools.push('create_subtask', 'delete_subtask', 'update_task');
          } else if (/complete|done|finish|mark (as )?completed/i.test(trimmed)) {
            selectedTools.push('complete_task', 'update_task');
          } else if (/bulk|all (pending|these|selected)|every task/i.test(trimmed)) {
            selectedTools.push('bulk_update_tasks', 'update_task');
          } else {
            selectedTools.push('update_task', 'complete_task', 'bulk_update_tasks');
          }
          break;

        case 'TASK_DELETION':
          selectedModules.push('taskDeletion');
          selectedContext.push('TASKS');
          if (/all (tasks|todos)|everything|clear (the )?board/i.test(trimmed)) {
            selectedTools.push('delete_all_tasks', 'delete_task');
          } else {
            selectedTools.push('delete_task', 'delete_all_tasks');
          }
          break;

        case 'SCHEDULE_PLANNING':
          // LLM-Driven Day Planning: supply full agenda & tasks context with update and create tools
          selectedModules.push('scheduling', 'prioritization', 'taskCreation', 'taskMutation', 'taskDecomposition', 'taskManagement', 'memory');
          selectedContext.push('TODAY_AGENDA', 'TASKS', 'CALENDAR', 'USER_PREFERENCES', 'PERSONAL_INSTRUCTIONS', 'RELEVANT_MEMORIES');
          selectedTools.push('get_today_agenda', 'get_tasks', 'update_task', 'bulk_update_tasks', 'batch_create_tasks');
          break;

        case 'LIST_MANAGEMENT':
          selectedModules.push('lists');
          selectedContext.push('TASK_LISTS', 'TASKS');
          if (/delete all categories|delete all lists/i.test(trimmed)) {
            selectedTools.push('delete_all_lists', 'delete_list', 'get_lists');
          } else if (/delete (the )?(list|category)/i.test(trimmed)) {
            selectedTools.push('delete_list', 'get_lists');
          } else if (/create|new|add (a )?(list|category)/i.test(trimmed)) {
            selectedTools.push('create_list', 'get_lists');
          } else {
            selectedTools.push('get_lists', 'create_list', 'delete_list');
          }
          break;

        case 'GOAL_MANAGEMENT':
          selectedModules.push('goalPlanning', 'autonomousAgent');
          selectedContext.push('GOALS', 'TASKS');
          if (/alarm|wake\s+up|in\s+\d+\s+(min|minute|hour)|trigger|follow\s+up/i.test(trimmed)) {
            selectedTools.push('schedule_self_alarm', 'create_ai_agent_goal', 'get_active_ai_goals');
          } else if (/cancel|stop|abort/i.test(trimmed)) {
            selectedTools.push('cancel_ai_agent_goal', 'get_active_ai_goals');
          } else {
            selectedTools.push('create_ai_agent_goal', 'get_active_ai_goals', 'schedule_self_alarm', 'cancel_ai_agent_goal');
          }
          break;

        case 'MEMORY_AND_PREFERENCES':
          selectedModules.push('memory');
          selectedContext.push('RELEVANT_MEMORIES', 'USER_PREFERENCES', 'PERSONAL_INSTRUCTIONS');
          break;

        case 'SCRATCHPAD_INSPECTION':
          selectedModules.push('agentReasoning');
          selectedContext.push('TRANSIENT_SCRATCHPAD', 'TASKS');
          selectedTools.push('read_scratchpad', 'get_tasks');
          break;

        case 'CONVERSATIONAL':
        default:
          if (toolAnswer?.type === 'choice' && toolAnswer.choice && toolAnswer.choice !== 'none' && TOOL_CATALOG[toolAnswer.choice]) {
            selectedTools.push(toolAnswer.choice);
            if (['get_tasks', 'search_tasks'].includes(toolAnswer.choice)) {
              selectedModules.push('taskQuery');
              selectedContext.push('TASKS');
            } else if (['create_task', 'batch_create_tasks'].includes(toolAnswer.choice)) {
              selectedModules.push('taskCreation');
              selectedContext.push('TASKS', 'TASK_LISTS');
            } else if (['update_task', 'complete_task', 'bulk_update_tasks', 'snooze_task'].includes(toolAnswer.choice)) {
              selectedModules.push('taskMutation');
              selectedContext.push('TASKS');
            } else if (['get_lists', 'create_list', 'delete_list'].includes(toolAnswer.choice)) {
              selectedModules.push('lists');
              selectedContext.push('TASK_LISTS');
            } else if (['schedule_self_alarm', 'create_ai_agent_goal', 'get_active_ai_goals'].includes(toolAnswer.choice)) {
              selectedModules.push('goalPlanning', 'autonomousAgent');
              selectedContext.push('GOALS', 'TASKS');
            } else if (toolAnswer.choice === 'read_scratchpad') {
              selectedModules.push('agentReasoning');
              selectedContext.push('TRANSIENT_SCRATCHPAD');
            }
          }
          break;
      }

      // 2. Self-invoking alarm detection
      const alarmPTrue = alarmAnswer?.type === 'noul' ? alarmAnswer.noul : 0;
      if (alarmPTrue >= 0.25 || /alarm|wake(\s+me)?\s+up|self\s+alarm|in\s+\d+\s+(min|minute|hour)|trigger\s+in/i.test(trimmed)) {
        if (!selectedTools.includes('schedule_self_alarm')) selectedTools.unshift('schedule_self_alarm');
        if (!selectedModules.includes('autonomousAgent')) selectedModules.push('autonomousAgent');
        if (!selectedModules.includes('goalPlanning')) selectedModules.push('goalPlanning');
        if (!selectedContext.includes('GOALS')) selectedContext.push('GOALS');
      }

      // 3. Transient Scratchpad Awareness:
      // If session currently has stored scratchpad data, include it so the LLM remembers prior tool calls
      const activeScratch = transientScratchpadService.getScratchpadSummary(sessionId) || transientScratchpad.peek();
      if (activeScratch && activeScratch.trim().length > 0) {
        if (!selectedContext.includes('TRANSIENT_SCRATCHPAD')) selectedContext.push('TRANSIENT_SCRATCHPAD');
        if (!selectedTools.includes('read_scratchpad')) selectedTools.push('read_scratchpad');
        if (!selectedModules.includes('agentReasoning')) selectedModules.push('agentReasoning');
      }

      // 4. Semantic Memory & Routine Detection (Triggers short-term, medium-term, long-term & vector search in ContextSelector)
      const memoryPTrue = memoryAnswer?.type === 'noul' ? memoryAnswer.noul : 0;
      const mentionsMemoryKeywords = /prefer|preference|habit|routine|constraint|remember|never|always|like to|dislike|exam|focus|weekly|bed\s*time|sleep|wake\s*up|schedule|timing|work\s*hours/i.test(trimmed);
      const isRoutineOrBedtimeInquiry = /(bed\s*time|sleep|wake\s*up|daily\s*routine|my\s+routine|my\s+schedule|usual\s+time|routine)/i.test(trimmed);

      if (memoryPTrue >= 0.20 || mentionsMemoryKeywords || isRoutineOrBedtimeInquiry || commandType === 'SCHEDULE_PLANNING' || commandType === 'MEMORY_AND_PREFERENCES') {
        if (!selectedContext.includes('RELEVANT_MEMORIES')) selectedContext.push('RELEVANT_MEMORIES');
        if (!selectedContext.includes('USER_PREFERENCES')) selectedContext.push('USER_PREFERENCES');
        if (!selectedContext.includes('PERSONAL_INSTRUCTIONS')) selectedContext.push('PERSONAL_INSTRUCTIONS');
        if (!selectedModules.includes('memory')) selectedModules.push('memory');
      }

      // 5. Specific Tool Granularity: append specific tool choice if valid and not already added
      if (toolAnswer?.type === 'choice' && toolAnswer.choice && toolAnswer.choice !== 'none' && TOOL_CATALOG[toolAnswer.choice]) {
        if (!selectedTools.includes(toolAnswer.choice)) {
          selectedTools.push(toolAnswer.choice);
        }
      }

      // 6. Conversation History Detection
      const historyPTrue = historyAnswer?.type === 'noul' ? historyAnswer.noul : 0;
      const mentionsPronounFollowup = /\b(that|this|it|those|these|previous|earlier|before|again|like I said)\b/i.test(trimmed);
      if ((historyPTrue >= 0.25 || mentionsPronounFollowup) && !selectedContext.includes('CHAT_HISTORY')) {
        selectedContext.push('CHAT_HISTORY');
      }

      // 7. Calendar Context Detection
      const calendarPTrue = calendarAnswer?.type === 'noul' ? calendarAnswer.noul : 0;
      if ((calendarPTrue >= 0.35 || /calendar|meeting|appointment|google calendar/i.test(trimmed)) && !selectedContext.includes('CALENDAR')) {
        selectedContext.push('CALENDAR');
      }

      // 8. User Instructions Detection
      if (/system instructions|personal instructions|how you should behave|my rules|routine|bed\s*time|sleep/i.test(trimmed)) {
        if (!selectedContext.includes('PERSONAL_INSTRUCTIONS')) selectedContext.push('PERSONAL_INSTRUCTIONS');
      }

      // 9. Route Type & Reasoning Level Determination
      const route: RouteType =
        commandType === 'SCHEDULE_PLANNING' || selectedTools.length > 1
          ? 'AGENT'
          : selectedTools.length === 1
          ? 'SINGLE_TOOL'
          : 'SIMPLE_LLM';

      const reasoningLevel: ReasoningLevel =
        route === 'AGENT'
          ? 'HIGH'
          : route === 'SINGLE_TOOL'
          ? 'LOW'
          : 'NONE';

      // Deduplicate arrays
      const uniqueTools = Array.from(new Set(selectedTools));
      const uniqueModules = Array.from(new Set(selectedModules));
      const uniqueContext = Array.from(new Set(selectedContext));

      const decisionResult: LayaRoutingResult = {
        route,
        operation: uniqueTools[0],
        confidence: Math.round(commandConfidence * 100) / 100,
        reasoningLevel,
        promptModules: uniqueModules,
        tools: uniqueTools,
        context: uniqueContext,
        history: uniqueContext.includes('CHAT_HISTORY'),
        memory: uniqueContext.includes('RELEVANT_MEMORIES') || uniqueContext.includes('MEMORY'),
        requiresClarification: false,
        reason: `Laya semantic decision: Command=${commandType} (${Math.round(commandConfidence * 100)}%), Tools=[${uniqueTools.join(', ') || 'none'}]`,
        parameters: {},
      };

      console.log(
        `[LayaRouter] ⚡ Laya Decision: Route=${decisionResult.route} | Command=${commandType} | Tools=[${uniqueTools.join(', ')}] | Modules=[${uniqueModules.join(', ')}] | Context=[${uniqueContext.join(', ')}] | Confidence=${decisionResult.confidence}`
      );

      return decisionResult;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[LayaRouter Diagnostics] Model/Endpoint error, using fallback: ${errMsg}`);
      return this.getFallbackDecision(errMsg);
    }
  }

  private getFallbackDecision(reason: string): LayaRoutingResult {
    return {
      route: 'SIMPLE_LLM',
      confidence: 0.5,
      reasoningLevel: 'LOW',
      promptModules: ['base'],
      tools: [],
      context: ['CURRENT_TIME'],
      history: false,
      memory: false,
      requiresClarification: false,
      reason: `Minimal safe default fallback route (${reason})`,
      parameters: {},
    };
  }
}

export const layaRouter = new LayaRouter();
