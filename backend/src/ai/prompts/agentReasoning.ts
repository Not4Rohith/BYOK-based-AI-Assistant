export function getAgentReasoningModule(): string {
  return `=== AGENTIC REASONING GUIDELINES ===
- Execute multi-step database interactions systematically.
- Validate tool execution results before completing the turn.`;
}
