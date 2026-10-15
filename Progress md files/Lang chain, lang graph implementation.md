# LangChain & LangGraph Architectural Refactor Plan

Refactor the AI system architecture from a single-pass string-matching JSON parser to an event-driven **LangGraph StateGraph** with native **LangChain tool binding** and **multi-turn feedback loops**.

## User Review Required

> [!IMPORTANT]
> **New Dependencies Required**: Installing `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, and `@langchain/google-genai` in `backend/package.json`.
>
> **Execution Model Shift**: The AI will now operate as a multi-turn agent loop (`Agent` -> `Tools` -> `Agent` -> `User`). When an action like `get_tasks` is triggered, the AI will execute the DB query, receive the `ToolMessage` result, and synthesize a natural language response in Turn 2.

## Open Questions

> [!NOTE]
> 1. **Model Support for Native Tool Calling**: OpenRouter models (like `openai/gpt-4o-mini`, `anthropic/claude-3.5-haiku`, `meta-llama/llama-3.3-70b-instruct`) support native OpenAI function calling. For fallback models or providers that don't support function calling natively, should we keep a JSON schema fallback wrapper?
> 2. **Max Loop Iterations**: Should we cap the LangGraph execution loop to a maximum of 5 tool-calling turns to prevent accidental infinite loops?

---

## Proposed Changes

### Backend Infrastructure & Dependencies

#### [MODIFY] [package.json](file:///home/rohith/Documents/AI%20Task%20Manager/backend/package.json)
- Add `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `@langchain/google-genai` dependencies.

---

### LangChain Tools Layer

#### [NEW] [langchain.tools.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/langchain.tools.ts)
- Create strongly typed `DynamicStructuredTool` instances using Zod schemas for:
  - `get_tasks`: Fetches pending/completed tasks from `TaskService`.
  - `create_task`: Adds a task with list, priority, duration, and scheduled time.
  - `update_task`: Updates task status, priority, title, or schedule.
  - `delete_task`: Deletes a specific task.
  - `delete_all_tasks`: Bulk clears all tasks.
  - `create_list`: Creates a new category/list.
  - `delete_list`: Deletes a list and its contained tasks.
  - `replan_day`: Invokes `automaticReplanner` to rearrange remaining tasks.
  - `create_ai_agent_goal`: Registers background AI goals.

---

### LangGraph Agent State Machine

#### [NEW] [langgraph.agent.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/langgraph.agent.ts)
- Construct a `StateGraph(MessagesAnnotation)`:
  - `agentNode`: Calls the configured LLM (via OpenRouter/Gemini) bound with the LangChain toolset.
  - `toolsNode`: Prebuilt `ToolNode` executing selected tools dynamically.
  - `shouldContinue`: Conditional edge router (`tools` -> `toolsNode`, `end` -> `END`).

---

### AI Service Integration

#### [MODIFY] [ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Replace static JSON prompt parsing and manual `if/else` execution with invocation of `langgraphAgent.stream()` / `langgraphAgent.invoke()`.
- System prompt reduced to clean identity + current time context (0 upfront task database dumping).
- Save executed `ToolMessage` outputs into MongoDB `chatStorageService` for seamless session history.

---

## Verification Plan

### Automated Tests
- Run `npm run check-types` across monorepo to verify TypeScript compilation.
- Run `npm run build --prefix backend` to ensure bundle compiles cleanly.

### Manual Verification
- Test natural language prompt: `"What tasks do I have pending right now?"` -> Verify LLM calls `get_tasks` tool, receives tool response, and answers in 2nd turn.
- Test task creation: `"Create a task to study physics tomorrow at 4pm"` -> Verify `create_task` tool executes and returns success message.
- Test category creation & replanning: `"Create a category College and replan my day"` -> Verify multi-tool execution in graph.
