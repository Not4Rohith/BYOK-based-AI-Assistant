import mongoose, { Schema, Document } from 'mongoose';
import { Goal } from '@ai-task-manager/shared-types';

export interface IGoalDocument extends Omit<Goal, '_id'>, Document {}

const MilestoneSchema = new Schema({
  _id: { type: String, default: () => `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` },
  title: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
});

const GoalSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    targetDate: { type: String },
    progress: { type: Number, default: 0 },
    milestones: [MilestoneSchema],
  },
  {
    timestamps: true,
  }
);

GoalSchema.index({ userId: 1, status: 1 });

export const GoalModel = mongoose.model<IGoalDocument>('Goal', GoalSchema);
