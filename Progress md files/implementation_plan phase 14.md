# Implementation Plan - Phase 14: Custom Memory System & Automatic Extractor

This plan details **Phase 14** of the **Personal AI Task Manager**, implementing the custom memory pipeline, memory category manager, and automatic memory extractor per Sections 6, 22, 23, and 24 of the architecture specification.

---

## Architectural Rules for Memory

1. **NO Mem0**: Per Section 6 & 76, **Mem0 is strictly forbidden**. The application implements its own custom memory architecture.
2. **Transparent User Control**: The user can inspect, add explicit memories, edit, delete, or disable any memory at any time in the Memory view.
3. **Automatic Extraction Pipeline**:
   ```
   Conversation Prompt ("I prefer studying difficult technical subjects in the morning")
                                     |
                                     v
                           MemoryExtractor Engine
                                     |
                          (Is useful long-term?)
                                   /    \
                                 YES     NO (Ignore small talk / greetings)
                                 /
                                v
               Concise Atomic Memory Object
               Category: "preferences", Importance: 0.8
                                 |
                                 v
                       MongoDB Collection
   ```
4. **Exclusions**: Never store greetings, small talk, passwords, API keys, credentials, or raw transcripts.

---

## Proposed Changes

### Backend Custom Memory Engine
#### [NEW] [backend/src/services/memoryExtractor.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/memoryExtractor.ts)
- Automatic memory extraction engine evaluating user conversation prompts and creating concise atomic memory objects.

#### [MODIFY] [backend/src/services/memory.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/memory.service.ts)
- Add category filtering, importance weighting, status toggles (`active` / `disabled`), and search helpers.

#### [MODIFY] [backend/src/services/ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Trigger `memoryExtractor` automatically when handling user chat messages.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Send prompt: `"I don't like scheduling demanding work after 10 PM"` -> verify `memoryExtractor` extracts atomic constraint memory and saves it to MongoDB.
- Verify small talk ("Hello", "Thanks") is correctly filtered out and ignored by the memory extractor.
