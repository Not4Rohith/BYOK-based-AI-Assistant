# Implementation Plan - Phase 9: Recurring Tasks & RRULE Recurrence Engine

This plan details **Phase 9** of the **Personal AI Task Manager**, implementing the RRULE recurrence engine and automated task instance generation per Section 33 of the architecture specification.

---

## Technical Approach & Architecture

Per Section 33, **the application's own recurrence model is the source of truth**. External APIs (like Google Tasks) have different or limited recurrence capabilities and are treated strictly as synchronized representations.

```json
{
  "title": "Study DSA",
  "recurrence": {
    "enabled": true,
    "rule": "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "timezone": "Asia/Kolkata"
  }
}
```

### Recurrence Engine Features
1. **RRULE Generator & Matcher**:
   - Parse RRULE strings (`FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`, `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=SU`, `FREQ=MONTHLY`).
   - Determine if a recurring task pattern matches today or a given target date.
2. **Automated Instance Generation**:
   - When fetching or replanning tasks for Today, the recurrence engine evaluates active recurring rules and instantiates pending task instances for the date if not already generated.
3. **Natural-Language Recurrence Creation**:
   - Chatbot support for natural-language recurring commands (e.g. `"Create a recurring gym task every Monday, Wednesday and Friday"`).

---

## Proposed Changes

### Backend Recurrence Engine
#### [NEW] [backend/src/services/recurrence.engine.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/recurrence.engine.ts)
- Recurrence evaluation engine matching target dates against standard RRULE patterns.

#### [MODIFY] [backend/src/services/task.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/task.service.ts)
- Integrate `recurrence.engine` to generate recurring task instances dynamically for target dates.
- Add `createRecurringTask(title, rrule, priority, duration)` method.

#### [MODIFY] [backend/src/ai/naturalLanguageParser.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/naturalLanguageParser.ts)
- Support parsing natural-language recurrence patterns (`every weekday`, `every Sunday`, `every day`).

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Test natural language prompt: `"Create a recurring task to study DSA every weekday at 7 PM"` -> verifies task created with `recurrence.enabled: true` and `rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"`.
- Switch to Tasks view `Recurring` filter and confirm recurring rule badge displays properly.
