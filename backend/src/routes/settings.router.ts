import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai.service.js';
import { TaskService } from '../services/task.service.js';
import { GoalService } from '../services/goal.service.js';
import { MemoryService } from '../services/memory.service.js';
import { migrationManager, MigrationManager } from '../db/migrationManager.js';

export function createSettingsRouter(
  aiService: AIService,
  taskService: TaskService,
  goalService: GoalService,
  memoryService: MemoryService
): Router {
  const router = Router();

  router.get('/config', (_req: Request, res: Response) => {
    res.json({ success: true, data: aiService.getConfig() });
  });

  router.post('/config', (req: Request, res: Response) => {
    const updated = aiService.updateConfig(req.body);
    res.json({ success: true, data: updated });
  });

  router.get('/migration-status', async (_req: Request, res: Response) => {
    const status = await migrationManager.runMigrations();
    res.json({
      success: true,
      data: {
        targetVersion: MigrationManager.CURRENT_SCHEMA_VERSION,
        currentVersion: status.currentVersion,
        migrated: status.migrated,
      },
    });
  });

  router.get('/backup', async (_req: Request, res: Response) => {
    const backup = await migrationManager.exportBackup(taskService, goalService, memoryService);
    res.json({ success: true, data: backup });
  });

  router.post('/restore', async (req: Request, res: Response) => {
    const ok = await migrationManager.restoreBackup(req.body, taskService);
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Invalid backup payload' });
    }
    res.json({ success: true, message: 'Database state restored successfully', data: { restored: true } });
  });

  return router;
}
