# Implementation Plan - Phase 7: One AI Provider (AI Provider Abstraction Framework)

This plan details **Phase 7** of the **Personal AI Task Manager**, implementing the AI Provider Abstraction Framework and the initial primary AI provider per Sections 15–18 of the architecture specification.

---

## Technical Architecture for Phase 7

Per Section 16 of the specification, the application must **never hardcode to one AI provider**. Instead, all AI invocations flow through `AIService` -> `ProviderManager` -> `AIProvider`:

```
               Application Request (Chat / Natural Language)
                                     |
                                     v
                                AIService
                                     |
                                     v
                              ProviderManager
                                     |
                                     +-----------------------+
                                     | (Primary Provider)    | (Configured Provider)
                                     v                       v
                           OpenRouterProvider        GeminiProvider
```

### Abstraction Interface
```typescript
export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AIProvider {
  name: string;
  generate(request: AIRequest, apiKey: string, defaultModel: string): Promise<AIResponse>;
}
```

---

## Proposed Changes

### Backend AI Module (`packages/ai` or `backend/src/ai/`)
#### [NEW] [backend/src/ai/provider.interface.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/provider.interface.ts)
- Base interfaces for `AIRequest`, `AIResponse`, and `AIProvider`.

#### [NEW] [backend/src/ai/providers/openrouter.provider.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/providers/openrouter.provider.ts)
- `OpenRouterProvider` implementation supporting standard OpenRouter API calls with graceful error handling.

#### [NEW] [backend/src/ai/provider-manager.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/provider-manager.ts)
- `ProviderManager` orchestrating provider selection, checking key availability, and executing requests.

#### [MODIFY] [backend/src/services/ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Integrate `ProviderManager` into `AIService.processMessage()`.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Send a prompt to `POST /api/chat` and verify `AIService` invokes `ProviderManager`.
- Test graceful response when API key is missing vs. when configured.
