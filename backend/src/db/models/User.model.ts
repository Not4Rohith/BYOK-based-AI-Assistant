import mongoose, { Schema, Document } from 'mongoose';
import { User, RoutineCommitment } from '@ai-task-manager/shared-types';

export interface IUserDocument extends Omit<User, '_id'>, Document {}

const UserProfileSchema = new Schema({
  name: { type: String, default: 'User' },
  timezone: { type: String, default: 'Asia/Kolkata' },
});

const UserAiInstructionsSchema = new Schema({
  systemPrompt: { type: String, default: '' },
});

const RoutineCommitmentSchema = new Schema({
  title: { type: String, required: true },
  daysOfWeek: [{ type: Number }],
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
});

const UserPlanningPreferencesSchema = new Schema({
  preferredStartTime: { type: String, default: '07:30' },
  preferredEndTime: { type: String, default: '23:59' },
  defaultBufferMinutes: { type: Number, default: 15 },
  preferRealisticSchedules: { type: Boolean, default: true },
  maxContinuousWorkMinutes: { type: Number, default: 90 },
  fixedRoutines: { type: [RoutineCommitmentSchema], default: [] },
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

export async function getCurrentUserDocument(userId?: string): Promise<IUserDocument | null> {
  if (userId) {
    const user = await UserModel.findById(userId);
    if (user) return user;
  }
  return UserModel.findOne({});
}
