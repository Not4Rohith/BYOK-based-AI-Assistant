import mongoose, { Schema, Document } from 'mongoose';
import { Memory } from '@ai-task-manager/shared-types';

export interface IMemoryDocument extends Omit<Memory, '_id'>, Document {
  embedding?: number[];
}

const MemorySchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    memoryTier: {
      type: String,
      enum: ['short_term', 'medium_term', 'long_term', 'custom'],
      default: 'long_term',
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    content: { type: String, required: true },
    embedding: [{ type: Number }],
    importance: { type: Number, default: 0.8 },
    confidence: { type: Number, default: 0.9 },
    source: {
      type: String,
      enum: ['explicit_user', 'conversation', 'manual', 'system_import'],
      default: 'explicit_user',
    },
    status: { type: String, enum: ['active', 'archived', 'expired', 'disabled'], default: 'active', index: true },
    validFrom: { type: String, default: null },
    validUntil: { type: String, default: null, index: true },
    tags: [{ type: String }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    lastUsedAt: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

MemorySchema.index({ userId: 1, memoryTier: 1, status: 1 });
MemorySchema.index({ userId: 1, category: 1 });

export const MemoryModel = mongoose.model<IMemoryDocument>('Memory', MemorySchema);
