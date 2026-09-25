# BYOK-Based Personal AI Task Assistant

A cross-platform (Mobile & Desktop) AI-powered personal task manager built with React, Vite, Tailwind CSS, Tauri v2, and MongoDB Atlas.

---

> [!WARNING]
> **Archival Notice: External Node.js/Express Backend Attempt**
> This repository represents a **failed architectural attempt** at relying on an external Node.js/Express REST server process for mobile and desktop sync.
> 
> ### Why the External Express Backend Failed:
> 1. **Android Networking Friction**: Android WebViews require dynamic IP configurations (`http://10.0.2.2:3001/api` for emulators, local Wi-Fi IPs for physical devices) resulting in frequent `net::ERR_CONNECTION_REFUSED` errors when changing network interfaces.
> 2. **Network Switching Fragility**: Swapping Wi-Fi networks or switching to 5G/LTE sever TCP sockets (`ECONNRESET`) to MongoDB Atlas, requiring external public tunnels (`localtunnel` / Cloudflare Tunnels) or cloud hosting to remain accessible.
> 3. **Process Management Overhead**: Requiring a separate Node.js server to run alongside native mobile apps defeats the native, self-contained mobile experience.

---

## 🚀 Future Roadmap: Native Rust Backend Migration

The application backend is being **migrated natively to Rust** (`src-tauri/src`) embedded directly within Tauri v2:

1. **Embedded Native Binary**: Rust code compiles directly into the Android shared library (`libapp_lib.so` inside the APK) and Desktop binary.
2. **In-Process Native IPC (`invoke()`)**: Replaces external HTTP API requests with native Tauri IPC commands (`invoke('get_tasks')`, `invoke('chat_with_ai')`), eliminating HTTP port bindings, network latency, and IP configuration issues.
3. **Native Rust MongoDB & OpenRouter Integration**: Utilizing official async Rust crates (`mongodb`, `tokio`, `reqwest`, `serde`) directly on the device for 100% self-contained, 24/7 offline and online execution.

---

## 📱 Current Features (Frontend & UI)
- **Bring Your Own Key (BYOK)**: Supports user-provided OpenRouter and Gemini API keys.
- **Mobile & Desktop UI**: Sleek dark-mode interface with task lists, subtask management, long-term goals, and AI memory tiers.
- **Autonomous AI Agent**: LangGraph-inspired agent state machine with automated tool execution (`get_today_agenda`, `create_task`, `auto_memory_extraction`).
- **MongoDB Atlas Integration**: Direct data model mapping for Tasks, TaskLists, Goals, Memories, and Chat Sessions.

---

## 🛠 Project Structure
```
├── apps/
│   └── desktop/          # Frontend React app & Tauri v2 native mobile/desktop app
├── backend/              # Node.js Express server (Legacy attempt - being migrated to Rust)
├── packages/
│   └── shared-types/     # Shared TypeScript interfaces & data models
├── app-debug.apk         # Compiled Android debug APK
└── render.yaml           # Legacy cloud deployment configuration
```
