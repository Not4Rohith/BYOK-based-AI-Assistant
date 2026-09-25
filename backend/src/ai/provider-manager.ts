import { AIProvider, AIRequest, AIResponse } from './provider.interface.js';
import { OpenRouterProvider } from './providers/openrouter.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { GrokProvider } from './providers/grok.provider.js';
import { AIProviderConfig } from '@ai-task-manager/shared-types';

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.registerProvider(new OpenRouterProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new GrokProvider());
  }

  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Executes AI request with fallback chain per Section 17 (OpenRouter -> Gemini -> Grok -> Local Fallback)
   */
  public async generate(
    request: AIRequest,
    config: AIProviderConfig,
    preferredProvider: string = 'openrouter'
  ): Promise<AIResponse> {
    const fallbackChain = [preferredProvider, 'openrouter', 'gemini', 'grok'].filter(
      (v, i, a) => a.indexOf(v) === i
    );

    for (const providerName of fallbackChain) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      const setting = config[providerName as 'openrouter' | 'gemini' | 'grok'];
      const apiKey = (typeof setting === 'object' && setting?.apiKey) || '';
      const defaultModel = (typeof setting === 'object' && setting?.defaultModel) || '';
      const fallbackModels = (typeof setting === 'object' && Array.isArray(setting?.fallbackModels)) ? setting.fallbackModels : [];

      if (!apiKey && providerName !== preferredProvider) {
        // Skip provider if no key available in fallback chain
        continue;
      }

      try {
        console.log(`[ProviderManager] Attempting generation with provider: ${providerName} (primary: ${defaultModel || 'default'}, fallbacks: ${fallbackModels.join(', ') || 'none'})`);
        const startTime = Date.now();
        const response = await provider.generate(request, apiKey, defaultModel, fallbackModels);
        const duration = Date.now() - startTime;
        console.log(`[ProviderManager] Provider "${providerName}" returned successfully in ${duration}ms`);
        console.log("->", response.text);
        console.log("->", request.systemPrompt);


        return response;
      } catch (err) {
        console.warn(`[ProviderManager Fallback] Provider "${providerName}" failed: ${(err as Error).message}`);
        // Continue down fallback chain
      }
    }

    console.warn('[ProviderManager] All AI providers failed or unconfigured. Falling back to deterministic engine.');

    // Graceful local degradation when all providers fail / are unconfigured (Section 17)
    return {
      text: `[Local AI Engine]: Processed your request "${request.prompt}" using local deterministic fallback.`,
      provider: 'local_fallback',
      model: 'deterministic_engine',
    };
  }
}

export const providerManager = new ProviderManager();
