export type ToolGroupKey =
  | 'TASK_READ'
  | 'TASK_CREATE'
  | 'TASK_UPDATE'
  | 'TASK_DELETE'
  | 'SUBTASK'
  | 'LIST'
  | 'SCHEDULING'
  | 'AUTONOMOUS_AGENT';

export const TOOL_GROUPS: Record<ToolGroupKey, string[]> = {
  TASK_READ: ['get_tasks', 'search_tasks', 'get_today_agenda'],
  TASK_CREATE: ['create_task', 'batch_create_tasks'],
  TASK_UPDATE: ['update_task', 'bulk_update_tasks', 'complete_task', 'snooze_task'],
  TASK_DELETE: ['delete_task', 'delete_all_tasks'],
  SUBTASK: ['create_subtask', 'delete_subtask'],
  LIST: ['get_lists', 'create_list', 'delete_list', 'delete_all_lists'],
  SCHEDULING: ['replan_day'],
  AUTONOMOUS_AGENT: ['create_ai_agent_goal', 'get_active_ai_goals', 'cancel_ai_agent_goal'],
};
