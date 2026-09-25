export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  chatHistory?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  name: string;
  generate(
    request: AIRequest,
    apiKey: string,
    defaultModel: string,
    fallbackModels?: string[]
  ): Promise<AIResponse>;
}
