import mongoose, { Schema, Document } from 'mongoose';
import { AIAgentGoal } from '@ai-task-manager/shared-types';

export interface IAIAgentGoalDocument extends Omit<AIAgentGoal, '_id'>, Document {
  _id: any;
}

const AIAgentGoalSchema: Schema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, default: 'usr_1', index: true },
    title: { type: String, required: true },
    actionType: { type: String, required: true, index: true }, // delete_list_and_tasks, check_in_reminder, etc.
    targetExecutionTime: { type: String, required: true, index: true }, // ISO timestamp
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'executed', 'cancelled'], default: 'pending', index: true },
    executedAt: { type: String, default: null },
    lastLogMessage: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

AIAgentGoalSchema.index({ status: 1, targetExecutionTime: 1 });

export const AIAgentGoalModel = mongoose.model<IAIAgentGoalDocument>('AIAgentGoal', AIAgentGoalSchema);
