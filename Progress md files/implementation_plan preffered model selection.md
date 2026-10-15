# Implementation Plan - Dynamic Model Discovery & Fallback Ranking in Settings

Build dynamic model fetching from AI provider APIs (OpenRouter, Gemini) and enable interactive model selection and ranking for fallbacks in the Settings screen. Remove all hardcoded model strings across `App.tsx` and `ai.service.ts`.

## User Review Required

> [!IMPORTANT]
> - Dynamic model discovery queries `https://openrouter.ai/api/v1/models` and `https://generativelanguage.googleapis.com/v1beta/models` using the API key configured in Settings.
> - The user can select a primary model and rank candidate fallback models. If a model encounters rate limits (e.g., HTTP 429) or failure, execution seamlessly steps down the ranked candidate models before attempting the next provider.

## Proposed Changes

### Shared Types (`@ai-task-manager/shared-types`)

#### [MODIFY] [index.ts](file:///home/rohith/Documents/AI%20Task%20Manager/packages/shared-types/src/index.ts)
- Extend `ProviderSetting` interface to include `fallbackModels?: string[]` to store an ordered list of candidate models for fallback.

---

### Backend API & Service Layer (`backend`)

#### [NEW] [models.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/models.router.ts)
- Create endpoint `GET /api/settings/models` that takes `provider` and `apiKey` query parameters.
- Fetches available models from OpenRouter API (`https://openrouter.ai/api/v1/models`) or Gemini API (`https://generativelanguage.googleapis.com/v1beta/models`).
- Formats and returns `{ id: string, name: string, contextLength?: number }[]`.

#### [MODIFY] [server.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/server.ts)
- Mount `/api/settings/models` router.

#### [MODIFY] [ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Remove hardcoded model strings (`openai/gpt-4o-mini`, `gemini-1.5-pro`) from default `config` initialization.
- Pass model rankings (`fallbackModels`) through `providerManager.generate`.

#### [MODIFY] [openrouter.provider.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/providers/openrouter.provider.ts)
- Accept `fallbackModels` parameter or array in `generate`.
- Construct candidate model execution list starting with `defaultModel` followed by user-ranked `fallbackModels`.

#### [MODIFY] [provider-manager.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/provider-manager.ts)
- Pass user's ranked `fallbackModels` array to provider implementations.

---

### Desktop Frontend (`apps/desktop`)

#### [MODIFY] [client.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/api/client.ts)
- Add `getAvailableModels: (provider: string, apiKey?: string)` method calling `/api/settings/models`.

#### [MODIFY] [App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/App.tsx)
- Remove hardcoded fallback model strings from `aiConfig` initial state.

#### [MODIFY] [SettingsView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/SettingsView.tsx)
- Add "Fetch Available Models" interactive trigger per provider key.
- Render dynamic searchable dropdown for Primary Model (`defaultModel`).
- Render interactive list builder for Ranking Fallback Models (`fallbackModels`) allowing adding, deleting, and re-ordering ranked models.

---

## Verification Plan

### Automated Verification
- Run `npm run build` across monorepo to verify TypeScript contracts and Vite bundle compilation.
- Test endpoint `curl "http://localhost:3001/api/settings/models?provider=openrouter&apiKey=YOUR_KEY"` to confirm model list response.

### Manual Verification
- Open Settings in desktop app, enter OpenRouter key, click "Fetch Available Models".
- Select primary model (e.g. `anthropic/claude-3.5-sonnet`) and add fallback models (e.g. `openai/gpt-4o-mini`).
- Save Settings and send a chat message, verifying in terminal logs that `[OpenRouterProvider]` uses the selected primary and fallback sequence cleanly.
