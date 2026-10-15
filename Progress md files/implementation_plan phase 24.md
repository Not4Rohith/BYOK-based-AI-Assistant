# Implementation Plan - Phase 24: AI Productivity Analytics & Insights Engine

This plan details **Phase 24** of the **Personal AI Task Manager**, implementing real-time productivity analytics, task velocity metrics, estimation accuracy scoring, and an interactive AI Productivity Insights Dashboard in the Desktop app.

---

## Technical Approach & Architecture

```
+------------------------------------------------------------------------+
|                     PRODUCTIVITY ANALYTICS ENGINE                      |
|                                                                        |
|   Tasks, Goals & Routines                                              |
|            |                                                           |
|            v                                                           |
|   Analytics Engine (backend/src/services/analytics.service.ts)        |
|   - Task Completion Rate & Velocity                                    |
|   - Time Estimation Accuracy (Estimated vs Actual Minutes)             |
|   - Goal Milestone Progress Rate                                       |
|   - Peak Productivity Hour Detection                                   |
|            |                                                           |
|            v                                                           |
|   AI Personal Productivity Coach                                       |
|   - Generates tailored daily habits & schedule optimization tips       |
|            |                                                           |
|            v                                                           |
|   Desktop UI (ANALYTICS View)                                          |
|   - Productivity Scorecard, Charts, and AI Coaching Cards              |
+------------------------------------------------------------------------+
```

---

## Proposed Changes

### Backend Analytics & AI Coaching Engine (`backend/src/services/`)
#### [NEW] [backend/src/services/analytics.service.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/services/analytics.service.ts)
- Computes overall productivity score, completion rates by priority, estimation accuracy ratio, and generates personalized AI daily productivity insights.

#### [NEW] [backend/src/routes/analytics.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/analytics.router.ts)
- REST router exposing `GET /api/analytics/summary` and `POST /api/analytics/coaching`.

#### [MODIFY] [backend/src/server.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/server.ts)
- Register `/api/analytics` router.

---

### Desktop Analytics Component (`apps/desktop/src/`)
#### [NEW] [apps/desktop/src/components/AnalyticsView.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/components/AnalyticsView.tsx)
- Premium UI component displaying Productivity Score (0–100), Task Velocity, Estimation Accuracy, Goal Progress, and AI Coaching Insights.

#### [MODIFY] [apps/desktop/src/App.tsx](file:///home/rohith/Documents/AI%20Task%20Manager/apps/desktop/src/App.tsx)
- Integrate `ANALYTICS` navigation view option.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Test `GET /api/analytics/summary` and verify productivity score calculation.
- Launch `npm run start:desktop` to view the new **ANALYTICS** view and verify UI rendering.
