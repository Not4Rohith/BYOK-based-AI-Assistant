import { Router, Request, Response } from 'express';
import { PlanningService } from '../services/planning.service.js';
import { TaskService } from '../services/task.service.js';

export function createPlanningRouter(
  planningService: PlanningService,
  taskService: TaskService
): Router {
  const router = Router();

  router.post('/generate', async (_req: Request, res: Response) => {
    const currentTasks = await taskService.getAllTasks();
    const result = planningService.generateDailyPlan(currentTasks);
    res.json({ success: true, data: result });
  });

  router.post('/replan', async (_req: Request, res: Response) => {
    const currentTasks = await taskService.getAllTasks();
    const updatedTasks = planningService.replanDay(currentTasks);
    res.json({ success: true, data: updatedTasks });
  });

  return router;
}
