# Implementation Plan - Phase 5: Google Tasks Synchronization

This plan details **Phase 5** of the **Personal AI Task Manager**, implementing 2-way Google Tasks synchronization per Sections 34, 36, and 37 of the architecture specification.

---

## Architectural Rules for Google Tasks Integration

1. **MongoDB is Source of Truth**: External APIs are synchronized representations. Failure of Google Tasks API must never result in local task loss.
2. **Google OAuth 2.0**: Authentication uses Google OAuth rather than plain API keys. Credentials remain in local secure storage.
3. **Time-of-day Constraint**: Google Tasks API only supports due dates, not exact time-of-day schedules. The application manages exact times in MongoDB (and syncs timeblocks to Google Calendar in Phase 6).
4. **Sync Metadata & Status**:
   ```typescript
   google: {
     taskId: string | null;
     taskListId: string | null;
     lastSyncedAt: string | null;
     syncStatus: 'synced' | 'pending' | 'failed' | 'not_connected';
   }
   ```

---

## Proposed Changes

### Backend Service Layer
#### [NEW] [backend/src/services/googleTasks.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/googleTasks.service.ts)
- Service managing Google Tasks API integration: `syncTaskToGoogle`, `deleteTaskFromGoogle`, `fetchGoogleTasksList`, and OAuth status management.

#### [MODIFY] [backend/src/routes/google.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/google.router.ts)
- Add endpoints:
  - `GET /api/google/tasks/status`
  - `POST /api/google/tasks/sync` - Trigger manual or automatic background sync batch.
  - `POST /api/google/oauth/connect` - Google OAuth authentication flow handler.

#### [MODIFY] [backend/src/services/task.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/task.service.ts)
- Trigger Google Tasks sync automatically whenever a task is created, updated, toggled, or deleted.

### Desktop UI Enhancements
#### [MODIFY] [apps/desktop/src/components/Header.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/Header.tsx) & [TodayView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/TodayView.tsx)
- Display subtle Google Tasks sync status indicators on task items (`Synced`, `Sync Pending`, `Offline`).
- Provide Google OAuth connect button in Settings.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Trigger task creation and verify `google.syncStatus` sets to `synced` (or `pending` if offline).
- Verify task completion syncs to Google Tasks representation without affecting local task state.
