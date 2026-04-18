import { Schema, model, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CategorySchema.index({ name: 1 });
CategorySchema.index({ createdAt: -1 });
CategorySchema.index({ isDeleted: 1 });

export const Category = model<ICategory>('Category', CategorySchema);
