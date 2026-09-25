import { AIProvider, AIRequest, AIResponse } from '../provider.interface.js';

export class GrokProvider implements AIProvider {
  public name = 'grok';

  public async generate(
    request: AIRequest,
    apiKey: string,
    defaultModel: string
  ): Promise<AIResponse> {
    if (!apiKey) {
      throw new Error('Grok API key is missing. Please configure your key in Settings.');
    }

    const model = defaultModel;

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            { role: 'user', content: request.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Grok API error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content || 'No response generated.';

      return {
        text,
        provider: this.name,
        model,
      };
    } catch (err) {
      throw new Error(`Grok execution failed: ${(err as Error).message}`);
    }
  }
}
