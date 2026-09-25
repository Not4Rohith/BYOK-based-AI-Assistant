import mongoose, { Schema, Document } from 'mongoose';
import { User } from '@ai-task-manager/shared-types';

export interface IUserDocument extends Omit<User, '_id'>, Document {}

const UserProfileSchema = new Schema({
  name: { type: String, default: 'User' },
  timezone: { type: String, default: 'Asia/Kolkata' },
});

const UserAiInstructionsSchema = new Schema({
  systemPrompt: { type: String, default: '' },
});

const UserPlanningPreferencesSchema = new Schema({
  preferredStartTime: { type: String, default: '07:00' },
  preferredEndTime: { type: String, default: '22:00' },
  defaultBufferMinutes: { type: Number, default: 15 },
  preferRealisticSchedules: { type: Boolean, default: true },
  maxContinuousWorkMinutes: { type: Number, default: 90 },
});

const UserSchema: Schema = new Schema(
  {
    profile: { type: UserProfileSchema, default: {} },
    aiInstructions: { type: UserAiInstructionsSchema, default: {} },
    planningPreferences: { type: UserPlanningPreferencesSchema, default: {} },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
