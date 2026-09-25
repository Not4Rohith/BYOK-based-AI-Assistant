import { RecurrenceRule, Task } from '@ai-task-manager/shared-types';

export class RecurrenceEngine {
  /**
   * Checks if an RRULE pattern matches a specific target date
   */
  public isMatchingDate(ruleStr: string | null | undefined, targetDate: Date = new Date()): boolean {
    if (!ruleStr) return false;
    const upper = ruleStr.toUpperCase();

    const dayMap: Record<number, string> = {
      0: 'SU', // Sunday
      1: 'MO', // Monday
      2: 'TU', // Tuesday
      3: 'WE', // Wednesday
      4: 'TH', // Thursday
      5: 'FR', // Friday
      6: 'SA', // Saturday
    };

    const currentDayCode = dayMap[targetDate.getDay()];

    if (upper.includes('FREQ=DAILY')) {
      return true;
    }

    if (upper.includes('FREQ=WEEKLY')) {
      if (upper.includes('BYDAY=')) {
        const byDayMatch = upper.match(/BYDAY=([A-Z,]+)/);
        if (byDayMatch) {
          const days = byDayMatch[1].split(',');
          return days.includes(currentDayCode);
        }
      }
      return true;
    }

    if (upper.includes('FREQ=MONTHLY')) {
      if (upper.includes('BYMONTHDAY=')) {
        const dayMatch = upper.match(/BYMONTHDAY=(\d+)/);
        if (dayMatch) {
          return targetDate.getDate() === parseInt(dayMatch[1], 10);
        }
      }
      return targetDate.getDate() === 1;
    }

    return false;
  }

  /**
   * Constructs standard RRULE string from human readable recurrence text
   */
  public parseToRRule(text: string): { rule: string; description: string } {
    const lower = text.toLowerCase();

    if (lower.includes('weekday') || lower.includes('mon to fri')) {
      return {
        rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        description: 'Every weekday (Mon-Fri)',
      };
    }

    if (lower.includes('weekend')) {
      return {
        rule: 'FREQ=WEEKLY;BYDAY=SA,SU',
        description: 'Every weekend (Sat-Sun)',
      };
    }

    if (lower.includes('sunday')) {
      return {
        rule: 'FREQ=WEEKLY;BYDAY=SU',
        description: 'Every Sunday',
      };
    }

    if (lower.includes('monday')) {
      return {
        rule: 'FREQ=WEEKLY;BYDAY=MO',
        description: 'Every Monday',
      };
    }

    if (lower.includes('month')) {
      return {
        rule: 'FREQ=MONTHLY;BYMONTHDAY=1',
        description: 'Monthly on 1st day',
      };
    }

    return {
      rule: 'FREQ=DAILY',
      description: 'Every day',
    };
  }
}

export const recurrenceEngine = new RecurrenceEngine();
