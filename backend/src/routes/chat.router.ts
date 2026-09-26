import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai.service.js';
import { chatStorageService } from '../services/chatStorage.service.js';

export function createChatRouter(aiService: AIService): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const sessionId = (req.query.sessionId as string) || undefined;
    const msgs = await aiService.getMessages(sessionId);
    res.json({ success: true, data: msgs });
  });

  router.get('/sessions', async (_req: Request, res: Response) => {
    const sessions = await chatStorageService.getSessions();
    res.json({ success: true, data: sessions });
  });

  router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const msgs = await chatStorageService.getMessagesBySession(sessionId);
    res.json({ success: true, data: msgs });
  });

  router.get('/daily-summary', async (req: Request, res: Response) => {
    const { aiAgentRunner } = await import('../services/aiAgentRunner.js');
    const force = req.query.force === 'true';
    const summary = await aiAgentRunner.getOrGenerateDailySummary(force);
    res.json({ success: true, summary, data: { summary } });
  });

  router.post('/', async (req: Request, res: Response) => {
    const { message, prompt, sessionId, localTime, openrouterApiKey } = req.body;
    const userPrompt = message || prompt;
    if (!userPrompt || typeof userPrompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    if (openrouterApiKey && typeof openrouterApiKey === 'string' && openrouterApiKey.trim().length > 0) {
      const currentConf = aiService.getConfig();
      if (!currentConf.openrouter?.apiKey || currentConf.openrouter.apiKey.trim() !== openrouterApiKey.trim()) {
        aiService.updateConfig({
          ...currentConf,
          openrouter: {
            ...currentConf.openrouter,
            apiKey: openrouterApiKey.trim(),
          },
        });
      }
    }

    const result = await aiService.processMessage(userPrompt, sessionId, localTime);
    res.json({ success: true, data: result });
  });

  return router;
}
