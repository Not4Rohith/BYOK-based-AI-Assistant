import { Router, Request, Response } from 'express';
import { googleTasksService } from '../services/googleTasks.service.js';
import { googleCalendarService } from '../services/googleCalendar.service.js';
import { TaskService } from '../services/task.service.js';

export function createGoogleRouter(taskService?: TaskService): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        googleTasks: googleTasksService.getStatus(),
        googleCalendar: googleCalendarService.getStatus(),
      },
    });
  });

  router.post('/tasks/sync', async (_req: Request, res: Response) => {
    if (!taskService) {
      return res.status(500).json({ success: false, error: 'TaskService unavailable' });
    }
    const currentTasks = await taskService.getAllTasks();
    const syncedTasks = await googleTasksService.syncAll(currentTasks);
    res.json({ success: true, data: syncedTasks });
  });

  router.post('/calendar/sync', async (_req: Request, res: Response) => {
    if (!taskService) {
      return res.status(500).json({ success: false, error: 'TaskService unavailable' });
    }
    const currentTasks = await taskService.getAllTasks();
    const syncedTasks = await googleCalendarService.syncAllEvents(currentTasks);
    res.json({ success: true, data: syncedTasks });
  });

  router.post('/oauth/connect', (req: Request, res: Response) => {
    const { provider } = req.body;
    if (provider === 'googleTasks') {
      googleTasksService.setConnected(true);
    }
    res.json({
      success: true,
      message: `Google ${provider || 'OAuth'} connected successfully`,
      data: {
        googleTasks: googleTasksService.getStatus(),
        googleCalendar: googleCalendarService.getStatus(),
      },
    });
  });

  return router;
}
