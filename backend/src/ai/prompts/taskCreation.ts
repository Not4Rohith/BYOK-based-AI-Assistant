export function getTaskCreationModule(): string {
  return `=== TASK CREATION & BATCH SCHEDULING GUIDELINES ===
- When creating tasks (via create_task or batch_create_tasks), calculate non-overlapping scheduledStart and scheduledEnd ISO timestamps based on the user's available free time slots.
- Ensure each task in a batch has a unique, sequential time slot separated by a 15-minute buffer.
- Do NOT schedule tasks during fixed commitments like classes, meals, committed daily routines, or sleep.
- Set accurate estimatedMinutes and appropriate listId/listTitle for each task.
- RECURRENCE RULE: By default, ALL tasks MUST have NO recurrence (one-time tasks). Set recurrence ONLY when the user EXPLICITLY asks for a repeating or recurring task (e.g. "repeat daily", "every weekday", "every Sunday"). If the user did not explicitly request repetition, do not configure recurrence.`;
}
