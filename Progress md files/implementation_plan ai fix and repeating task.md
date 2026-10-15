# Implementation Plan - Autonomous AI Assistant Tool Calling & Google Tasks Repeat Modal

Enhance the AI Assistant with complete autonomous CRUD authority over tasks, lists/categories, and schedules via structured LLM tool execution, and implement the 1:1 Google Tasks "Repeats every" modal with interval, unit, set time, and end criteria (Never, On date, After occurrences).

## User Review Required

> [!IMPORTANT]
> - **Autonomous AI Tool Calling**: The AI Assistant is granted full programmatic access to write, edit, delete tasks, move tasks between lists/categories, set scheduled times, and adjust recurrence rules.
> - **Google Tasks Repeats Modal**: Replaces the basic repeat toggle with a 1:1 Google Tasks repeat modal matching your screenshot (Interval count, Unit dropdown, Set time, End condition: Never / On date / After X occurrences).

## Open Questions

None. The AI tool schema and Google Tasks Repeat modal parameters follow exact specification and screenshot reference.

## Proposed Changes

---

### Backend AI System

#### [MODIFY] [ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Inject full real-time workspace context into the LLM system prompt:
  - All current task lists/categories with IDs.
  - All existing tasks with titles, descriptions, due dates, times, statuses, and list assignments.
  - Current timestamp and user preferences.
- Define JSON function/tool schemas in the prompt:
  - `create_task({ title, description, listId, priority, scheduledStart, durationMinutes, rrule })`
  - `update_task({ taskId, title, description, status, priority, listId, scheduledStart, rrule })`
  - `delete_task({ taskId })`
  - `create_list({ title })`
  - `delete_list({ listId })`
  - `replan_day()`
- Parse tool calls from LLM responses and execute them directly via `TaskService`, updating database & client state in real time.

---

### Desktop Frontend

#### [NEW] [GoogleRepeatModal.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/GoogleRepeatModal.tsx)
- Create a 1:1 Google Tasks Repeat modal matching the attached screenshot:
  - **Repeats every**: `[ Interval Number ]` + `[ day | week | month | year ]` dropdown.
  - **Set time**: `[ Time picker ]` input (e.g. `23:00`).
  - **Ends**:
    - Radio `Never`
    - Radio `On` + `[ Date picker ]`
    - Radio `After` + `[ Number ]` `occurrences`
  - **Buttons**: `Cancel` and `Done`.
- Generates standard RRULE string (e.g. `FREQ=DAILY;INTERVAL=1;UNTIL=...;COUNT=...`).

#### [MODIFY] [GoogleBoardView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/GoogleBoardView.tsx)
- Connect the `Repeat` pill button and context menu `Repeat` item to trigger `GoogleRepeatModal`.
- Update card rendering to display recurrence badges (e.g. `🔁 Repeats daily`, `🔁 Repeats every 2 weeks`).

---

## Verification Plan

### Automated Tests
- Run `npm run bundle:desktop` in workspace root to verify clean TypeScript compilation and Vite desktop bundle generation with 0 errors.

### Manual Verification
1. Open AI Assistant chat and type natural instructions: *"I have to do DSA for 2 hrs by tonight 1 am"*, *"Delete the task named scooty"*, or *"Create a list called Exam Prep"*. Confirm the AI executes the action directly on your board.
2. Click the `Repeat` pill button on any task: confirm the Google Tasks repeat modal opens matching your screenshot, adjust interval/ends/time, and click `Done`. Confirm the RRULE recurrence updates properly on the card.
