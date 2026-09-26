import { createLangChainTools } from '../langchain.tools.js';
import { TaskService } from '../../services/task.service.js';

export class ToolSelector {
  public selectTools(requestedToolNames: string[], taskService?: TaskService) {
    const allTools = createLangChainTools(taskService);
    if (!requestedToolNames || requestedToolNames.length === 0) {
      return [];
    }
    const nameSet = new Set(requestedToolNames);
    return allTools.filter((t) => nameSet.has(t.name));
  }
}

export const toolSelector = new ToolSelector();
