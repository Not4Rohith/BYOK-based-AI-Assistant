# Implementation Plan - Phase 17: Automatic Replanning Engine & Dynamic Mid-Day Adaptability

This plan details **Phase 17** of the **Personal AI Task Manager**, implementing dynamic mid-day replanning per Section 40 of the architecture specification.

---

## Technical Approach & Replanning Pipeline

Per Section 40, **the planner adapts automatically instead of forcing the user to manually rearrange tasks** when plans change mid-day:

```
User Mid-Day Update ("I haven't started DSA yet" at 17:30)
                           |
                           v
                AutomaticReplanner Engine
                           |
       Inputs: Current Time (17:30) + Remaining Tasks +
       Fixed Calendar + Deadlines + Memories & Preferences
                           |
                           v
                Generate Adjusted Schedule
         17:30-18:30: DSA (Shifted)
         18:30-19:30: Gym
         20:00-21:00: DBMS
                           |
                           v
              Deterministic Planner Validation
                           |
                           v
             Update MongoDB + Google Calendar + UI
```

---

## Proposed Changes

### Backend Automatic Replanner Engine
#### [NEW] [backend/src/ai/automaticReplanner.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/automaticReplanner.ts)
- Engine evaluating mid-day user state changes, computing remaining time windows, shifting delayed tasks, and resolving conflicts.

#### [MODIFY] [backend/src/services/planning.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/planning.service.ts)
- Connect `automaticReplanner` to `replanDay()` with current timestamp parameters.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Send mid-day prompt: `"I haven't started DSA yet"` at 17:30 -> verify `automaticReplanner` shifts remaining task blocks forward from 17:30 while maintaining non-overlapping fixed commitments.
