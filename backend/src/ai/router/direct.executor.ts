/**
 * @deprecated Direct execution route removed in favor of AI-driven tool calling (SINGLE_TOOL / AGENT).
 * All tool invocations are now processed dynamically by the AI model.
 */
import { LayaRoutingResult } from './routing.types.js';

export interface DirectExecutionResult {
  responseText: string;
  toolCallsExecuted: { tool: string; args: any; status: 'pending' | 'failed' | 'success' }[];
}

export class DirectExecutionHandler {
  public async execute(
    decision: LayaRoutingResult
  ): Promise<DirectExecutionResult> {
    return {
      responseText: `Direct execution has been deprecated in favor of AI tool calling.`,
      toolCallsExecuted: [],
    };
  }
}

export const directExecutionHandler = new DirectExecutionHandler();
