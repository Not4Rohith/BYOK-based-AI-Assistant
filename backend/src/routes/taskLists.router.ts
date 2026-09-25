import { Router, Request, Response } from 'express';
import { taskListService } from '../services/taskList.service.js';

export function createTaskListsRouter(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const lists = await taskListService.getAllLists();
      res.json({ success: true, data: lists });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to fetch task lists' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, error: 'Task list title is required' });
      }
      const newList = await taskListService.createList(title);
      res.status(201).json({ success: true, data: newList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to create task list' });
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const updated = await taskListService.updateList(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Task list not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to update task list' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const updated = await taskListService.updateList(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Task list not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to update task list' });
    }
  });

  router.delete('/:idOrTitle', async (req: Request, res: Response) => {
    try {
      const result = await taskListService.deleteListAndTasks(req.params.idOrTitle);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to delete task list' });
    }
  });

  return router;
}
