import mongoose, { Schema, Document } from 'mongoose';
import { ChatMessage } from '@ai-task-manager/shared-types';

export interface IChatMessageDocument extends Omit<ChatMessage, '_id'>, Document {}

const ChatMessageSchema: Schema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    toolCalls: [
      {
        tool: { type: String },
        args: { type: Schema.Types.Mixed },
        status: { type: String },
        result: { type: String },
      },
    ],
    tokenUsage: {
      promptTokens: { type: Number },
      completionTokens: { type: Number },
      totalTokens: { type: Number },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
ChatMessageSchema.index({ date: 1, createdAt: 1 });

export const ChatMessageModel = mongoose.model<IChatMessageDocument>('ChatMessage', ChatMessageSchema);
