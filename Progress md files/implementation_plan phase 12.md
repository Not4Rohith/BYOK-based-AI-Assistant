# Implementation Plan - Phase 12: Zod Validation & Deterministic Planner Validation

This plan details **Phase 12** of the **Personal AI Task Manager**, implementing Zod runtime schema validation and the Deterministic Planner Validation Engine per Sections 30, 31, and 67 of the architecture specification.

---

## Architectural Control Flow & Validation Engine

Before any AI-generated plan or schedule update is saved to MongoDB or synchronized with Google Calendar, it must pass through two strict validation stages:

```
AI Proposed Plan JSON
          |
          v
1. Zod Runtime Schema Validation (Validates structure & types)
          |
          v
2. Deterministic Planner Validator (Validates business logic constraints)
   - Rule 1: No overlap with fixed calendar commitments
   - Rule 2: End time must strictly follow start time (scheduledEnd > scheduledStart)
   - Rule 3: Duration must be strictly positive
   - Rule 4: Completed tasks are never re-scheduled
   - Rule 5: Task deadlines are strictly respected
   - Rule 6: Explicit user system prompt instructions override inferred preferences
          |
          +-----------------------------+
          |                             |
     (Plan Valid)                (Plan Invalid)
          |                             |
          v                             v
Save to MongoDB & Sync         Trigger Re-planner Loop
```

---

## Proposed Changes

### Backend Validation Engine
#### [NEW] [backend/src/ai/plannerValidator.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/plannerValidator.ts)
- `PlannerValidator` engine evaluating proposed schedules against all Section 67 business rules. Returns `{ isValid: boolean; errors: string[] }`.

#### [MODIFY] [backend/src/services/planning.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/planning.service.ts)
- Integrate `PlannerValidator` into `generateDailyPlan` & `replanDay`. If plan is invalid, perform deterministic adjustment or re-plan prior to saving.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Test generating daily plan with overlapping or invalid timeblocks -> verify `PlannerValidator` flags violations and fixes them deterministically before returning to client.
