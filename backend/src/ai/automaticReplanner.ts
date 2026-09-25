import { Task, ScheduleItem } from '@ai-task-manager/shared-types';
import { googleCalendarService } from '../services/googleCalendar.service.js';

export class AutomaticReplanner {
  /**
   * Dynamically replans remaining uncompleted tasks starting from current timestamp
   */
  public replanFromCurrentTime(
    tasks: Task[],
    fixedEvents: { title: string; startHour: number; endHour: number }[] = [
      { title: 'College Lectures', startHour: 9, endHour: 16 },
    ],
    currentTime: Date = new Date()
  ): { tasks: Task[]; schedule: ScheduleItem[] } {
    const pending = tasks.filter((t) => t.status !== 'completed');
    const completed = tasks.filter((t) => t.status === 'completed');

    let currentHour = currentTime.getHours();
    let currentMinute = Math.ceil(currentTime.getMinutes() / 15) * 15; // round to next 15m slot
    if (currentMinute >= 60) {
      currentHour += 1;
      currentMinute = 0;
    }

    // Do not overlap fixed commitments
    fixedEvents.forEach((fe) => {
      if (currentHour >= fe.startHour && currentHour < fe.endHour) {
        currentHour = fe.endHour;
        currentMinute = 0;
      }
    });

    const scheduleItems: ScheduleItem[] = [];

    const replannedPending = pending.map((task, idx) => {
      const duration = task.estimatedMinutes || 45;
      const start = new Date(currentTime);
      start.setHours(currentHour, currentMinute, 0, 0);
      const end = new Date(start.getTime() + duration * 60000);

      const nextTime = new Date(end.getTime() + 15 * 60000); // 15m buffer
      currentHour = nextTime.getHours();
      currentMinute = nextTime.getMinutes();

      const updatedTask: Task = {
        ...task,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        calendar: {
          eventId: task.calendar?.eventId || `gc_${Date.now()}_${idx}`,
          calendarId: 'primary',
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'synced',
        },
        updatedAt: new Date().toISOString(),
      };

      scheduleItems.push({
        _id: `sch_replan_${task._id}`,
        taskId: task._id,
        title: task.title,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'task',
      });

      googleCalendarService.syncEvent(updatedTask).catch(() => {});
      return updatedTask;
    });

    return {
      tasks: [...replannedPending, ...completed],
      schedule: scheduleItems,
    };
  }
}

export const automaticReplanner = new AutomaticReplanner();
