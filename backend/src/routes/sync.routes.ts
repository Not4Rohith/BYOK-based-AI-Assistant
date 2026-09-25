import { Router, Request, Response } from 'express';
import { SyncConflictResolver } from '../services/syncConflictResolver.js';
import { SyncFlushRequest } from '@ai-task-manager/shared-types';

export function createSyncRouter(syncResolver: SyncConflictResolver): Router {
  const router = Router();

  router.post('/flush', async (req: Request, res: Response) => {
    try {
      const flushReq: SyncFlushRequest = req.body || { mutations: [] };
      const result = await syncResolver.flushOfflineQueue(flushReq);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Sync flush failed' });
    }
  });

  return router;
}
