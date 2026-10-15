# Implementation Plan - Phase 18: Multiple AI Providers, Fallback & Model Routing Engine

This plan details **Phase 18** of the **Personal AI Task Manager**, implementing multiple AI providers (`OpenRouter`, `Gemini`, `Grok`), graceful fallback chains, and intelligent model routing per Sections 16, 17, and 18 of the architecture specification.

---

## Technical Approach & Fallback Pipeline

Per Section 17, **provider failures must degrade gracefully**. The application sequentially attempts enabled providers when rate-limits, timeouts, or quota errors occur:

```
AI Invocations (Planning / Task Extraction)
                    |
                    v
          AI Model Routing Engine
   - TASK_PARSE / MEMORY_EXTRACTION -> Fast/Cheap Model
   - PLANNING / CONFLICT_RESOLUTION -> Stronger Model
                    |
                    v
         Provider Fallback Chain
           OpenRouter (Attempt 1)
                    |
              (Rate Limit / Error)
                    v
             Gemini (Attempt 2)
                    |
              (Failure / Timeout)
                    v
             Grok / Local Fallback
```

---

## Proposed Changes

### Backend Provider Implementations
#### [NEW] [backend/src/ai/providers/gemini.provider.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/providers/gemini.provider.ts)
- `GeminiProvider` implementing `AIProvider` for Google Gemini models (`gemini-1.5-flash`, `gemini-1.5-pro`).

#### [NEW] [backend/src/ai/providers/grok.provider.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/providers/grok.provider.ts)
- `GrokProvider` implementing `AIProvider` for xAI Grok models.

#### [NEW] [backend/src/ai/modelRouter.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/modelRouter.ts)
- `ModelRouter` selecting appropriate model tier (`fast`/`cheap` vs `stronger`) depending on operation complexity (`TASK_PARSE`, `MEMORY_EXTRACTION`, `PLANNING`).

#### [MODIFY] [backend/src/ai/provider-manager.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/provider-manager.ts)
- Register `GeminiProvider` and `GrokProvider`. Implement fallback loop: OpenRouter -> Gemini -> Grok -> Local Fallback.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Simulate primary provider failure (empty or invalid key) and verify system gracefully fails over to secondary provider (Gemini) and logs fallback event cleanly.
