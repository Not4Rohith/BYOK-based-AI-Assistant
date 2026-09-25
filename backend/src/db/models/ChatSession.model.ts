import mongoose, { Schema, Document } from 'mongoose';
import { ChatSession } from '@ai-task-manager/shared-types';

export interface IChatSessionDocument extends Omit<ChatSession, '_id'>, Document {
  _id: any;
}

const ChatSessionSchema: Schema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "session_2026-09-17"
    userId: { type: String, required: true, default: 'usr_1', index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    sessionType: { type: String, default: 'daily_chat', index: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: String, default: () => new Date().toISOString() },
    tags: [{ type: String }],
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

ChatSessionSchema.index({ userId: 1, date: -1 });

export const ChatSessionModel = mongoose.model<IChatSessionDocument>('ChatSession', ChatSessionSchema);
