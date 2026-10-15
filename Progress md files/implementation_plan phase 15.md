# Implementation Plan - Phase 15: Embeddings & MongoDB Vector Search Engine

This plan details **Phase 15** of the **Personal AI Task Manager**, implementing embedding generation and MongoDB Atlas Vector Search per Sections 27 and 28 of the architecture specification.

---

## Technical Approach & Vector Search Pipeline

Per Section 27 & 28, **vector search is used specifically for semantic memory retrieval**. Rather than dumping the entire database into the LLM context, the AI Context Builder retrieves only the top 5–15 relevant memories using vector similarity search:

```
User Prompt ("Plan my study session tomorrow")
                    |
                    v
          Embedding Generation Engine
           (Vector: [0.021, -0.184, 0.731...])
                    |
                    v
        MongoDB Atlas Vector Search
           (Cos similarity search)
                    |
                    v
    Filter by User & Category Metadata
                    |
                    v
   Top 5–15 Relevant Memories Retrieved
                    |
                    v
            AI Context Builder
                    |
                    v
                   LLM
```

---

## Proposed Changes

### Backend Vector Search Engine
#### [NEW] [backend/src/ai/embeddings.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/embeddings.service.ts)
- Embedding service generating 384/1536-dimensional vector representations for text memories and queries.

#### [MODIFY] [backend/src/db/models/Memory.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/Memory.model.ts)
- Add `embedding: { type: [Number], select: false }` field to `MemorySchema` with vector search index configuration.

#### [NEW] [backend/src/ai/aiContextBuilder.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/aiContextBuilder.ts)
- Context builder gathering current user request, system prompt instructions, top vector-retrieved memories, active tasks, and calendar commitments into a bounded context.

#### [MODIFY] [backend/src/services/memory.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/memory.service.ts)
- Add `searchRelevantMemories(queryPrompt, limit)` using vector similarity / cosine search.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Execute semantic memory search (`searchRelevantMemories("difficult morning study")`) -> verify vector search returns top relevant memory ("Prefers studying difficult technical subjects in the morning") while excluding unrelated memories.
