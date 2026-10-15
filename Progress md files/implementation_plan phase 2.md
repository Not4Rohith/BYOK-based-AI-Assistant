# Implementation Plan - Phase 2: Node + Express Local Backend

This plan details **Phase 2** of the **Personal AI Task Manager**, implementing the local Node.js + Express backend service per Sections 60–65 of the specification.

---

## Technical Architecture for Phase 2

### Backend Location & Package
The local Express backend will reside in `backend/` as part of our monorepo:

```
/home/rohith/Documents/AI Task Manager/
├── backend/
│   ├── src/
│   │   ├── server.ts            # Main Express server entry point (Port 3001)
│   │   ├── config/              # Environment & local storage paths
│   │   ├── routes/              # Express API router modules
│   │   │   ├── tasks.router.ts
│   │   │   ├── goals.router.ts
│   │   │   ├── routines.router.ts
│   │   │   ├── memory.router.ts
│   │   │   ├── planning.router.ts
│   │   │   ├── chat.router.ts
│   │   │   ├── google.router.ts
│   │   │   └── settings.router.ts
│   │   └── services/            # Service layer (In-memory/local JSON store for Phase 2, MongoDB integration in Phase 3)
│   │       ├── task.service.ts
│   │       ├── goal.service.ts
│   │       ├── routine.service.ts
│   │       ├── memory.service.ts
│   │       ├── planning.service.ts
│   │       ├── sync.service.ts
│   │       └── ai.service.ts
│   ├── package.json
│   └── tsconfig.json
```

---

## Proposed Changes

### Backend Package Setup
#### [NEW] [backend/package.json](file:///home/rohith/Documents/AI%20Task%20Manager/backend/package.json)
- Express, cors, dotenv, tsx/ts-node-dev for development runtime, importing `@ai-task-manager/shared-types`.

#### [NEW] [backend/tsconfig.json](file:///home/rohith/Documents/AI%20Task%20Manager/backend/tsconfig.json)
- TypeScript configuration with workspace path aliases.

### Express Server & Routers
#### [NEW] [backend/src/server.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/server.ts)
- Express app setup with JSON middleware, CORS enabled for desktop app (port 3000), error handling middleware, and route registrations.

#### [NEW] [backend/src/services/*](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services)
- In-memory & local persistence services implementing CRUD operations for Tasks, Goals, Routines, Memories, Chat Messages, and Settings.

#### [NEW] [backend/src/routes/*](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes)
- Thin route controllers exposing REST endpoints:
  - `GET /api/tasks`, `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`, `PATCH /api/tasks/:id/toggle`
  - `GET /api/goals`, `POST /api/goals`, `PATCH /api/goals/:id/milestones`
  - `GET /api/routines`, `POST /api/routines`
  - `GET /api/memory`, `POST /api/memory`, `DELETE /api/memory/:id`
  - `POST /api/planning/replan`, `POST /api/planning/generate`
  - `GET /api/chat`, `POST /api/chat`
  - `GET /api/settings`, `POST /api/settings`

### Desktop App Client API Integration
#### [NEW] [apps/desktop/src/api/client.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/api/client.ts)
- HTTP client connecting React desktop frontend to local Express backend (`http://localhost:3001/api`).

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build --workspace=backend`
- Start local server test script: verify `http://localhost:3001/api/health` returns `200 OK`

### Manual Verification
- Test all API endpoints (`/api/tasks`, `/api/memory`, `/api/goals`, `/api/chat`, `/api/settings`) using fetch requests.
- Verify desktop frontend communicates seamlessly with local Express backend.
