import { Document, Schema, model } from "mongoose";

export interface ICompany extends Document {
  name: string;
  description?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
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

// ✅ Indexes
CompanySchema.index({ isDeleted: 1 });

export const Company = model<ICompany>("Company", CompanySchema);