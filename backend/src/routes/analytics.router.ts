import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';

export function createAnalyticsRouter(analyticsService: AnalyticsService): Router {
  const router = Router();

  router.get('/summary', async (_req: Request, res: Response) => {
    try {
      const summary = await analyticsService.getProductivityAnalytics();
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to fetch analytics' });
    }
  });

  return router;
}
