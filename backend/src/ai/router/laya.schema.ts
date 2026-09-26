import { z } from 'zod';

export const layaRoutingSchema = z.object({
  route: z.enum(['DIRECT', 'SIMPLE_LLM', 'AGENT']).describe('The primary execution route for the user prompt'),
  operation: z.string().optional().describe('Specific operation name if direct or single tool (e.g. complete_task, create_task, get_tasks)'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0'),
  reasoningLevel: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']).describe('Level of reasoning required'),
  promptModules: z.array(z.string()).describe('List of prompt module keys required'),
  tools: z.array(z.string()).describe('List of specific tool names required'),
  context: z.array(z.string()).describe('List of application context categories required'),
  history: z.boolean().describe('Whether prior conversation history is required'),
  memory: z.boolean().describe('Whether user memory retrieval is required'),
  requiresClarification: z.boolean().describe('Whether user request is ambiguous or high-risk requiring user clarification'),
  reason: z.string().describe('Short explanation of the routing decision'),
  parameters: z.record(z.any()).optional().default({}).describe('Extracted structured parameters for direct operations'),
});
