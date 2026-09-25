import { AIProvider, AIRequest, AIResponse } from '../provider.interface.js';

export class OpenRouterProvider implements AIProvider {
  public name = 'openrouter';

  public async generate(
    request: AIRequest,
    apiKey: string,
    defaultModel: string,
    fallbackModels: string[] = []
  ): Promise<AIResponse> {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      throw new Error('OpenRouter API key is missing. Please configure your key in Settings.');
    }

    const candidateModels = [
      defaultModel,
      ...(fallbackModels || []),
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    if (candidateModels.length === 0) {
      candidateModels.push('openai/gpt-4o-mini');
    }

    let lastError = '';

    for (const model of candidateModels) {
      try {
        console.log(`[OpenRouterProvider] Requesting OpenRouter API (model: ${model})...`);
        const payloadMessages = [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          ...(request.chatHistory || []),
          { role: 'user', content: request.prompt },
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aitaskmanager.app',
            'X-Title': 'Personal AI Task Manager',
          },
          body: JSON.stringify({
            model,
            messages: payloadMessages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 1000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `OpenRouter API error (${response.status}) for model ${model}: ${errorText}`;
          console.warn(`[OpenRouterProvider] Model "${model}" failed: ${lastError}`);
          continue; // Try next candidate model
        }

        const data = (await response.json()) as any;
        const content = data.choices?.[0]?.message?.content || 'No response generated.';
        console.log(`[OpenRouterProvider] OpenRouter API returned response successfully for model: ${model}`);

        return {
          text: content,
          provider: this.name,
          model,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        };
      } catch (err) {
        lastError = (err as Error).message;
        console.warn(`[OpenRouterProvider] Failed generation with model "${model}": ${lastError}`);
      }
    }

    throw new Error(`OpenRouter execution failed across all candidate models: ${lastError}`);
  }
}


