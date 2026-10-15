# Implementation Plan - Google Tasks Inline Editing, Context Menu & OpenRouter AI Fix

Transform task editing to match the original Google Tasks UI 1:1 by removing the right sidebar drawer, implementing inline card task expansion with details and pill buttons, creating a floating popover context menu (`⋮`), and ensuring OpenRouter AI key configuration is persistent and fully operational.

## User Review Required

> [!IMPORTANT]
> - **Task Detail Drawer Removal**: The right sidebar drawer (`GoogleTaskDetail.tsx`) is completely removed. Task editing now occurs directly inline inside task cards and via the context menu.
> - **OpenRouter AI Persistence**: AI configuration keys are now saved persistently to `backend/data/ai-config.json` and checked against environment variables (`OPENROUTER_API_KEY`) with automatic retry and clear error reporting.

## Open Questions

None. The exact menu structure, options, and layout match the uploaded screenshots (`Tasks.html` reference and user screenshots) 1:1.

## Proposed Changes

---

### Desktop App Frontend

#### [MODIFY] [GoogleBoardView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/GoogleBoardView.tsx)
- Add inline card expansion state when a task is clicked:
  - Editable **Title Input** directly in card.
  - Multi-line **Details Area** (`≡ Add details` / `≡ Details`) directly under title.
  - Interactive **Date/Time Pill** and **Repeat Pill** (`🕒 Today`, `🔁 Repeat`) inside the task card.
  - Subtask inline management (checkboxes and `+ Add subtask`).
- Implement an **Inline Task Context Menu Popover (`⋮`)**:
  - Positioned dynamically near the clicked `⋮` button.
  - Options:
    - `☆ Add to starred` / `⭐ Starred`
    - `🎯 Add deadline` (opens date/time selector)
    - `📎 Add attachment`
    - `🗑 Delete`
    - Horizontal line divider (`<hr>`)
    - List migration list items with checkmark (`✓`) indicating current list (`Basic Info`, `Skills`, `Career Achievements`, `Other Achievements`, `Possessions`, `Advantages`, `Disadvantages`, `sfsaf`).
    - `+ New list` item to instantly add a list.

#### [DELETE] [GoogleTaskDetail.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/GoogleTaskDetail.tsx)
- Remove the right sidebar drawer component to ensure task editing stays 100% inline and popover-driven.

#### [MODIFY] [App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/App.tsx)
- Remove `selectedTask` right sidebar rendering.
- Wire `GoogleBoardView` callbacks (`onUpdateTask`, `onDeleteTask`, `onCreateList`, `onToggleStar`, etc.).

---

### Backend AI Integration

#### [MODIFY] [openrouter.provider.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/ai/providers/openrouter.provider.ts)
- Sanitize `apiKey` with `.trim()`.
- Ensure correct default model fallback (`anthropic/claude-3.5-sonnet` or `google/gemini-2.0-flash-001`).
- Provide detailed error messages for 401 (invalid key), 402 (insufficient credits), or network errors.

#### [MODIFY] [ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Load config from `backend/data/ai-config.json` on initialization, falling back to `process.env.OPENROUTER_API_KEY`.
- Save updated config persistently when `updateConfig` is called.
- Ensure `providerManager.generate(...)` is safely executed with error handling so AI chat messages always return a valid response.

---

## Verification Plan

### Automated Tests
- Run `npm run bundle:desktop` in workspace root to verify 0 TypeScript / bundling errors across desktop and shared packages.

### Manual Verification
1. Launch `npm run start:desktop`.
2. Click any task in the board view: confirm it expands inline with editable title, `≡ Details`, date/time pills, and subtasks (NO right sidebar drawer pops up).
3. Click `⋮` on any task: verify the context menu popover opens with `Add to starred`, `Add deadline`, `Add attachment`, `Delete`, list checkmarks, and `+ New list`.
4. Open Settings: enter OpenRouter API key, click "Save Configurations".
5. Send a chat message in the Floating AI Assistant: verify OpenRouter responds via the API key.
