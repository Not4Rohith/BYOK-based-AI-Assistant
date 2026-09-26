import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { AIProviderConfig, ChatMessage } from '@ai-task-manager/shared-types';
import { TaskService } from '../services/task.service.js';
import { createLangChainTools } from './langchain.tools.js';

export class LangGraphAgentEngine {
  public async processMessage(
    userPrompt: string,
    chatHistory: ChatMessage[],
    config: AIProviderConfig,
    taskService?: TaskService,
    localTime?: string
  ): Promise<{ responseText: string; toolCallsExecuted: any[]; metadata?: Record<string, any> }> {
    const openrouterKey = (config.openrouter?.apiKey || '').trim();
    if (!openrouterKey) {
      throw new Error('OpenRouter API key is missing. Please configure your key in Settings.');
    }

    const candidateModels = [
      config.openrouter?.defaultModel,
      ...(config.openrouter?.fallbackModels || []),
    ].filter((m, i, arr) => m && arr.indexOf(m) === i) as string[];

    if (candidateModels.length === 0) {
      candidateModels.push('openai/gpt-4o-mini');
    }

    const tools = createLangChainTools(taskService);
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

    const basePrompt = config.systemPrompt || 'You are an intelligent, autonomous Personal AI Task Assistant.';
    const systemPromptText = `${basePrompt}

Current Time: ${timeContext}

=== USER PREFERENCES & SCHEDULE CONTEXT (w2) ===
${config.dailySchedule || 'No fixed schedule defined.'}

=== INSTRUCTIONS & TOOL GUIDELINES (w3) ===
- You are connected to live database tools:
  - Task Operations: get_tasks, create_task, batch_create_tasks, update_task, bulk_update_tasks, complete_task, delete_task, delete_all_tasks, search_tasks, snooze_task, get_today_agenda, create_subtask, delete_subtask.
  - Category Operations: get_lists, create_list, delete_list, delete_all_lists.
  - Autonomous & Replanning: replan_day, create_ai_agent_goal, get_active_ai_goals, cancel_ai_agent_goal.
- Focus primarily on executing tools for the immediate user request (w3) while adhering to user preferences (w2).
- Treat previous chat history (w1) as low-weight background context only; prior assistant turns must not restrict tool execution for new user requests.`;

    let finalResponseText = '';
    const executedToolLogs: any[] = [];
    let lastError: any = null;

    // Try candidate models in order (Fallback chain handling with dynamic token recovery)
    for (const rawModelName of candidateModels) {
      const modelName = rawModelName.replace(/^~/, '').trim();
      if (!modelName) continue;

      // Try tokens limit candidate tiers (1000 -> 300 -> 150) to recover from OpenRouter 402 max_tokens credit limits
      const maxTokenTiers = [1000, 300, 150];

      for (const currentMaxTokens of maxTokenTiers) {
        try {
          console.log(`[LangGraphAgentEngine] Trying candidate model "${modelName}" (maxTokens=${currentMaxTokens})...`);

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
          });

          const modelWithTools = llm.bindTools(tools);

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
              const response = await modelWithTools.invoke(state.messages);
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

          finalResponseText = responseTextCandidate || 'Completed your request.';

          // Aggregate token usage across turns
          let promptTokens = 0;
          let completionTokens = 0;
          let totalTokens = 0;

          for (const msg of finalState.messages) {
            const aiMsg = msg as any;
            if (aiMsg.usage_metadata) {
              promptTokens += aiMsg.usage_metadata.input_tokens || 0;
              completionTokens += aiMsg.usage_metadata.output_tokens || 0;
              totalTokens += aiMsg.usage_metadata.total_tokens || 0;
            }

            const resMeta = aiMsg.response_metadata || {};
            const tu = resMeta.tokenUsage || resMeta.usage || resMeta.token_usage;
            if (tu && !aiMsg.usage_metadata) {
              const p = tu.promptTokens || tu.prompt_tokens || tu.input_tokens || 0;
              const c = tu.completionTokens || tu.completion_tokens || tu.output_tokens || 0;
              const t = tu.totalTokens || tu.total_tokens || (p + c);
              promptTokens += p;
              completionTokens += c;
              totalTokens += t;
            }
          }

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

          console.log(`[LangGraphAgentEngine] LangGraph completed successfully with model: ${modelName} (tokens: ${totalTokens})`);
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
          console.warn(`[LangGraphAgentEngine] Model "${modelName}" (maxTokens=${currentMaxTokens}) failed in graph execution:`, errMsg);

          // If the error is NOT related to 402 or max_tokens/credits, break token tier loop to try NEXT candidate model!
          if (!errMsg.includes('402') && !errMsg.includes('max_tokens') && !errMsg.includes('credits')) {
            break;
          }
        }
      }
    }

    throw new Error(`LangGraph execution failed across all configured models: ${lastError?.message || lastError}`);
  }
}

export const langGraphAgentEngine = new LangGraphAgentEngine();
