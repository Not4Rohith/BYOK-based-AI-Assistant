import { RoutineCommitment } from '@ai-task-manager/shared-types';

/**
 * Parses natural language or structured schedule text into RoutineCommitment[]
 */
export function parseScheduleToRoutines(text: string): RoutineCommitment[] {
  if (!text || text.trim().length === 0) return [];

  const lines = text
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const routines: RoutineCommitment[] = [];

  for (const line of lines) {
    // 1. Determine days of week
    let days: number[] = [0, 1, 2, 3, 4, 5, 6]; // default to every day
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('mon-fri') || lowerLine.includes('monday-friday') || lowerLine.includes('weekday')) {
      days = [1, 2, 3, 4, 5];
    } else if (lowerLine.includes('sat-sun') || lowerLine.includes('saturday-sunday') || lowerLine.includes('weekend')) {
      days = [0, 6];
    } else if (lowerLine.includes('mon/wed/fri') || lowerLine.includes('monday/wednesday/friday')) {
      days = [1, 3, 5];
    } else if (lowerLine.includes('tue/thu') || lowerLine.includes('tuesday/thursday')) {
      days = [2, 4];
    }

    // 2. Extract time ranges (e.g. 9:00 AM - 4:30 PM or 09:00 - 16:30 or 9am to 5pm)
    const timePattern = /(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\s*(?:-|to)\s*(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)/i;
    const match = line.match(timePattern);

    if (match) {
      const startH = parseHour(match[1], match[3]);
      const startM = match[2] ? parseInt(match[2], 10) : 0;
      const endH = parseHour(match[4], match[6]);
      const endM = match[5] ? parseInt(match[5], 10) : 0;

      const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      // Extract title (text outside day prefix and match)
      let title = line
        .replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|weekdays?|weekends?|every\s+day|daily)[\s\-\/:,]*/gi, '')
        .replace(timePattern, '')
        .replace(/[\:\,\-]/g, '')
        .trim();

      if (!title) title = 'Fixed Commitment';

      routines.push({
        title,
        daysOfWeek: days,
        startTime,
        endTime,
      });
    }
  }

  return routines;
}

function parseHour(hourStr: string, ampmStr?: string): number {
  let h = parseInt(hourStr, 10);
  if (ampmStr) {
    const isPm = ampmStr.toLowerCase() === 'pm';
    const isAm = ampmStr.toLowerCase() === 'am';
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
  }
  return h;
}
