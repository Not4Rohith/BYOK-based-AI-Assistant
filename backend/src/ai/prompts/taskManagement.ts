export function getTaskManagementModule(dailySchedule?: string): string {
  return `=== TASK MANAGEMENT & PREFERENCES ===
User Schedule Context: ${dailySchedule || 'No fixed schedule defined.'}
Ensure tasks fit realistically into the user's workflow.`;
}
