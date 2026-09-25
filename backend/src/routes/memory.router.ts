import { Router, Request, Response } from 'express';
import { MemoryService } from '../services/memory.service.js';

export function createMemoryRouter(memoryService: MemoryService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const memories = await memoryService.getMemories();
    res.json({ success: true, data: memories });
  });

  router.get('/tiered', async (_req: Request, res: Response) => {
    const tiered = await memoryService.getActiveMemories();
    res.json({ success: true, data: tiered });
  });

  router.post('/', async (req: Request, res: Response) => {
    const memory = await memoryService.createMemory(req.body);
    res.status(201).json({ success: true, data: memory });
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    const deleted = await memoryService.deleteMemory(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }
    res.json({ success: true, message: 'Memory deleted', data: { message: 'Memory deleted' } });
  });

  return router;
}
