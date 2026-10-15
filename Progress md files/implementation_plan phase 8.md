# Implementation Plan - Phase 8: AI Natural-Language Task Creation / Editing

This plan details **Phase 8** of the **Personal AI Task Manager**, implementing natural-language task manipulation with Zod structured output validation per Sections 30, 31, 32, and 68 of the architecture specification.

---

## Technical Approach & Safety Control Flow

Per Section 30 of the specification, **the LLM is never given direct or unrestricted database access**. All natural-language requests follow this strict control flow:

```
User Prompt ("Add study DSA tomorrow at 7 PM")
                    |
                    v
         AI Provider / LLM
                    |
                    v
    Proposed Structured Action JSON
  e.g. { "action": "create_task", "title": "Study DSA", "estimatedMinutes": 60 }
                    |
                    v
     Zod Runtime Schema Validation
                    |
                    v
  Deterministic Business Logic Rules Check
                    |
                    v
     Authorized TaskService Execution
                    |
                    v
           MongoDB / Local Store
```

---

## Action Tool Schemas (Zod)

We will define validated action schemas:
- `create_task`: `title` (string), `priority` (`low`|`medium`|`high`), `estimatedMinutes` (number), `scheduledStart` (string).
- `update_task`: `taskId` (string), `updates` (partial task).
- `delete_task`: `taskId` or `titleQuery` (string).
- `complete_task`: `taskId` or `titleQuery` (string).

---

## Proposed Changes

### Backend Action Parser & Zod Schemas
#### [NEW] [backend/src/ai/taskAction.schema.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/taskAction.schema.ts)
- Zod schema definition for `TaskActionSchema` validating AI proposed actions.

#### [NEW] [backend/src/ai/naturalLanguageParser.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/naturalLanguageParser.ts)
- Natural language intent extractor parsing user prompts into validated structured tool actions (`create_task`, `update_task`, `delete_task`, `complete_task`).

#### [MODIFY] [backend/src/services/ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Integrate `naturalLanguageParser` into `processMessage()` to execute validated actions against `TaskService`.

---

## Verification Plan

### Automated Tests
- Install `zod` in backend: `npm install zod`
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Test natural language prompts via `POST /api/chat`:
  - `"Add study DSA tomorrow for 90 minutes"` -> verifies task created in database.
  - `"I finished DBMS"` -> verifies task status marked completed.
  - `"Remove gym task"` -> verifies task removed.
