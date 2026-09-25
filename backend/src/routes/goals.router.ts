import { Router, Request, Response } from 'express';
import { GoalService } from '../services/goal.service.js';

export function createGoalsRouter(goalService: GoalService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const goals = await goalService.getGoals();
    res.json({ success: true, data: goals });
  });

  router.get('/agent-goals', async (_req: Request, res: Response) => {
    const { aiAgentGoalService } = await import('../services/aiAgentGoal.service.js');
    const agentGoals = await aiAgentGoalService.getAllAgentGoals();
    res.json({ success: true, data: agentGoals });
  });

  router.post('/', async (req: Request, res: Response) => {
    const goal = await goalService.createGoal(req.body);
    res.status(201).json({ success: true, data: goal });
  });

  router.patch('/:id/milestones/:milestoneId/toggle', async (req: Request, res: Response) => {
    const updated = await goalService.toggleMilestone(req.params.id, req.params.milestoneId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Goal or milestone not found' });
    }
    res.json({ success: true, data: updated });
  });

  return router;
}
