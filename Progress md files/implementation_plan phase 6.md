# Implementation Plan - Phase 6: Google Calendar Synchronization

This plan details **Phase 6** of the **Personal AI Task Manager**, implementing Google Calendar timeblock synchronization per Sections 32, 35, 36, and 37 of the architecture specification.

---

## Technical Approach & Architecture

Unlike Google Tasks (which only supports due dates), **Google Calendar represents exact scheduled time blocks**:

```json
{
  "title": "Study DSA - Graph Algorithms",
  "scheduledStart": "2026-09-15T18:00:00+05:30",
  "scheduledEnd": "2026-09-15T19:30:00+05:30"
}
```

Google Calendar Sync Rules:
1. **Timeblock Event Sync**: When AI or user schedules a task with `scheduledStart` and `scheduledEnd`, create or update the corresponding Google Calendar event.
2. **Replan & Move Updates**: When the AI replans the day or moves a task, automatically update the Google Calendar event timestamps.
3. **Task Removal**: When a task is unscheduled or deleted, delete or mark the corresponding Google Calendar event.
4. **Calendar Metadata**:
   ```typescript
   calendar: {
     eventId: string | null;
     calendarId: string | null; // "primary"
     lastSyncedAt: string | null;
     syncStatus: 'synced' | 'pending' | 'failed' | 'not_connected';
   }
   ```

---

## Proposed Changes

### Backend Service Layer
#### [NEW] [backend/src/services/googleCalendar.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/googleCalendar.service.ts)
- Service handling Google Calendar API timeblock operations: `syncEvent(task)`, `deleteEvent(eventId)`, `syncAllEvents(tasks)`.

#### [MODIFY] [backend/src/routes/google.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/google.router.ts)
- Add endpoints:
  - `GET /api/google/calendar/status`
  - `POST /api/google/calendar/sync`

#### [MODIFY] [backend/src/services/planning.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/planning.service.ts) & [task.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/task.service.ts)
- Trigger Google Calendar timeblock synchronization whenever tasks are scheduled, moved, or replanned.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Replan day in Today / Chat view and verify `calendar.lastSyncedAt` & `calendar.syncStatus` update for all scheduled tasks.
- Verify exact timeblock start and end timestamps match between MongoDB tasks and Calendar events.
