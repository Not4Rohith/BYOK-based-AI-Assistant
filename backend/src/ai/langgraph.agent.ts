import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { AIProviderConfig, ChatMessage } from '@ai-task-manager/shared-types';
import { TaskService } from '../services/task.service.js';
import { MemoryService } from '../services/memory.service.js';
import { GoalService } from '../services/goal.service.js';
import { createLangChainTools } from './langchain.tools.js';
import { toolSelector } from './tools/selector.js';
import { contextSelector } from './context/selector.js';
import { actionValidator } from './actions/validator.js';
import { composeSystemPrompt, composeSystemPromptAsync } from './prompts/composer.js';
import { PromptModuleKey, ContextCategory } from './router/routing.types.js';

export interface CandidateModelSpec {
  model: string;
  provider: 'openrouter' | 'grok' | 'gemini';
  apiKey: string;
  baseURL: string;
}

function buildCandidateSpecs(config: AIProviderConfig): CandidateModelSpec[] {
  const openrouterKey = (config.openrouter?.apiKey || '').trim();
  const grokKey = (config.grok?.apiKey || '').trim();
  const geminiKey = (config.gemini?.apiKey || '').trim();

  if (!openrouterKey && !grokKey && !geminiKey) {
    throw new Error('No AI provider API keys configured. Please configure an API key for OpenRouter, Grok, or Gemini in Settings.');
  }

  const activeProv = (config.activeProvider as 'openrouter' | 'gemini' | 'grok') || (geminiKey ? 'gemini' : openrouterKey ? 'openrouter' : 'grok');
  const allProviders: ('openrouter' | 'gemini' | 'grok')[] = ['gemini', 'openrouter', 'grok'];
  const providerOrder: ('openrouter' | 'gemini' | 'grok')[] = [
    activeProv,
    ...allProviders.filter((p) => p !== activeProv),
  ];
  const rawCandidates: { providerHint: 'openrouter' | 'grok' | 'gemini'; rawModel: string }[] = [];

  for (const prov of providerOrder) {
    const provConfig = config[prov];
    const key = prov === 'openrouter' ? openrouterKey : prov === 'gemini' ? geminiKey : grokKey;
    const isEnabled = provConfig?.enabled !== false;

    if (isEnabled && (key || openrouterKey)) {
      if (provConfig?.defaultModel) {
        rawCandidates.push({ providerHint: prov, rawModel: provConfig.defaultModel });
      }
      if (Array.isArray(provConfig?.fallbackModels)) {
        provConfig.fallbackModels.forEach((m) => {
          if (m) rawCandidates.push({ providerHint: prov, rawModel: m });
        });
      }
    }
  }

  const specs: CandidateModelSpec[] = [];

  for (const item of rawCandidates) {
    const cleanModel = item.rawModel.replace(/^~/, '').trim();
    if (!cleanModel) continue;

    const isGrokModel = item.providerHint === 'grok' || cleanModel.toLowerCase().includes('grok') || cleanModel.toLowerCase().startsWith('x-ai/');
    const isGeminiModel = item.providerHint === 'gemini' || cleanModel.toLowerCase().includes('gemini') || cleanModel.toLowerCase().startsWith('google/');

    if (isGrokModel) {
      if (grokKey) {
        const nativeModel = cleanModel.startsWith('x-ai/') ? cleanModel.replace(/^x-ai\//, '') : cleanModel;
        specs.push({
          model: nativeModel,
          provider: 'grok',
          apiKey: grokKey,
          baseURL: 'https://api.x.ai/v1',
        });
      } else if (openrouterKey) {
        const openrouterGrokModel = cleanModel.startsWith('x-ai/') ? cleanModel : (cleanModel.includes('/') ? cleanModel : `x-ai/${cleanModel}`);
        specs.push({
          model: openrouterGrokModel,
          provider: 'openrouter',
          apiKey: openrouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
        });
      }
    } else if (isGeminiModel) {
      if (geminiKey) {
        const directModel = cleanModel.startsWith('google/') ? cleanModel.replace(/^google\//, '') : cleanModel;
        specs.push({
          model: directModel,
          provider: 'gemini',
          apiKey: geminiKey,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        });
      } else if (openrouterKey) {
        const openrouterGeminiModel = cleanModel.startsWith('google/') ? cleanModel : (cleanModel.includes('/') ? cleanModel : `google/${cleanModel}`);
        specs.push({
          model: openrouterGeminiModel,
          provider: 'openrouter',
          apiKey: openrouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
        });
      }
    } else {
      if (openrouterKey) {
        specs.push({
          model: cleanModel,
          provider: 'openrouter',
          apiKey: openrouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
        });
      }
    }
  }

  // Deduplicate by model + baseURL
  const uniqueSpecs: CandidateModelSpec[] = [];
  for (const s of specs) {
    if (!uniqueSpecs.some((u) => u.model === s.model && u.baseURL === s.baseURL)) {
      uniqueSpecs.push(s);
    }
  }

  // If still empty (e.g. no models configured), provide sensible defaults based on available keys
  if (uniqueSpecs.length === 0) {
    if (grokKey) {
      uniqueSpecs.push({
        model: 'grok-2-latest',
        provider: 'grok',
        apiKey: grokKey,
        baseURL: 'https://api.x.ai/v1',
      });
    }
    if (openrouterKey) {
      uniqueSpecs.push({
        model: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
    if (geminiKey) {
      uniqueSpecs.push({
        model: 'gemini-2.0-flash',
        provider: 'gemini',
        apiKey: geminiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    }
  }

  return uniqueSpecs;
}

export class LangGraphAgentEngine {
  public async processMessage(
    userPrompt: string,
    chatHistory: ChatMessage[],
    config: AIProviderConfig,
    taskService?: TaskService,
    memoryService?: MemoryService,
    goalService?: GoalService,
    localTime?: string,
    selectedTools?: string[],
    selectedPromptModules?: PromptModuleKey[],
    selectedContext?: ContextCategory[],
    userId?: string
  ): Promise<{ responseText: string; toolCallsExecuted: any[]; metadata?: Record<string, any> }> {
    const candidateSpecs = buildCandidateSpecs(config);

    // Filter tools to ONLY those selected by Laya router
    const tools = selectedTools !== undefined
      ? toolSelector.selectTools(selectedTools, taskService)
      : createLangChainTools(taskService);
    const toolNode = new ToolNode(tools);

    const timeContext = localTime
      ? localTime
      : new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
        timeZoneName: 'short',
      });

    // Load structured context payload selected by Laya Router
    const contextPayload = await contextSelector.loadContext(selectedContext || ['TASKS'], {
      userId,
      taskService,
      memoryService,
      goalService,
      dailySchedule: config.dailySchedule,
      chatHistory,
      localTime,
      userPrompt,
      sessionId: (config as any)?.sessionId || 'default',
    });
    console.log(
      '[Planning Debug] USER_PREFERENCES:',
      JSON.stringify(contextPayload.userPreferences, null, 2)
    );

    let contextSection = '';
    if (contextPayload.currentTime) {
      contextSection += `\n=== CURRENT TIME CONTEXT ===\n${contextPayload.currentTime}\n`;
    }
    if (contextPayload.personalInstructions) {
      contextSection += `\n=== PERSONAL AI INSTRUCTIONS ===\n${contextPayload.personalInstructions}\n`;
    }
    if (contextPayload.userPreferences) {
      contextSection += `\n=== USER PLANNING PREFERENCES & ROUTINES ===\n${JSON.stringify(contextPayload.userPreferences, null, 2)}\n`;
      const routineText = (contextPayload.userPreferences as any).dailySchedule || config.dailySchedule;
      if (routineText && routineText.trim()) {
        contextSection += `\n=== USER DAILY ROUTINE & COMMITTED TIMES (FROM SETTINGS) ===\n${routineText}\n`;
      }
    } else if (config.dailySchedule && /(bed\s*time|sleep|wake|routine|schedule|habit)/i.test(userPrompt)) {
      contextSection += `\n=== USER DAILY ROUTINE & COMMITTED TIMES (FROM SETTINGS) ===\n${config.dailySchedule}\n`;
    }
    if (contextPayload.scratchpad) {
      contextSection += `\n=== TRANSIENT SCRATCHPAD (MULTI-STEP SESSION MEMORY) ===\n${contextPayload.scratchpad}\n`;
    }
    if (contextPayload.longTermMemories && contextPayload.longTermMemories.length > 0) {
      contextSection += `\n=== USER MEMORIES (LONG-TERM PREFERENCES & CONSTRAINTS) ===\n${contextPayload.longTermMemories.map((m) => `- ${m.content}`).join('\n')}\n`;
    }
    if (contextPayload.mediumTermMemories && contextPayload.mediumTermMemories.length > 0) {
      contextSection += `\n=== USER MEMORIES (MEDIUM-TERM WEEKLY FOCUS & DEADLINES) ===\n${contextPayload.mediumTermMemories.map((m) => `- ${m.content}${m.validUntil ? ` (Valid until: ${m.validUntil})` : ''}`).join('\n')}\n`;
    }
    if (contextPayload.shortTermMemories && contextPayload.shortTermMemories.length > 0) {
      contextSection += `\n=== USER MEMORIES (SHORT-TERM RECENT CONTEXT & INSIGHTS) ===\n${contextPayload.shortTermMemories.map((m) => `- ${m.content}`).join('\n')}\n`;
    }
    if (contextPayload.relevantMemories && contextPayload.relevantMemories.length > 0) {
      contextSection += `\n=== SEMANTICALLY RELEVANT USER MEMORIES ===\n${contextPayload.relevantMemories.map((m) => `- ${m.content}`).join('\n')}\n`;
    }
    if (contextPayload.goals && contextPayload.goals.length > 0) {
      contextSection += `\n=== USER ACTIVE GOALS ===\n${contextPayload.goals.map((g) => `- Goal "${g.title}" (Priority: ${g.priority}, Target Date: ${g.targetDate || 'None'}, Progress: ${g.progress}%). Description: ${g.description || ''}`).join('\n')}\n`;
    }
    if (contextPayload.tasks && contextPayload.tasks.length > 0) {
      contextSection += `\n=== USER ACTIVE TASKS ===\n${contextPayload.tasks.map((t) => `- Task ID: ${t._id} | Title: "${t.title}" | Priority: ${t.priority} | Scheduled: ${t.scheduledStart || 'Unscheduled'} | Due: ${t.dueAt || 'None'}`).join('\n')}\n`;
    }
    if (contextPayload.agenda && contextPayload.agenda.length > 0) {
      contextSection += `\n=== TODAY AGENDA ===\n${contextPayload.agenda.map((a) => `- ${a.title} (${a.scheduledStart || 'un-timed'})`).join('\n')}\n`;
    }

    // Compose system prompt dynamically using ONLY Laya-selected prompt modules and dynamic chunking
    const modulesToUse: PromptModuleKey[] = selectedPromptModules && selectedPromptModules.length > 0
      ? selectedPromptModules
      : ['base', 'taskQuery', 'agentReasoning'];

    let systemPromptText = await composeSystemPromptAsync(modulesToUse, {
      systemPrompt: config.systemPrompt,
      dailySchedule: config.dailySchedule,
      timeContext,
      userQuery: userPrompt,
    });

    if (contextSection) {
      systemPromptText += `\n\n${contextSection}`;
    }

    const includeChatHistory = Boolean(selectedContext && selectedContext.includes('CHAT_HISTORY'));
    if (includeChatHistory) {
      systemPromptText += `\n\n[NOTE: Previous conversation messages are provided for reference. The current user prompt and current system context take full precedence over past assistant outputs.]`;
    }

    console.log(`[LangGraphAgentEngine] 📊 Pipeline Diagnostic State:
  - Selected Modules: [${modulesToUse.join(', ')}]
  - Selected Context: [${(selectedContext || []).join(', ')}]
  - Selected Tools: [${(selectedTools || []).join(', ')}]
  - CHAT_HISTORY Included: ${includeChatHistory}
  - System Prompt Length: ${systemPromptText.length} chars (~${Math.ceil(systemPromptText.length / 4)} tokens)`);

    const isSimpleGreeting = /^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you)[\s!?.]*$/i.test(userPrompt.trim());

    let finalResponseText = '';
    const executedToolLogs: any[] = [];
    let lastError: any = null;

    // Try candidate model specs in order (Fallback chain handling with dynamic token recovery)
    for (let candidateIdx = 0; candidateIdx < candidateSpecs.length; candidateIdx++) {
      const spec = candidateSpecs[candidateIdx];
      console.log(`[LangGraphAgentEngine] 🤖 Candidate Model [${candidateIdx + 1}/${candidateSpecs.length}]: "${spec.model}" (provider: ${spec.provider}, baseURL: ${spec.baseURL})`);

      // Generous max token limit tiers (4096 -> 2048 -> 1024) to ensure responses never get truncated
      const maxTokenTiers = [4096, 2048, 1024];

      for (let tierIdx = 0; tierIdx < maxTokenTiers.length; tierIdx++) {
        const currentMaxTokens = maxTokenTiers[tierIdx];
        try {
          console.log(`[LangGraphAgentEngine] Executing graph with model "${spec.model}" (maxTokens=${currentMaxTokens}, isGreeting=${isSimpleGreeting}, toolCount=${tools.length})...`);

          const llm = new ChatOpenAI({
            model: spec.model,
            modelName: spec.model,
            apiKey: spec.apiKey,
            openAIApiKey: spec.apiKey,
            configuration: {
              apiKey: spec.apiKey,
              baseURL: spec.baseURL,
              defaultHeaders: spec.provider === 'openrouter' ? {
                'HTTP-Referer': 'https://aitaskmanager.app',
                'X-Title': 'Personal AI Task Manager',
              } : undefined,
            },
            temperature: 0.7,
            maxTokens: currentMaxTokens,
            maxCompletionTokens: currentMaxTokens,
            modelKwargs: {
              max_tokens: currentMaxTokens,
              max_completion_tokens: currentMaxTokens,
            },
          });

          // Always bind tools to the model unless it's a pure greeting, ensuring full tool access in all chat modes
          const activeModel = (isSimpleGreeting || tools.length === 0) ? llm : llm.bindTools(tools);

          // Custom router preventing infinite duplicate tool loops
          const smartToolsCondition = (state: typeof MessagesAnnotation.State) => {
            const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
            if (!lastMsg?.tool_calls || lastMsg.tool_calls.length === 0) {
              return END;
            }

            // If loop is getting long (>10 messages in graph), stop tool loop and answer
            if (state.messages.length > 10) {
              console.warn('[LangGraphAgentEngine] Max tool turns reached for request, terminating loop cleanly.');
              return END;
            }

            return 'tools';
          };

          // Build LangGraph State Graph
          const workflow = new StateGraph(MessagesAnnotation)
            .addNode('agent', async (state) => {
              const response = await activeModel.invoke(state.messages);
              return { messages: [response] };
            })
            .addNode('tools', async (state) => {
              // Track executed tool calls for chat storage / UI rendering
              const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
              if (lastMsg?.tool_calls) {
                for (const tc of lastMsg.tool_calls) {
                  executedToolLogs.push({
                    tool: tc.name,
                    args: tc.args,
                    status: 'success',
                  });
                }
              }
              return toolNode.invoke(state);
            })
            .addEdge(START, 'agent')
            .addConditionalEdges('agent', smartToolsCondition, {
              tools: 'tools',
              [END]: END,
            })
            .addEdge('tools', 'agent');

          const app = workflow.compile();

          // Previous chat history: ONLY include if explicitly selected by Laya Router
          const historyMessages: BaseMessage[] = includeChatHistory
            ? chatHistory.slice(-4).map((m) => (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)))
            : [];

          const initialMessages: BaseMessage[] = [
            new SystemMessage(systemPromptText),
            ...historyMessages,
            new HumanMessage(userPrompt),
          ];

          // Execute graph with increased recursion limit to allow multi-step workflows
          const finalState = await app.invoke(
            { messages: initialMessages },
            { recursionLimit: 25 }
          );

          let responseTextCandidate = '';
          for (let i = finalState.messages.length - 1; i >= 0; i--) {
            const msg = finalState.messages[i];
            if (msg._getType() === 'ai' && typeof msg.content === 'string' && msg.content.trim().length > 0) {
              responseTextCandidate = msg.content.trim();
              break;
            }
          }

          // Dynamically invoke LLM to generate a real, natural language response if no text was generated
          if (!responseTextCandidate) {
            try {
              console.log('[LangGraphAgentEngine] Invoking LLM for dynamic AI natural language synthesis...');
              const synthPrompt: BaseMessage[] = [
                ...finalState.messages,
                new HumanMessage('Provide a clear, brief, natural language response summarizing the action taken for the user based on the tool results above.'),
              ];
              const synthRes = await llm.invoke(synthPrompt);
              const synthContent = typeof synthRes.content === 'string' ? synthRes.content : JSON.stringify(synthRes.content);
              if (synthContent && synthContent.trim().length > 0) {
                responseTextCandidate = synthContent.trim();
              }
            } catch (synthErr) {
              console.warn('[LangGraphAgentEngine] Dynamic AI synthesis failed:', synthErr);
            }
          }

          finalResponseText = responseTextCandidate || 'Request unsuccessful';

          // Process and validate any structured AI actions (schedule_task, create_task, etc.)
          if (finalResponseText && finalResponseText.includes('{')) {
            const valResult = await actionValidator.processAndExecute(finalResponseText, {
              taskService,
              goalService,
            });
            finalResponseText = valResult.responseText;
            for (const act of valResult.executedActions) {
              executedToolLogs.push({ tool: act.tool, args: act.args, status: 'success' });
            }
          }

          // Aggregate token usage cleanly (take max input_tokens per turn to avoid double counting cumulative metrics)
          let promptTokens = 0;
          let completionTokens = 0;

          for (const msg of finalState.messages) {
            const aiMsg = msg as any;
            if (aiMsg._getType && aiMsg._getType() === 'ai') {
              const usage = aiMsg.usage_metadata || aiMsg.response_metadata?.tokenUsage || aiMsg.response_metadata?.usage;
              if (usage) {
                const p = usage.input_tokens || usage.prompt_tokens || usage.promptTokens || 0;
                const c = usage.output_tokens || usage.completion_tokens || usage.completionTokens || 0;
                if (p > promptTokens) promptTokens = p;
                completionTokens += c;
              }
            }
          }

          let totalTokens = promptTokens + completionTokens;

          // Fallback estimate if model provider omitted token usage headers
          if (totalTokens === 0) {
            const promptLength = initialMessages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0);
            const completionLength = finalResponseText.length;
            promptTokens = Math.ceil(promptLength / 4);
            completionTokens = Math.ceil(completionLength / 4);
            totalTokens = promptTokens + completionTokens;
          }

          const tokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
          };

          console.log(`[LangGraphAgentEngine] ✅ LangGraph completed successfully with model: "${spec.model}" (${spec.provider}, tokens: ${totalTokens})`);
          return {
            responseText: finalResponseText,
            toolCallsExecuted: executedToolLogs,
            metadata: {
              model: spec.model,
              provider: spec.provider,
              tokenUsage,
            },
          };
        } catch (err) {
          lastError = err;
          const errMsg = (err as Error).message || String(err);
          console.warn(`[LangGraphAgentEngine] ❌ Model "${spec.model}" (${spec.provider}, maxTokens=${currentMaxTokens}) failed in graph execution: ${errMsg}`);

          // Parse error for specific max affordable tokens
          const affordMatch = errMsg.match(/can\s+only\s+afford\s+(\d+)/i);
          if (affordMatch && affordMatch[1]) {
            const maxAfford = Math.floor(parseInt(affordMatch[1], 10) * 0.9);
            if (maxAfford > 30 && maxAfford < currentMaxTokens) {
              console.info(`[LangGraphAgentEngine] ⚡ TOKEN RECOVERY: Provider specified max affordable tokens = ${maxAfford}. Inserting into retry queue...`);
              if (!maxTokenTiers.slice(tierIdx + 1).includes(maxAfford)) {
                maxTokenTiers.splice(tierIdx + 1, 0, maxAfford);
              }
            }
          }

          // Break token tier loop to try NEXT candidate model in candidateSpecs!
          break;
        }
      }

      if (candidateIdx < candidateSpecs.length - 1) {
        const nextSpec = candidateSpecs[candidateIdx + 1];
        console.warn(`[LangGraphAgentEngine] 🔄 FALLBACK TRIGGERED: Candidate model "${spec.model}" failed across all token tiers. Falling back to next candidate model "${nextSpec.model}" (${nextSpec.provider})...`);
      }
    }

    console.error(`[LangGraphAgentEngine] 🚨 ALL candidate models failed (${candidateSpecs.length} models tested). Last error: ${lastError?.message || lastError}`);
    throw new Error(`LangGraph execution failed across all configured models: ${lastError?.message || lastError}`);
  }
}

export const langGraphAgentEngine = new LangGraphAgentEngine();
