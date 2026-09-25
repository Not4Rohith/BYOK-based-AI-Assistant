import mongoose, { Schema, Document } from 'mongoose';
import { Task, Priority, TaskStatus } from '@ai-task-manager/shared-types';

export interface ITaskDocument extends Omit<Task, '_id'>, Document {}

const SubtaskSchema = new Schema({
  _id: { type: String, default: () => `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
});

const RecurrenceSchema = new Schema({
  enabled: { type: Boolean, default: false },
  rule: { type: String, default: null },
  timezone: { type: String, default: 'Asia/Kolkata' },
});

const GoogleSyncSchema = new Schema({
  taskId: { type: String, default: null },
  taskListId: { type: String, default: null },
  lastSyncedAt: { type: String, default: null },
  syncStatus: { type: String, enum: ['synced', 'pending', 'failed', 'not_connected'], default: 'not_connected' },
});

const CalendarSyncSchema = new Schema({
  eventId: { type: String, default: null },
  calendarId: { type: String, default: null },
  lastSyncedAt: { type: String, default: null },
  syncStatus: { type: String, enum: ['synced', 'pending', 'failed', 'not_connected'], default: 'not_connected' },
});

const TaskSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    starred: { type: Boolean, default: false, index: true },
    listId: { type: String, default: null, index: true },
    parentTaskId: { type: String, default: null },

    goalId: { type: String, default: null },
    estimatedMinutes: { type: Number, default: 30 },
    actualMinutes: { type: Number, default: null },
    dueAt: { type: String, default: null, index: true },
    scheduledStart: { type: String, default: null, index: true },
    scheduledEnd: { type: String, default: null },
    expiresAt: { type: Date, default: null, index: true },
    tags: [{ type: String }],
    source: { type: String, enum: ['user', 'ai', 'routine'], default: 'user' },
    recurrence: { type: RecurrenceSchema, default: {} },
    google: { type: GoogleSyncSchema, default: {} },
    calendar: { type: CalendarSyncSchema, default: {} },
    subtasks: [SubtaskSchema],
    completedAt: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

// Compound indexes per Section 56 database indexing
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ userId: 1, scheduledStart: 1 });
TaskSchema.index({ userId: 1, updatedAt: -1 });
TaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TaskModel = mongoose.model<ITaskDocument>('Task', TaskSchema);
