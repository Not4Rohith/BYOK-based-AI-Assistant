# Implementation Plan - Phase 16: Personal System Prompt & Priority Context Engine

This plan details **Phase 16** of the **Personal AI Task Manager**, implementing the dedicated Personal System Prompt instructions and context precedence engine per Sections 25 and 26 of the architecture specification.

---

## Architectural Rules for System Prompt vs Memory

Per Section 26 of the specification, explicit user instructions take strict precedence over inferred memories when there is any conflict:

```
+-------------------------------------------------------------+
|                USER PERSONAL SYSTEM PROMPT                  |
|                 (Highest Priority Context)                  |
|  e.g., "I am a college student. Never schedule after 10 PM. |
|         Complete difficult technical work early in the day." |
+------------------------------+------------------------------+
                               |
                               v
                     ContextPrecedenceEngine
                               |
           (Overrides Inferred Memories on Conflict)
                               |
                               v
          Top Vector Memories + Current User Request
                               |
                               v
                              LLM
```

---

## Proposed Changes

### Backend Precedence & System Prompt Engine
#### [NEW] [backend/src/ai/contextPrecedence.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/contextPrecedence.ts)
- `ContextPrecedenceEngine` merging system prompt instructions with vector-retrieved memories, enforcing explicit instruction precedence over inferred preferences.

#### [MODIFY] [backend/src/ai/aiContextBuilder.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/aiContextBuilder.ts)
- Integrate `ContextPrecedenceEngine` to structure high-priority user instructions at the top of the LLM prompt.

#### [MODIFY] [backend/src/services/ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Dynamically pass user profile system prompt (`user.aiInstructions.systemPrompt`) into `ProviderManager` generations.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Edit System Prompt in Settings view to `"Never schedule study after 9 PM"`.
- Generate daily schedule and verify planner respects user system prompt as top-priority constraint.
