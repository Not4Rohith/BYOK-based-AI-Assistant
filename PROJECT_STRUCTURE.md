# Personal AI Task Manager — Complete Project Structure Map

This document provides a complete blueprint of the directory hierarchy, core modules, components, services, and data flow across the monorepo workspace.

---

## 📂 Root Workspace Architecture

```
/home/rohith/Documents/AI Task Manager/
├── apps/
│   └── desktop/                  # Combined Mobile & Desktop Frontend (React + Tauri v2)
├── backend/                      # Express REST API, AI Agent Engine & Database Layer
├── packages/
│   └── shared-types/             # Shared TypeScript interfaces & domain data models
├── render.yaml                   # Cloud deployment blueprint for Render.com
├── PROJECT_STRUCTURE.md          # File structure documentation (this file)
├── README.md                     # Project summary & Rust backend migration roadmap
├── MOBILE_BUILD_AND_DEBUG_LOG.md # Historical mobile build & debug tractions
└── package.json                  # Root monorepo workspace configurations
```

---

## 📱 `apps/desktop/` — Mobile & Desktop Frontend (React + Tauri v2)

The frontend application provides a sleek UI designed to operate on both desktop and mobile platforms.

```
apps/desktop/
├── src/
│   ├── api/
│   │   ├── client.ts             # API Client with dynamic network fallbacks & candidate host resolution
│   │   └── offlineCache.ts       # LocalStorage cache manager & mutation queue for offline sync
│   ├── components/
│   │   ├── GoogleTasksMobileView.tsx # Primary mobile task list view with tab navigation
│   │   ├── GoogleTaskDetailsMobileScreen.tsx # Mobile task detail editor
│   │   ├── SettingsView.tsx      # App settings (OpenRouter API keys, MongoDB URI, Model selection)
│   │   ├── FullScreenChat.tsx    # Full-screen interactive AI chat view
│   │   ├── AITaskbar.tsx         # AI prompt launcher & floating assistant toolbar
│   │   └── MemoryView.tsx        # Structured short, medium, and long-term memory inspector
│   ├── native/
│   │   └── desktopLauncher.ts    # Native desktop backend process boot controller
│   ├── App.tsx                   # Main React entrypoint & router controller
│   └── main.tsx                  # Vite React mounting root
└── src-tauri/                    # Tauri v2 Native Cross-Platform Shell
    ├── Cargo.toml                # Rust dependencies & binary targets
    ├── tauri.conf.json           # Tauri v2 shell config (Window bounds, permissions, bundles)
    ├── src/
    │   ├── lib.rs                # Tauri entrypoint & native command registration
    │   └── main.rs               # Native desktop binary launcher
    └── gen/
        └── android/              # Native Android Studio project wrapper
            ├── app/
            │   ├── src/main/
            │   │   └── AndroidManifest.xml # Android permissions, cleartext traffic & back callbacks
            │   └── build.gradle.kts    # Android Gradle configuration
            └── build.gradle.kts
```

---

## ⚙️ `backend/` — Express API, AI Agent Engine & Database Layer

The backend manages data persistence in MongoDB Atlas, LangGraph AI orchestration, tool execution, and dynamic model fetching.

```
backend/
├── data/
│   └── ai-config.json            # Dynamic AI & DB settings storage (No hardcoded credentials)
├── src/
│   ├── ai/
│   │   ├── langgraph.agent.ts    # LangGraph-inspired Agent State Machine (Agent -> Tools -> Agent)
│   │   ├── provider-manager.ts   # Multi-provider model ranking and fallback manager
│   │   └── providers/
│   │       ├── openrouter.provider.ts # OpenRouter API LLM completion driver
│   │       └── gemini.provider.ts     # Google Gemini API LLM completion driver
│   ├── db/
│   │   ├── connection.ts         # Resilient Mongoose connection manager with auto-reconnect listeners
│   │   ├── migrationManager.ts   # MongoDB schema versioning & migration runner (v4)
│   │   └── models/
│   │       ├── Task.model.ts          # Mongoose schema for Tasks & Subtasks
│   │       ├── TaskList.model.ts      # Mongoose schema for Task Lists / Categories
│   │       ├── Goal.model.ts          # Mongoose schema for Goals & Milestones
│   │       ├── Memory.model.ts        # Mongoose schema for Memory Tiers & Extracted Context
│   │       ├── ChatMessage.model.ts   # Mongoose schema for Chat Messages & Tool Execution Logs
│   │       ├── ChatSession.model.ts   # Mongoose schema for Daily Chat Sessions
│   │       ├── AIAgentGoal.model.ts   # Mongoose schema for Autonomous AI Agent Goals
│   │       └── User.model.ts          # Mongoose schema for User Accounts & Preferences
│   ├── routes/
│   │   ├── tasks.router.ts       # Task CRUD endpoints (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
│   │   ├── taskLists.router.ts   # List CRUD endpoints
│   │   ├── goals.router.ts       # Goals & Milestones endpoints
│   │   ├── memory.router.ts      # Tiered memory management endpoints
│   │   ├── chat.router.ts        # Chat messaging & daily session history endpoints
│   │   ├── models.router.ts      # Live model fetching endpoints from OpenRouter/Gemini
│   │   ├── settings.router.ts    # App configuration & backup/restore endpoints
│   │   ├── analytics.router.ts   # Productivity metrics & summary endpoints
│   │   └── sync.routes.ts        # Offline mutation flush & sync endpoints
│   ├── services/
│   │   ├── ai.service.ts         # Central AI orchestration service & memory extractor integration
│   │   ├── task.service.ts       # Task business logic & MongoDB Atlas persistence
│   │   ├── goal.service.ts       # Goal & milestone progress tracking service
│   │   ├── memory.service.ts     # Tiered memory CRUD service
│   │   ├── memoryExtractor.ts    # Heuristic & LLM rule-based atomic memory extraction
│   │   ├── planning.service.ts   # Re-planning & schedule optimization engine
│   │   ├── chatStorage.service.ts# Daily session message storage service
│   │   └── aiAgentRunner.ts      # Autonomous background loop for scheduled AI Agent Goals
│   └── server.ts                 # Express server bootstrap & router binder (`0.0.0.0:3001`)
└── package.json
```

---

## 📦 `packages/shared-types/` — Domain Types & Interfaces

Shared TypeScript type definitions imported by both frontend and backend packages:

```
packages/shared-types/
├── src/
│   └── index.ts                  # `Task`, `Subtask`, `TaskList`, `Goal`, `Memory`, `ChatMessage`, `AIProviderConfig`, `ProductivityAnalytics`
└── package.json
```
