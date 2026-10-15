export function getTaskDeletionModule(): string {
  return `=== TASK DELETION GUIDELINES ===
- Deletion is a high-risk operation. Confirm target task identity before deleting.
- Never delete tasks arbitrarily if target is ambiguous.
- CRITICAL SAFETY RULE: NEVER claim, state, or imply that tasks have been deleted unless delete_task or delete_all_tasks tool was actually executed in the current turn.`;
}
