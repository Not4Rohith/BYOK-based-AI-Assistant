# Implementation Plan - AI Autonomous Agent Goals, Background Execution Runner & Persistent Task Lists

Implement an autonomous AI Agent System Goal Engine (`AIAgentGoalModel`, `AIAgentRunner`) that allows the AI to manage its own internal system goals (e.g. deleting temporary categories tomorrow morning, sending scheduled check-in reminders), self-invoke at target execution times, silently update the chat window, and update short-term context. In addition, build backend persistence for Task Lists (`TaskListModel`, `TaskListService`) and support `create_list` and `delete_list` AI tools.

## User Review Required

> [!IMPORTANT]
> - **AI Internal Agent Goals vs. User Tasks**: Instructions to the AI to execute future system actions (e.g., *"delete the Goal Now category tomorrow morning"*, *"check upon me at 10 PM"*) will NO LONGER create tasks on the user's task board. Instead, they are stored in a dedicated `AIAgentGoal` database in MongoDB Atlas.
> - **Autonomous Background Execution Runner (`AIAgentRunner`)**: A background service checks for ready AI Agent Goals. When target execution time arrives, it automatically executes the action (e.g., deleting the `"Goal Now"` category and all its tasks), silently appends a log/check-in message to the chat window, and updates short-term context so the AI remembers what it did when the user replies.
> - **Task List Backend Persistence & AI Tools**: Created `TaskListModel` and `TaskListService` so creating categories (e.g. `"Goal Now"`) via `create_list` actually creates the column on the board, and `delete_list` removes the category and its tasks.

## Proposed Changes

---

### Shared Data Types & DB Schemas

#### [MODIFY] [shared-types/src/index.ts](file:///home/rohith/Documents/AI%20Task%20Manager/packages/shared-types/src/index.ts)
- Add `AIAgentGoal` interface:
  - `_id`: string
  - `userId`: string
  - `title`: string
  - `actionType`: `'delete_list_and_tasks' | 'check_in_reminder' | 'custom_system_action'`
  - `targetExecutionTime`: string (ISO timestamp)
  - `payload`: Record<string, any>
  - `status`: `'pending' | 'executed' | 'cancelled'`
  - `executedAt?: string`
  - `lastLogMessage?: string`

#### [NEW] [TaskList.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/TaskList.model.ts)
- Mongoose schema for persistent Task Lists (`_id`, `userId`, `title`, `icon`, `color`, timestamps).

#### [NEW] [AIAgentGoal.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/AIAgentGoal.model.ts)
- Mongoose schema for AI Agent Internal Goals (`_id`, `userId`, `title`, `actionType`, `targetExecutionTime`, `payload`, `status`, `executedAt`, `lastLogMessage`, timestamps).

---

### Backend Services & Background Execution Runner

#### [NEW] [taskList.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/taskList.service.ts)
- Manage Task Lists in MongoDB Atlas with initial seed lists (`Basic Info`, `Skills`, `Career Achievements`, `Other Achievements`, `Possessions`, `Advantages`, `Disadvantages`, `sfsaf`).
- Implement `getAllLists()`, `createList(title)`, and `deleteListAndTasks(listIdOrTitle)`.

#### [NEW] [aiAgentGoal.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/aiAgentGoal.service.ts)
- Implement `createAgentGoal()`, `getPendingGoals(now)`, and `markGoalExecuted()`.

#### [NEW] [aiAgentRunner.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/aiAgentRunner.ts)
- Background execution engine running every 15 seconds.
- Automatically executes due goals:
  - `delete_list_and_tasks`: Deletes target task list and all tasks in that list.
  - `check_in_reminder`: Generates check-in message based on context.
- Appends silent notification message to `ChatStorageService` and updates short-term memory so context is preserved when user responds.

#### [MODIFY] [ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Add `create_list`, `delete_list`, and `create_ai_agent_goal` tool handling.
- Add system prompt instructions clarifying the distinction between User Tasks and AI Internal Agent Goals.

#### [NEW] [taskLists.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/taskLists.router.ts)
- Expose `/api/lists` routes (`GET /api/lists`, `POST /api/lists`, `DELETE /api/lists/:id`).

#### [MODIFY] [server.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/server.ts)
- Register `taskLists.router` and start `aiAgentRunner.startScheduler()`.

---

### Desktop Frontend UI & API Client

#### [MODIFY] [api/client.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/api/client.ts)
- Add `getTaskLists()`, `createTaskList(title)`, and `deleteTaskList(id)`.

#### [MODIFY] [App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/App.tsx)
- Load `taskLists` from `/api/lists` and sync list updates after AI chat turns.

---

## Verification Plan

### Automated Tests
- Run `npm run bundle:desktop` to verify 0 TypeScript compilation errors across monorepo.

### Manual Verification
1. **Category Creation (`Goal Now`)**:
   - Ask AI *"create a new category named Goal Now and add DSA Practice to it"*.
   - Verify `"Goal Now"` appears as a new list column on the board with `"DSA Practice"` inside it.
2. **AI Internal Agent Goal (Self-Task Creation)**:
   - Ask AI *"delete category Goal Now by tomorrow morning at 8 AM"*.
   - Verify the AI does **NOT** add a user task titled `"Delete Goal Now Category"` to the board.
   - Verify an `AIAgentGoal` entry is created in MongoDB Atlas.
3. **Autonomous Self-Invocation & Fallback**:
   - Simulate/trigger target execution time for `delete_list_and_tasks`.
   - Verify `AIAgentRunner` automatically deletes the `"Goal Now"` category and its tasks from MongoDB Atlas, appends a notification in chat, and retains short-term context when replied to.
