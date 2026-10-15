# Implementation Plan - Phase 25: Google Tasks Ultra-Minimalistic UI Redesign

This plan details **Phase 25** of the **Personal AI Task Manager**, redesigning the Desktop & Mobile user interfaces into an **ultra-minimalistic, task-first Google Tasks aesthetic** per the user's detailed specification.

---

## Google Tasks Design & Structural Principles

```
+--------------------------------------------------------------------------+
|                 GOOGLE TASKS MINIMALIST DESKTOP UI                       |
|                                                                          |
|   Sidebar (Narrow)        Main Task View                                |
|   +------------------+    +------------------------------------------+  |
|   | ★ Important      |    | My Tasks                           +  ⋮  |  |
|   | 📅 Today         |    +------------------------------------------+  |
|   | 🗓 Upcoming       |    | + Add a task                             |  |
|   |                  |    |                                          |  |
|   | LISTS            |    | ☐ Study DSA                              |  |
|   | 📚 College       |    |    Sep 17 · 7:00 PM  ☆                    |  |
|   | 💻 Projects      |    |                                          |  |
|   | 🧠 DSA           |    | ☐ Complete assignment                    |  |
|   | 🤖 ML            |    |    2/5 subtasks  ☆                       |  |
|   | 🏠 Personal      |    |                                          |  |
|   |                  |    | ✓ Completed                              |  |
|   | + New List       |    |   ☑ Read ML chapter                      |  |
|   +------------------+    +------------------------------------------+  |
+--------------------------------------------------------------------------+
```

---

## Key Features & Redesign Specifications

1. **Task-First Layout**:
   - Primary focus on task title, completion checkbox, due date/time badge, subtask count indicator, and star toggle.
   - Quick inline task creator (`+ Add a task`).
   - Collapsible **✓ Completed** section separating active tasks from finished work.

2. **Slide-Out Task Detail Drawer**:
   - Tapping/clicking any task opens a compact detail drawer:
     - Editable Title & Details/Notes
     - Date & Time selector (`📅 Date`, `⏰ Time`)
     - Recurrence selector (`↻ Repeat`)
     - Subtasks checklist with inline subtask addition (`☐ Add subtask`)
     - Star toggle (`☆ Star`)
     - Task list selector & Delete button (`🗑 Delete`)

3. **Task Lists & Minimal Navigation**:
   - Sidebar lists: `Starred` (Important), `Today`, `Upcoming`, custom categories (`College`, `Projects`, `DSA`, `ML`, `Personal`).
   - Ability to create new task lists.

4. **Integrated AI Assistant**:
   - Discrete, non-intrusive floating AI chip ("✨ Ask AI") that opens a sleek side panel for natural-language schedule optimization and task planning.

5. **Mobile UI Redesign (`apps/mobile/App.tsx`)**:
   - Google Tasks mobile interface with clean list selector tabs, inline task creation, swipeable actions, task details sheet, and completed section.

---

## Proposed Changes

### Shared Types (`packages/shared-types/src/index.ts`)
#### [MODIFY] [packages/shared-types/src/index.ts](file:///home/rohith/Documents/AI%20Task%20Manager/packages/shared-types/src/index.ts)
- Add `starred?: boolean`, `listId?: string` to `Task` interface.
- Add `TaskList` interface.

---

### Desktop Google Tasks UI (`apps/desktop/src/`)
#### [NEW] [apps/desktop/src/components/GoogleTasksSidebar.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/GoogleTasksSidebar.tsx)
- Narrow Google Tasks sidebar with Starred, Today, Upcoming, and custom Task Lists.

#### [NEW] [apps/desktop/src/components/TaskDetailDrawer.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/TaskDetailDrawer.tsx)
- Slide-out detail drawer for editing title, description, date/time, repeat rule, subtasks, list, and starring.

#### [NEW] [apps/desktop/src/components/GoogleTasksView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/GoogleTasksView.tsx)
- Minimal task list view with inline task creation, subtask progress badges, starring, and collapsible completed tasks section.

#### [MODIFY] [apps/desktop/src/App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/App.tsx)
- Replace multi-dashboard layout with Google Tasks minimal dual-panel interface + floating AI panel.

---

### Mobile Google Tasks UI (`apps/mobile/App.tsx`)
#### [MODIFY] [apps/mobile/App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/mobile/App.tsx)
- Ultra-minimal mobile interface matching Google Tasks Android/iOS app.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Launch `npm run bundle:desktop` and test task creation, detail drawer, starring, lists, and completed collapsible section.
- Test mobile view on Expo.
