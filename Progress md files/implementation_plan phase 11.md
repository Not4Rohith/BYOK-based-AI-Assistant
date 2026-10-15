# Implementation Plan - Phase 11: Daily Planning Engine

This plan details **Phase 11** of the **Personal AI Task Manager**, implementing the Daily Planning Engine and Schedule Generator per Sections 38, 66, and 67 of the architecture specification.

---

## Technical Approach & Business Rules

Per Section 38 & 67, **the planner generates realistic, buffered daily schedules** rather than simply packing every minute of the day.

```
Inputs:
- Fixed Calendar Events (e.g. College 09:00-16:00)
- Pending Tasks (ordered by Priority & Deadline)
- Personal Instructions ("No study after 10 PM", "Technical work early")
- User Planning Preferences (Start: 07:00, End: 22:00, Buffer: 15m)
                         |
                         v
              Daily Planning Engine
                         |
                         v
  Validated Timeblock Schedule (Task & Calendar Events + Buffers)
```

### Deterministic Business Rules (Section 67)
1. **Conflict Avoidance**: Tasks cannot overlap fixed calendar events.
2. **Buffer Allocation**: Insert default buffer minutes (e.g., 15m) between continuous work sessions.
3. **Time Window Enforcements**: Respect user preferred working hours and system prompt instructions.
4. **Non-destructive**: Completed tasks are preserved in history and not re-scheduled.

---

## Proposed Changes

### Backend Planning Engine
#### [MODIFY] [backend/src/services/planning.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/planning.service.ts)
- Implement `generateDailyPlan(tasks, fixedEvents, userPreferences, memories)` method using deterministic constraint solver & buffer allocator.

#### [MODIFY] [backend/src/routes/planning.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/planning.router.ts)
- Add `POST /api/planning/generate` endpoint returning the generated day schedule timeline.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Trigger `POST /api/planning/generate` and verify generated schedule includes 15-minute buffers between tasks and zero overlaps with fixed 09:00-16:00 college events.
