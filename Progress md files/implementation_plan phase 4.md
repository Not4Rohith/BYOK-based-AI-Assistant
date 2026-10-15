# Implementation Plan - Phase 4: Task CRUD (Full Operations & Subtask Engine)

This plan details **Phase 4** of the **Personal AI Task Manager**, implementing comprehensive Task CRUD operations, subtask management, inline editing, and filtering per Section 44 and Sections 31–32 of the specification.

---

## Technical Approach

Phase 4 expands task management with deep CRUD functionality across both frontend React components and Express backend services:

1. **Subtask Management Engine**:
   - Add inline subtasks to any task.
   - Toggle subtask completion status (`st.completed`).
   - Delete subtask.
   - Subtask completion progress indicator (e.g., `2/3 subtasks`).

2. **Full Task Lifecycle & Editing**:
   - Inline editing for task titles, descriptions, estimated duration, priority level, and due dates.
   - Bulk status filters (`Inbox`, `Today`, `Upcoming`, `Completed`, `Recurring`, `Priority`).
   - Rich task metadata tags (`DSA`, `college`, `ML`, `fitness`).

3. **Backend API Endpoints**:
   - `POST /api/tasks/:id/subtasks` - Add a subtask to a task.
   - `PATCH /api/tasks/:id/subtasks/:subtaskId/toggle` - Toggle subtask completion.
   - `DELETE /api/tasks/:id/subtasks/:subtaskId` - Remove a subtask.
   - `PUT /api/tasks/:id` - Full update of task properties.

---

## Proposed Changes

### Backend Task Service & Router
#### [MODIFY] [backend/src/services/task.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/task.service.ts)
- Add subtask CRUD methods: `addSubtask`, `toggleSubtask`, `deleteSubtask`.
- Add full task update method: `updateTask`.

#### [MODIFY] [backend/src/routes/tasks.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/tasks.router.ts)
- Expose subtask endpoints:
  - `POST /:id/subtasks`
  - `PATCH /:id/subtasks/:subtaskId/toggle`
  - `DELETE /:id/subtasks/:subtaskId`

### Desktop Application UI
#### [MODIFY] [apps/desktop/src/api/client.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/api/client.ts)
- Add client helper functions for subtask endpoints (`addSubtask`, `toggleSubtask`, `deleteSubtask`, `updateTask`).

#### [MODIFY] [apps/desktop/src/components/TasksView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/TasksView.tsx)
- Add expandable task card drawer for inline editing of subtasks, descriptions, priorities, and estimated duration.
- Add subtask input field directly on task cards.

#### [MODIFY] [apps/desktop/src/App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/App.tsx)
- Integrate subtask handlers (`handleAddSubtask`, `handleToggleSubtask`, `handleDeleteSubtask`, `handleUpdateTask`).

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Create a task, add 2 subtasks, toggle one completed, and verify subtask status updates in both UI and backend.
- Edit task priority and duration inline; confirm task list updates instantly with optimistic UI.
