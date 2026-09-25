import mongoose, { Schema, Document } from 'mongoose';
import { TaskList } from '@ai-task-manager/shared-types';

export interface ITaskListDocument extends Omit<TaskList, '_id'>, Document {
  _id: any;
}

const TaskListSchema: Schema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, default: 'usr_1', index: true },
    title: { type: String, required: true },
    icon: { type: String, default: null },
    color: { type: String, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

TaskListSchema.index({ userId: 1, title: 1 });
TaskListSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TaskListModel = mongoose.model<ITaskListDocument>('TaskList', TaskListSchema);
