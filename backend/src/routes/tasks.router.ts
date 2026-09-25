import { Router, Request, Response } from 'express';
import { TaskService } from '../services/task.service.js';

export function createTasksRouter(taskService: TaskService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const tasks = await taskService.getAllTasks();
    res.json({ success: true, data: tasks });
  });

  router.post('/', async (req: Request, res: Response) => {
    const newTask = await taskService.createTask(req.body);
    res.status(201).json({ success: true, data: newTask });
  });

  router.put('/:id', async (req: Request, res: Response) => {
    const updated = await taskService.updateTask(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: updated });
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    const updated = await taskService.updateTask(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: updated });
  });

  router.patch('/:id/toggle', async (req: Request, res: Response) => {
    const updated = await taskService.toggleTask(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: updated });
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    const deleted = await taskService.deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, message: 'Task deleted successfully', data: { message: 'Task deleted successfully' } });
  });

  // Subtask endpoints
  router.post('/:id/subtasks', async (req: Request, res: Response) => {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, error: 'Subtask title is required' });
    }
    const updated = await taskService.addSubtask(req.params.id, title);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: updated });
  });

  router.patch('/:id/subtasks/:subtaskId/toggle', async (req: Request, res: Response) => {
    const updated = await taskService.toggleSubtask(req.params.id, req.params.subtaskId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task or subtask not found' });
    }
    res.json({ success: true, data: updated });
  });

  router.delete('/:id/subtasks/:subtaskId', async (req: Request, res: Response) => {
    const updated = await taskService.deleteSubtask(req.params.id, req.params.subtaskId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task or subtask not found' });
    }
    res.json({ success: true, data: updated });
  });

  return router;
}
