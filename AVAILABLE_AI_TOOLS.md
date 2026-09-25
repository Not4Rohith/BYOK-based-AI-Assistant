# Personal AI Task Manager — Available AI Tool Calls

This document outlines all autonomous functions and tool calls available to the AI Assistant for managing tasks, categories, schedules, memory, and background goals.

---

## 📋 Task Viewing & Query Tools

### 1. `get_tasks`
* **Purpose**: Retrieves current tasks stored in the database on demand.
* **Key Functionality**:
  * Queries real-time task records directly from MongoDB Atlas or memory.
  * Filters by status (`pending`, `completed`, `all`) or category/list ID (`listId`).
  * Returns task ID, title, status, priority, category title, description, scheduled start/end, estimated duration, subtasks, and `expiresAt` expiration date.
* **Parameters**: `filter` (`'pending' | 'completed' | 'all'`), `listId` (optional)

### 2. `search_tasks`
* **Purpose**: Performs a targeted query search across all user tasks.
* **Key Functionality**:
  * Keyword search within task titles and descriptions.
  * Filters by status, priority (`low`, `medium`, `high`, `urgent`), category/list title (`listTitle`), or tag (`tag`).
* **Parameters**: `query` (optional), `status` (optional), `priority` (optional), `listTitle` (optional), `tag` (optional)

### 3. `get_today_agenda`
* **Purpose**: Computes and fetches today's full agenda and timeline.
* **Key Functionality**:
  * Summarizes total tasks scheduled for today, total pending count, and completed count.
  * Outputs a structured timeline of scheduled time blocks and estimated durations.
* **Parameters**: None

---

## ✏️ Task Creation & Editing Tools

### 4. `create_task`
* **Purpose**: Creates a single new task on the task board.
* **Key Functionality**:
  * Assigns category by `listId` or category title (`listTitle`).
  * Configures priority, estimated minutes, `scheduledStart`, and `scheduledEnd`.
  * Supports favorite/starring (`starred: true`), auto-expiration (`expiresAt` ISO timestamp), and initial `subtasks` list.
* **Parameters**: `title`, `description`, `listId`, `listTitle`, `priority`, `starred`, `estimatedMinutes`, `scheduledStart`, `scheduledEnd`, `expiresAt`, `subtasks`

### 5. `batch_create_tasks`
* **Purpose**: Creates multiple tasks in a single bulk operation.
* **Key Functionality**: Efficiently processes and creates an array of task objects in one turn (ideal for adding an entire daily routine or multi-step project).
* **Parameters**: `tasks` (Array of task objects with `title`, `description`, `listId`, `listTitle`, `priority`, `starred`, `estimatedMinutes`, `scheduledStart`, `expiresAt`, `subtasks`)

### 6. `update_task`
* **Purpose**: Modifies an existing task on the board.
* **Key Functionality**:
  * Accepts task ID or task title search string.
  * Updates title, description, status (`pending`, `in_progress`, `completed`), priority, category (`listId`), scheduled start/end, estimated minutes, starred status (`starred: true/false`), or `expiresAt`.
* **Parameters**: `taskId` (ID or title), `title`, `description`, `status`, `priority`, `listId`, `scheduledStart`, `scheduledEnd`, `estimatedMinutes`, `expiresAt`, `starred`

### 7. `bulk_update_tasks`
* **Purpose**: Applies updates to multiple tasks simultaneously.
* **Key Functionality**: Bulk updates status, priority, category, schedule, starred state, or expiration across an array of task IDs.
* **Parameters**: `taskIds` (Array of string IDs), `updates` (`status`, `priority`, `listId`, `scheduledStart`, `expiresAt`, `starred`)

### 8. `complete_task`
* **Purpose**: Quick one-shot tool to mark a task as completed.
* **Key Functionality**: Finds task by ID or title string and updates its status to `completed`.
* **Parameters**: `taskId` (optional), `title` (optional)

### 9. `snooze_task`
* **Purpose**: Postpones or delays a task.
* **Key Functionality**: Reschedules `scheduledStart` and `scheduledEnd` forward by specified minutes (`snoozeMinutes`), hours (`snoozeHours`), or pushes to tomorrow (`snoozeToTomorrow`).
* **Parameters**: `taskId` (optional), `title` (optional), `snoozeMinutes`, `snoozeHours`, `snoozeToTomorrow`

### 10. `delete_task`
* **Purpose**: Deletes a specific single task.
* **Key Functionality**: Finds task by ID or title name and permanently removes it.
* **Parameters**: `taskId` (ID or title string), `title` (optional)

### 11. `delete_all_tasks`
* **Purpose**: Deletes all tasks from the database.
* **Parameters**: None

---

## 🧩 Subtask Tools

### 12. `create_subtask`
* **Purpose**: Adds a sub-action item to an existing task.
* **Key Functionality**: Appends a new subtask object (`{ _id, title, completed }`) to the designated task.
* **Parameters**: `taskId` (or `title`), `subtaskTitle`

### 13. `delete_subtask`
* **Purpose**: Removes a subtask from a parent task.
* **Parameters**: `taskId`, `subtaskId`

---

## 🗂️ Category & List Management Tools

### 14. `get_lists`
* **Purpose**: Fetches all current task categories / lists from the database.
* **Key Functionality**: Returns array of list objects including `id`, `title`, and `expiresAt` expiration metadata.
* **Parameters**: None

### 15. `create_list`
* **Purpose**: Creates a new task category / list column.
* **Key Functionality**: Supports setting an optional `expiresAt` ISO date timestamp for temporary categories (e.g. "Today Tasks" valid until tomorrow morning).
* **Parameters**: `title`, `expiresAt` (optional)

### 16. `delete_list`
* **Purpose**: Deletes a category list and all tasks contained inside it.
* **Key Functionality**: Accepts category ID or category title. Passing `"all"` deletes all categories.
* **Parameters**: `listId` (ID, title, or `"all"`)

### 17. `delete_all_lists`
* **Purpose**: Deletes all task categories / lists from the database.
* **Parameters**: None

---

## 🗓️ Adaptive Planning Tools

### 18. `replan_day`
* **Purpose**: Recalculates and optimizes the user's daily schedule from the current timestamp.
* **Key Functionality**: Dynamically fits uncompleted tasks around fixed event blocks and updates `scheduledStart` / `scheduledEnd` in MongoDB.
* **Parameters**: `fixedEvents` (optional array of `{ title, startHour, endHour }`)

---

## 🤖 Autonomous Background Goal Tools

### 19. `create_ai_agent_goal`
* **Purpose**: Registers an autonomous background goal for the server to execute on a scheduled timer.
* **Key Functionality**: Schedules server-side background actions (e.g. `delete_list_and_tasks`, `check_in_reminder`). Supports passing `listTitle` payload so target category is precisely matched.
* **Parameters**: `title`, `actionType`, `targetExecutionTime`, `listTitle`

### 20. `get_active_ai_goals`
* **Purpose**: Retrieves all pending background autonomous AI goals currently scheduled in the system.
* **Parameters**: None

### 21. `cancel_ai_agent_goal`
* **Purpose**: Cancels a pending autonomous AI background goal by ID.
* **Parameters**: `goalId`
