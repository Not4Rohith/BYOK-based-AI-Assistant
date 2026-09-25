import { AIProvider, AIRequest, AIResponse } from '../provider.interface.js';

export class GeminiProvider implements AIProvider {
  public name = 'gemini';

  public async generate(
    request: AIRequest,
    apiKey: string,
    defaultModel: string,
    fallbackModels: string[] = []
  ): Promise<AIResponse> {
    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please configure your key in Settings.');
    }

    const candidateModels = [defaultModel, ...(fallbackModels || [])].filter((m, i, arr) => m && arr.indexOf(m) === i);
    if (candidateModels.length === 0) candidateModels.push('gemini-1.5-flash');

    let lastErr = '';
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  ...(request.systemPrompt ? [{ text: `System: ${request.systemPrompt}` }] : []),
                  { text: request.prompt },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          lastErr = `Gemini API error (${response.status}) for model ${model}: ${errText}`;
          console.warn(`[GeminiProvider] Model "${model}" failed: ${lastErr}`);
          continue;
        }

        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

        return {
          text,
          provider: this.name,
          model,
        };
      } catch (err) {
        lastErr = (err as Error).message;
        console.warn(`[GeminiProvider] Error with model "${model}": ${lastErr}`);
      }
    }

    throw new Error(`Gemini execution failed across candidates: ${lastErr}`);
  }
}
