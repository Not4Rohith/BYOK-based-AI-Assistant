# Implementation Plan - Phase 13: LangGraph Planner (Stateful Workflow Orchestration)

This plan details **Phase 13** of the **Personal AI Task Manager**, implementing the stateful LangGraph planning workflow per Sections 20 and 21 of the architecture specification.

---

## Technical Architecture & State Graph Workflow

Per Section 20 of the specification, **LangGraph is used strictly for multi-step complex reasoning workflows** (morning planning, schedule generation, conflict resolution, replanning), NOT for simple CRUD.

```
                  [START]
                     |
                     v
             Understand Request
                     |
                     v
              Retrieve Context
        (Memories + Tasks + Calendar)
                     |
                     v
                Create Plan
                     |
                     v
              Validate Plan
                     |
           +---------+---------+
           |                   |
        (VALID)            (INVALID)
           |                   |
           v                   v
       Save Plan           Re-plan
           |                   |
           v                   +---> Validate Plan
   Google Tasks Sync
           |
           v
  Google Calendar Sync
           |
           v
         [END]
```

---

## State Schema (`DailyPlannerState`)

```typescript
export interface DailyPlannerState {
  userRequest: string;
  tasks: Task[];
  memories: Memory[];
  calendarEvents: { title: string; startHour: number; endHour: number }[];
  proposedSchedule: ScheduleItem[];
  validationResult?: { isValid: boolean; errors: string[] };
  step: 'start' | 'retrieve_context' | 'create_plan' | 'validate_plan' | 'replan' | 'sync' | 'complete';
}
```

---

## Proposed Changes

### Backend LangGraph Workflow Engine
#### [NEW] [backend/src/ai/graphs/dailyPlanner.graph.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/graphs/dailyPlanner.graph.ts)
- LangGraph orchestration pipeline executing the state transitions: `understandRequest` -> `retrieveContext` -> `createPlan` -> `validatePlan` -> `syncAndSave`.

#### [MODIFY] [backend/src/services/planning.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/planning.service.ts)
- Integrate `dailyPlanner.graph` into `PlanningService` as the orchestration layer for morning planning & complex daily schedule generation.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Execute `POST /api/planning/generate` and observe state transition logs through all LangGraph graph nodes (`Retrieve Context` -> `Create Plan` -> `Validate Plan` -> `Sync`).
