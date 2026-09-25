import { Router, Request, Response } from 'express';

export const modelsRouter = Router();

modelsRouter.get('/', async (req: Request, res: Response) => {
  const provider = (req.query.provider as string) || 'openrouter';
  const apiKey = (req.query.apiKey as string) || '';

  try {
    if (provider === 'openrouter') {
      const headers: Record<string, string> = {
        'HTTP-Referer': 'https://aitaskmanager.app',
        'X-Title': 'Personal AI Task Manager',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
      if (!response.ok) {
        throw new Error(`OpenRouter models API returned ${response.status}`);
      }
      const data = (await response.json()) as any;
      const models = (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length,
      }));

      return res.json({ success: true, provider, data: models });
    }

    if (provider === 'gemini') {
      const key = apiKey.trim();
      if (!key) {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (response.ok) {
          const data = (await response.json()) as any;
          const geminiModels = (data.data || [])
            .filter((m: any) => m.id.includes('gemini') || m.id.startsWith('google/'))
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.id,
              contextLength: m.context_length,
            }));
          return res.json({ success: true, provider, data: geminiModels });
        }
        return res.status(400).json({ success: false, error: 'Gemini API key is required to fetch direct Gemini models.' });
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!response.ok) {
        throw new Error(`Gemini models API returned ${response.status}`);
      }
      const data = (await response.json()) as any;
      const models = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name,
        }));

      return res.json({ success: true, provider, data: models });
    }

    if (provider === 'grok') {
      const key = apiKey.trim();
      if (key) {
        try {
          const response = await fetch('https://api.x.ai/v1/models', {
            headers: {
              'Authorization': `Bearer ${key}`,
            },
          });
          if (response.ok) {
            const data = (await response.json()) as any;
            const models = (data.data || []).map((m: any) => ({
              id: m.id,
              name: m.id,
            }));
            if (models.length > 0) {
              return res.json({ success: true, provider, data: models });
            }
          }
        } catch (e) {
          console.warn('[ModelsRouter] Direct xAI API models fetch failed, attempting OpenRouter fallback:', e);
        }
      }

      // Dynamic fallback: Fetch Grok models dynamically from OpenRouter public API endpoint
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (response.ok) {
        const data = (await response.json()) as any;
        const grokModels = (data.data || [])
          .filter((m: any) => m.id.includes('grok') || m.id.startsWith('x-ai/'))
          .map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            contextLength: m.context_length,
          }));
        return res.json({ success: true, provider, data: grokModels });
      }

      return res.status(500).json({ success: false, error: 'Failed to fetch Grok models dynamically.' });
    }

    if (provider === 'openai') {
      const key = apiKey.trim();
      if (!key) {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (response.ok) {
          const data = (await response.json()) as any;
          const openAiModels = (data.data || [])
            .filter((m: any) => m.id.startsWith('openai/'))
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.id,
            }));
          return res.json({ success: true, provider, data: openAiModels });
        }
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        throw new Error(`OpenAI models API returned ${response.status}`);
      }
      const data = (await response.json()) as any;
      const models = (data.data || [])
        .filter((m: any) => m.id.includes('gpt'))
        .map((m: any) => ({ id: m.id, name: m.id }));

      return res.json({ success: true, provider, data: models });
    }

    return res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
  } catch (err) {
    console.warn(`[ModelsRouter] Failed to fetch models for provider "${provider}":`, err);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});
