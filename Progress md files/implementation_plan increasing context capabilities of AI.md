# Implementation Plan - Scalable Conversation Session Storage & Extensible Tiered Memory Engine

Design a highly scalable, flexible MongoDB Atlas database architecture for daily conversation sessions and a multi-tiered memory system (Short-Term, Medium-Term with auto-expiration, Long-Term, and custom dynamic tiers) equipped with schema-less metadata and tag indexing for future extensibility.

## User Review Required

> [!IMPORTANT]
> - **Scalable Database Architecture**: Memory and Chat Session schemas utilize flexible `metadata: Schema.Types.Mixed`, string categories, and `tags` arrays. This allows adding new conversation types, custom memory categories (e.g., health, academics, career, relationships, topic-based chats) or new tiers in the future without schema migrations.
> - **Daily Chat Session Storage**: Conversations are stored silently in MongoDB Atlas grouped by session date (`session_YYYY-MM-DD`) or session type (`daily_chat`, `topic_discussion`, `planning`). Users can retrieve any past dated chat session from the UI and continue seamlessly.
> - **Medium-Term Memory (Time-Bounded Context with Auto-Expiration)**: Remembers week-specific events and exams (e.g., *"NPTEL exam on Sunday"*). Actively reminds and prioritizes preparation throughout the current week. Once the target date passes, it auto-expires (`status: 'expired'`) so it doesn't clutter long-term context.
> - **Long-Term Memory (Permanent Profile)**: Extracted continuously from daily chats. Remembers recurring daily commitments (*"Coders High meeting every day"*), personal relationships, sensitive emotional context, and behavioral preferences (*"suggest movie recommendations if feeling down or post-breakup"*).
> - **UI Session & Memory Viewer**: The floating AI Assistant panel (`FloatingAIPanel.tsx`) will include a dated session selector (`📅 Daily Sessions`) to switch between past chats, plus an active memory viewer displaying your current Medium-Term and Long-Term context.

## Proposed Changes

---

### Shared Data Types & Scalable DB Schemas

#### [MODIFY] [shared-types/src/index.ts](file:///home/rohith/Documents/AI%20Task%20Manager/packages/shared-types/src/index.ts)
- Add `ChatSession` interface: `_id`, `userId`, `date`, `sessionType`, `title`, `summary`, `tags`, `metadata`, `createdAt`, `updatedAt`.
- Update `Memory` interface for long-term scalability:
  - `memoryTier`: `'short_term' | 'medium_term' | 'long_term' | string`
  - `category`: string (open string allowing dynamic future categories)
  - `validFrom?: string`
  - `validUntil?: string`
  - `tags?: string[]`
  - `metadata?: Record<string, any>`

#### [NEW] [ChatMessage.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/ChatMessage.model.ts)
- Mongoose schema: `sessionId` (indexed), `userId`, `date` (`YYYY-MM-DD`), `role`, `content`, `metadata: Schema.Types.Mixed`, timestamps.

#### [NEW] [ChatSession.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/ChatSession.model.ts)
- Mongoose schema: `_id` (`session_YYYY-MM-DD` or custom), `userId`, `date`, `sessionType`, `title`, `summary`, `tags`, `metadata: Schema.Types.Mixed`, timestamps.

#### [MODIFY] [Memory.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/Memory.model.ts)
- Update schema with `memoryTier`, `category` (open string), `validFrom`, `validUntil`, `tags`, `status` (`'active' | 'archived' | 'expired'`), `metadata: Schema.Types.Mixed`.

---

### Backend Services & Memory Extraction Engine

#### [NEW] [chatStorage.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/chatStorage.service.ts)
- Implement `saveMessage()`, `getSessions()`, `getMessagesBySession()`, `getOrCreateDailySession()`, and `generateSessionSummary()`.
- Automatically persists chat turns to MongoDB Atlas under daily session keys.

#### [MODIFY] [memory.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/memory.service.ts)
- Implement scalable query engine:
  - `getActiveMemories(currentDate)`: Retrieves active **Long-Term** items and active **Medium-Term** items where `validUntil >= currentDate`.
  - `queryMemoriesByTagsOrCategory(tags, category)`: Flexible query method supporting any future dynamic memory types or categories.
- Automatic status update: transitions expired medium-term items to `status: 'expired'`.

#### [MODIFY] [memoryExtractor.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/memoryExtractor.ts)
- Extractor classifies memories into:
  - **Medium-Term**: Dated exams (e.g., NPTEL exam on Sunday), weekly assignments, upcoming deadlines with calculated `validUntil` date.
  - **Long-Term**: Recurring commitments ("Coders High meeting"), relationships, breakup / emotional preferences, core interests, with flexible `metadata`.

#### [MODIFY] [ai.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/ai.service.ts)
- Integrate `chatStorageService` to load active session history by session date/ID.
- Format active **Medium-Term** context (current week focus) and **Long-Term** profile context into AI System Prompt.
- Silently update daily conversation history in MongoDB Atlas on every turn.

#### [MODIFY] [chat.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/chat.router.ts)
- Expose `/api/chat/sessions` and `/api/chat/sessions/:sessionId/messages` routes.

---

### Desktop Frontend UI

#### [MODIFY] [api/client.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/api/client.ts)
- Add API functions to fetch chat sessions, load session messages by date, and fetch tiered memories.

#### [MODIFY] [FloatingAIPanel.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/FloatingAIPanel.tsx)
- Add a **Session Date Selector / History Menu** in header (`📅 Daily Sessions`).
- Support viewing past dated sessions (e.g., *Sep 16, 2026*, *Sep 17, 2026*) and continuing the chat seamlessly from any selected date.
- Add a **Memory Status Pill / Drawer** displaying active Medium-Term items (e.g., *NPTEL Exam - Sep 20*) and Long-Term profile facts.

---

## Verification Plan

### Automated Tests
- Run `npm run bundle:desktop` to verify 0 TypeScript compilation errors.

### Manual Verification
1. **Daily Chat Storage**:
   - Send chat messages today (`Sep 17`). Open Atlas / test endpoint to verify messages are stored in MongoDB Atlas under `session_2026-09-17`.
   - Select a past date session from the UI date dropdown; verify past chat messages load cleanly and new responses append to that session.
2. **Medium-Term Memory (Expiration & Exam Reminders)**:
   - Type *"I have NPTEL exam this Sunday Sept 20"*.
   - Verify `MemoryExtractor` extracts a Medium-Term memory with `validUntil: '2026-09-20'`.
   - Ask AI *"Plan my day"* during the week: verify AI reminds user of NPTEL exam and schedules study time.
   - Advance date past Sept 20: verify NPTEL exam memory expires (`status: 'expired'`) and no longer impacts long-term planning.
3. **Long-Term Personal Memory (Meetings & Sensitivity)**:
   - Type *"I have Coders High meeting every day"* and *"If I ever feel down or go through a breakup, suggest supportive movies"*.
   - Verify long-term memory stores these permanently in MongoDB Atlas with metadata.
   - Ask AI to plan day: verify AI automatically allocates space for Coders High meeting every day.
