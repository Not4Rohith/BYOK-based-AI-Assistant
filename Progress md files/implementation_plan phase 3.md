# Implementation Plan - Phase 3: MongoDB Atlas Integration

This plan details **Phase 3** of the **Personal AI Task Manager**, implementing MongoDB Atlas database persistence per Sections 9, 52, and 53 of the architecture specification.

---

## Technical Approach & Architecture

MongoDB Atlas serves as the primary source of truth for persistent application data and cross-device synchronization between Laptop and Mobile.

```
+-----------------------------------------------------------+
|                    DESKTOP / MOBILE                       |
|           Local Secure Credential Storage                 |
|             (MongoDB URI, BYOK AI Keys)                   |
+-----------------------------+-----------------------------+
                              |
                              v
                Local Node.js / Express Backend
                              |
                              v
                  MongoDB Connection Manager
                              |
                              v
                     MongoDB Atlas Cloud
   +---------------+---------------+---------------+
   |               |               |               |
   v               v               v               v
 collections:    tasks           goals          memories
 users           routines        schedules      syncMetadata
```

> [!IMPORTANT]
> **Security Rule**: API keys and OAuth secrets belong on the user's device in local secure storage. MongoDB will store structured application data, never plain-text API secrets.

---

## Collections & Document Schemas

Per Sections 52 & 53, the following collections and schemas will be created:

1. **`users`**: User profiles (`name`, `timezone`), personal system prompt instructions (`systemPrompt`), and planning preferences.
2. **`tasks`**: Task items with priority, estimated minutes, scheduled start/end dates, recurrence rules, and Google Tasks/Calendar sync metadata.
3. **`goals`**: Active goals, progress metrics, and milestone checklists.
4. **`routines`**: Fixed and flexible weekly routines.
5. **`memories`**: Inferred & explicit memories with importance, source, category, and status.
6. **`schedules`**: Generated daily schedule versions and timeblock items.

---

## Proposed Changes

### Backend Database Infrastructure
#### [NEW] [backend/src/db/connection.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/connection.ts)
- Database connection manager using Mongoose / MongoDB Native client. Supports fallback to memory store if no URI configured.

#### [NEW] [backend/src/db/models/Task.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/Task.model.ts)
- Mongoose schema for `tasks` collection with compound indexes (`userId + status`, `userId + scheduledStart`).

#### [NEW] [backend/src/db/models/Goal.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/Goal.model.ts)
- Mongoose schema for `goals` collection.

#### [NEW] [backend/src/db/models/Memory.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/Memory.model.ts)
- Mongoose schema for `memories` collection with category filtering indexes.

#### [NEW] [backend/src/db/models/User.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/User.model.ts)
- Mongoose schema for `users` collection.

### Backend Services Update
#### [MODIFY] [backend/src/services/task.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/task.service.ts)
- Update `TaskService` to query and write to MongoDB Atlas when connected.

#### [MODIFY] [backend/src/services/goal.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/goal.service.ts)
- Update `GoalService` to query and write to MongoDB Atlas when connected.

#### [MODIFY] [backend/src/services/memory.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/memory.service.ts)
- Update `MemoryService` to query and write to MongoDB Atlas when connected.

---

## Verification Plan

### Automated Tests
- Install `mongoose` driver dependency in backend: `npm install mongoose`
- Run build check: `npm run build:backend`
- Connection test endpoint: `GET /api/health` returns MongoDB connection status (`connected` or `memory_fallback`).

### Manual Verification
- Test connection with a MongoDB Atlas URI (or local MongoDB URI `mongodb://localhost:27017/ai_task_manager`).
- Perform Task CRUD and check database records created in MongoDB.
