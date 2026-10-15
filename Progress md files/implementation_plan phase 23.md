# Implementation Plan - Phase 23: Application Update & Schema Migration System

This plan details **Phase 23** of the **Personal AI Task Manager**, implementing versioned database schema migrations, automated startup migration checks, and backup/restore utilities per Section 15 of the architectural specification.

---

## Technical Approach & Architecture

```
+-------------------------------------------------------------------------+
|                  SCHEMA MIGRATION & BACKUP ARCHITECTURE                 |
|                                                                         |
|   Server Startup                                                        |
|         |                                                               |
|         v                                                               |
|   Connect to DB -> Check SchemaVersion Collection                       |
|                           |                                             |
|                           v                                             |
|            Current Schema Version < TARGET_VERSION?                      |
|                     /                   \                               |
|               (Yes) /                     \ (No)                        |
|                    v                       v                            |
|       Run Versioned Migrations     Skip (Up-to-date)                    |
|       (v1 -> v2 -> v3 ...)                                              |
|                    |                                                    |
|                    v                                                    |
|       Update SchemaVersion Doc                                          |
+-------------------------------------------------------------------------+
```

---

## Proposed Changes

### Database Migration Engine (`backend/src/db/`)
#### [NEW] [backend/src/db/models/SchemaVersion.model.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/models/SchemaVersion.model.ts)
- Mongoose schema for tracking current database `schemaVersion`, last migrated timestamp, and migration history.

#### [NEW] [backend/src/db/migrationManager.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/db/migrationManager.ts)
- `MigrationManager` executing sequential migrations (`v1_to_v2`, `v2_to_v3`) with rollback protection and backup export/restore functions (`exportBackup`, `restoreBackup`).

#### [MODIFY] [backend/src/server.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/server.ts)
- Execute `MigrationManager.runMigrations()` on backend startup.

---

### Migration & Backup API Router (`backend/src/routes/`)
#### [MODIFY] [backend/src/routes/settings.router.ts](file:///home/rohith/Documents/AI%20Task%20Manager/backend/src/routes/settings.router.ts)
- Add endpoints `GET /api/settings/migration-status`, `GET /api/settings/backup`, and `POST /api/settings/restore`.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Test startup schema version check and migration execution logs.
- Test export backup download and JSON restoration endpoints.
