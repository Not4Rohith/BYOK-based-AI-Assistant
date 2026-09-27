# BYOK-Based Personal AI Task Assistant

A cross-platform (Desktop & Mobile) AI-powered personal task manager and agentic assistant built with React, Vite, Tailwind CSS, Tauri v2, LangChain/LangGraph, Laya and MongoDB Atlas.

---

## ⚡ Future Roadmap: High-Performance Rust Core Coming Soon!
A **higher-performance, native Rust-powered version** (`src-tauri/src`) is currently under active development. It will embed the backend engine, native IPC commands (`invoke()`), and async database/AI clients directly into the native binary for zero-latency, ultra-lightweight execution across Desktop and Mobile!

---

## 🚀 Key Features

- **Bring Your Own Key (BYOK)**: Full control over your AI provider credentials (OpenRouter, Gemini, Grok).
- **Laya Decision Router**: Fast, token-efficient AI decision router that dynamically selects relevant tools and prompt modules (`SINGLE_TOOL`, `SIMPLE_LLM`, `AGENT`).
- **One-Time Transient Scratchpad**: Token-efficient confirmation flows (e.g., bulk task deletion, high-risk operations) without wasting chat tokens on heavy history dumps.
- **Autonomous AI Agent**: LangGraph-inspired agent engine with tool calling (`get_tasks`, `get_lists`, `create_task`, `complete_task`, `delete_all_tasks`, `replan_day`, `auto_memory_extraction`).
- **Dynamic Model Selection**: Select any AI model dynamically (OpenRouter, Gemini, Grok) directly in the app.
- **MongoDB Atlas Integration**: Cloud sync for tasks, categories, goals, long-term memories, and chat sessions.

---

## 🛠️ Setup & Deployment Guide

Follow this guide to host your backend and configure the application settings directly within the app UI.

### Step 1: Host the Backend (e.g., on Render)

You can easily host the backend on [Render](https://render.com) or any Node.js hosting platform.

1. **Repository Link**: Fork or push this repository to GitHub.
2. **Create New Web Service**:
   - Log in to your Render Dashboard.
   - Click **New +** -> **Web Service**.
   - Connect your GitHub repository.
3. **Build & Start Commands**:
   - **Environment**: Node
   - **Build Command**: `npm run build:backend`
   - **Start Command**: `npm run dev:backend` (or `node backend/dist/server.js`)
4. **Deployed Backend URL**:
   - Render will provide a public HTTPS URL (e.g., `https://your-app-backend.onrender.com`).

---

### Step 2: Configure Settings Directly in the App UI

Launch the desktop or mobile application. Click the ⚙️ **Settings** tab in the sidebar to configure your connection strings and API credentials:

1. **Backend Server URL**:
   - Enter your deployed Render backend URI (e.g., `https://your-app-backend.onrender.com` or `http://localhost:3001` for local development).
2. **MongoDB Connection String**:
   - Add your MongoDB Atlas connection string (e.g., `mongodb+srv://user:password@cluster.mongodb.net/ai_task_manager`).
   - Click **Save Database Configuration**.
3. **API Keys (BYOK)**:
   - Enter your **OpenRouter API Key** (`sk-or-v1-...`), **Gemini API Key**, or **Grok API Key**.
4. **Model Selection**:
   - Select your preferred model directly from the dropdown (e.g., `google/gemini-2.5-flash`, `openrouter/free`, `anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.1-8b-instruct`).
5. **System Prompt & Daily Schedule**:
   - Customize your personal system prompt and working schedule directly inside the UI.

---

## 📂 Project Structure

```
├── apps/
│   └── desktop/          # Frontend React app & Tauri v2 native application
├── backend/              # Node.js backend service (Express, LangChain, MongoDB)
├── packages/
│   └── shared-types/     # Shared TypeScript interfaces & data models
├── render.yaml           # Cloud deployment configuration for Render
└── README.md
```

---

## 💻 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Desktop & Backend Concurrently**:
   ```bash
   npm run start:desktop
   ```

3. **Build Desktop & Backend Binaries**:
   ```bash
   npm run bundle:desktop
   ```
