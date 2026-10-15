# Implementation Plan - Phase 10: Task Decomposition Engine

This plan details **Phase 10** of the **Personal AI Task Manager**, implementing automatic task decomposition per Sections 4, 32, and 66 of the architecture specification.

---

## Technical Approach & Architecture

Large projects or complex goals (e.g. `"Build ML Project"`, `"DBMS Assignment"`) require breaking down into smaller, actionable sub-steps with realistic time estimates:

```
Complex User Goal / Task ("Break down ML project")
                       |
                       v
             TaskDecompositionEngine
                       |
                       v
             AI Reasoning / Breakdown
                       |
                       v
    Structured Subtasks with Estimated Durations
    - Step 1: Prepare Dataset & Cleaning (45m)
    - Step 2: Implement Training Loop (60m)
    - Step 3: Evaluate Model Metrics (30m)
                       |
                       v
     Updated Task Subtask Checklist & Goals Link
```

---

## Proposed Changes

### Backend Task Decomposition Service
#### [NEW] [backend/src/services/decomposition.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/decomposition.service.ts)
- Service analyzing complex tasks/goals and generating subtasks with time estimates.

#### [MODIFY] [backend/src/ai/naturalLanguageParser.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/naturalLanguageParser.ts)
- Add intent parser for task decomposition queries (e.g., `"Break down..."`, `"Decompose..."`, `"Split into steps..."`).

#### [MODIFY] [backend/src/services/ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Integrate `decomposition.service` into `processMessage()` to automatically attach decomposed subtasks to target tasks.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Test natural language prompt: `"Break my ML project into tasks"` -> verifies AI populates subtasks on the ML project task.
- View task card in Tasks view; confirm subtask checklist items and duration breakdown display correctly.
