import mongoose, { Schema, Document } from 'mongoose';

export interface ISchemaVersionDocument extends Document {
  version: number;
  description: string;
  appliedAt: Date;
  history: {
    fromVersion: number;
    toVersion: number;
    description: string;
    appliedAt: Date;
  }[];
}

const HistorySchema = new Schema({
  fromVersion: { type: Number, required: true },
  toVersion: { type: Number, required: true },
  description: { type: Number, required: true },
  appliedAt: { type: Date, default: Date.now },
});

const SchemaVersionSchema: Schema = new Schema(
  {
    version: { type: Number, required: true, default: 1 },
    description: { type: String, default: 'Initial Schema Version' },
    appliedAt: { type: Date, default: Date.now },
    history: [
      {
        fromVersion: { type: Number, required: true },
        toVersion: { type: Number, required: true },
        description: { type: String, required: true },
        appliedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const SchemaVersionModel = mongoose.model<ISchemaVersionDocument>(
  'SchemaVersion',
  SchemaVersionSchema
);
