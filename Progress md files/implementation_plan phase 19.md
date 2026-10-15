# Implementation Plan - Phase 19: Desktop Packaging & Automatic Backend Startup Manager

This plan details **Phase 19** of the **Personal AI Task Manager**, implementing desktop packaging and automatic background service startup per Section 12 of the architecture specification.

---

## Technical Approach & Desktop Launcher Architecture

Per Section 12, **the user must never be required to manually open a terminal or start the backend**:

```
Double-Click Desktop Application Icon
                 |
                 v
      Desktop Application Boot
                 |
                 v
   Automatic Service Launcher
(Spawns local Express Backend process on Port 3001)
                 |
                 v
   React Desktop Window Renders
(Connects instantly to http://localhost:3001/api)
```

### Automatic Service Manager Features
1. **Background Process Manager**:
   - `DesktopLauncher` script checking port 3001 availability and automatically starting Node.js backend.
   - Clean shutdown handler ensuring background process terminates when desktop app closes.
2. **Desktop Packaging Scripts**:
   - Monorepo desktop build and runner scripts (`npm run start:desktop`).

---

## Proposed Changes

### Desktop App Service Launcher
#### [NEW] [apps/desktop/src/native/desktopLauncher.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/native/desktopLauncher.ts)
- Automatic process launcher verifying backend service health and spawning background server if not already running.

#### [MODIFY] [apps/desktop/src/main.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/main.tsx)
- Trigger `desktopLauncher.ensureBackendRunning()` on React app startup.

#### [MODIFY] [package.json](file:///home/rohith/Documents/AI%20Task%20Manager/package.json)
- Add monorepo root single-command launcher: `"start:desktop": "concurrently \"npm run dev:backend\" \"npm run dev:desktop\""`.

---

## Verification Plan

### Automated Tests
- Install `concurrently` in root: `npm install -D concurrently`
- Build backend & desktop: `npm run build:backend && npm run build:desktop`

### Manual Verification
- Execute desktop startup script and verify local Express backend and React UI boot simultaneously with 1 double-click trigger.
