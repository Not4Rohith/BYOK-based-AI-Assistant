import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { AIProviderConfig, ChatMessage } from '@ai-task-manager/shared-types';
import { TaskService } from '../services/task.service.js';
import { createLangChainTools } from './langchain.tools.js';
import { toolSelector } from './tools/selector.js';
import { composeSystemPrompt } from './prompts/composer.js';
import { PromptModuleKey, ContextCategory } from './router/routing.types.js';

export class LangGraphAgentEngine {
  public async processMessage(
    userPrompt: string,
    chatHistory: ChatMessage[],
    config: AIProviderConfig,
    taskService?: TaskService,
    localTime?: string,
    selectedTools?: string[],
    selectedPromptModules?: PromptModuleKey[],
    selectedContext?: ContextCategory[]
  ): Promise<{ responseText: string; toolCallsExecuted: any[]; metadata?: Record<string, any> }> {
    const openrouterKey = (config.openrouter?.apiKey || '').trim();
    if (!openrouterKey) {
      throw new Error('OpenRouter API key is missing. Please configure your key in Settings.');
    }

    const candidateModels = [
      config.openrouter?.defaultModel,
      ...(config.openrouter?.fallbackModels || []),
    ]
      .filter((m): m is string => Boolean(m && typeof m === 'string'))
      .map((m) => m.replace(/^~/, '').trim())
      .filter((m, i, arr) => m.length > 0 && arr.indexOf(m) === i);

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

    // Compose system prompt dynamically using ONLY Laya-selected prompt modules
    const modulesToUse: PromptModuleKey[] = selectedPromptModules && selectedPromptModules.length > 0
      ? selectedPromptModules
      : ['base', 'taskQuery', 'agentReasoning'];

    const systemPromptText = composeSystemPrompt(modulesToUse, {
      systemPrompt: config.systemPrompt,
      dailySchedule: config.dailySchedule,
      timeContext,
    });

    const isSimpleGreeting = (selectedTools !== undefined && selectedTools.length === 0) || /^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you)[\s!?.]*$/i.test(userPrompt.trim());

    let finalResponseText = '';
    const executedToolLogs: any[] = [];
    let lastError: any = null;

    // Try candidate models in order (Fallback chain handling with dynamic token recovery)
    for (let candidateIdx = 0; candidateIdx < candidateModels.length; candidateIdx++) {
      const modelName = candidateModels[candidateIdx];
      console.log(`[LangGraphAgentEngine] 🤖 Candidate Model [${candidateIdx + 1}/${candidateModels.length}]: "${modelName}"`);

      // Generous max token limit tiers (4096 -> 2048 -> 1024) to ensure responses never get truncated
      const maxTokenTiers = [4096, 2048, 1024];

      for (let tierIdx = 0; tierIdx < maxTokenTiers.length; tierIdx++) {
        const currentMaxTokens = maxTokenTiers[tierIdx];
        try {
          console.log(`[LangGraphAgentEngine] Executing graph with model "${modelName}" (maxTokens=${currentMaxTokens}, isGreeting=${isSimpleGreeting}, toolCount=${tools.length})...`);

          const llm = new ChatOpenAI({
            model: modelName,
            modelName: modelName,
            apiKey: openrouterKey,
            openAIApiKey: openrouterKey,
            configuration: {
              apiKey: openrouterKey,
              baseURL: 'https://openrouter.ai/api/v1',
              defaultHeaders: {
                'HTTP-Referer': 'https://aitaskmanager.app',
                'X-Title': 'Personal AI Task Manager',
              },
            },
            temperature: 0.7,
            maxTokens: currentMaxTokens,
            maxCompletionTokens: currentMaxTokens,
            modelKwargs: {
              max_tokens: currentMaxTokens,
              max_completion_tokens: currentMaxTokens,
            },
          });

          // For simple greetings or 0 tools, bypass heavy tool schema binding to save ~2,500 prompt tokens
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

          // Previous chat history (w1) - Low weightage (max 1 prior user prompt as context snippet)
          const recentUserHistory = chatHistory.filter((m) => m.role === 'user').slice(-1);
          const historyMessages: BaseMessage[] = recentUserHistory.map(
            (m) => new HumanMessage(`[Background Prior Context (Low Weightage w1)]: ${m.content}`)
          );

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

          finalResponseText = responseTextCandidate || 'Request unsucessful';

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

          console.log(`[LangGraphAgentEngine] ✅ LangGraph completed successfully with model: "${modelName}" (tokens: ${totalTokens})`);
          return {
            responseText: finalResponseText,
            toolCallsExecuted: executedToolLogs,
            metadata: {
              model: modelName,
              provider: 'openrouter',
              tokenUsage,
            },
          };
        } catch (err) {
          lastError = err;
          const errMsg = (err as Error).message || String(err);
          console.warn(`[LangGraphAgentEngine] ❌ Model "${modelName}" (maxTokens=${currentMaxTokens}) failed in graph execution: ${errMsg}`);

          // Parse OpenRouter error for specific max affordable tokens
          const affordMatch = errMsg.match(/can\s+only\s+afford\s+(\d+)/i);
          if (affordMatch && affordMatch[1]) {
            const maxAfford = Math.floor(parseInt(affordMatch[1], 10) * 0.9);
            if (maxAfford > 30 && maxAfford < currentMaxTokens) {
              console.info(`[LangGraphAgentEngine] ⚡ TOKEN RECOVERY: OpenRouter specified max affordable tokens = ${maxAfford}. Inserting into retry queue...`);
              if (!maxTokenTiers.slice(tierIdx + 1).includes(maxAfford)) {
                maxTokenTiers.splice(tierIdx + 1, 0, maxAfford);
              }
            }
          }

          // If the error is NOT related to 402 or max_tokens/credits, break token tier loop to try NEXT candidate model!
          if (!errMsg.includes('402') && !errMsg.includes('max_tokens') && !errMsg.includes('credits')) {
            break;
          }
        }
      }

      if (candidateIdx < candidateModels.length - 1) {
        const nextModelName = candidateModels[candidateIdx + 1];
        console.warn(`[LangGraphAgentEngine] 🔄 FALLBACK TRIGGERED: Candidate model "${modelName}" failed across all token tiers. Falling back to next candidate model "${nextModelName}"...`);
      }
    }

    console.error(`[LangGraphAgentEngine] 🚨 ALL candidate models failed (${candidateModels.length} models tested). Last error: ${lastError?.message || lastError}`);
    throw new Error(`LangGraph execution failed across all configured models: ${lastError?.message || lastError}`);
  }
}

export const langGraphAgentEngine = new LangGraphAgentEngine();
