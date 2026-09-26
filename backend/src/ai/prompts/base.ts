export function getBasePromptModule(timeContext: string, userPrompt?: string): string {
  return `You are an intelligent Personal AI Task Assistant.
Current Time: ${timeContext}
Provide clear, concise, and helpful responses.`;
}
