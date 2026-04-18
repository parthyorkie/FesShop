import { Document, Schema, model } from "mongoose";

export interface ICustomer extends Document {
  name?: string;
  phone: string;
  email?: string;

  address?: string;
  city?: string;
  state?: string;

  totalOrders: number;
  totalSpent: number;

  lastOrderDate?: Date;

  isActive: boolean;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      trim: true,
    },

    // 🔥 Primary identifier (important for India use-case)
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: String,
    city: String,
    state: String,

    // 🔥 Analytics fields (denormalized)
    totalOrders: {
      type: Number,
      default: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
    },

    lastOrderDate: Date,

    isActive: {
      type: Boolean,
      default: true,
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


// ✅ Indexes (Query-driven)
CustomerSchema.index({ phone: 1 }, { unique: true });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ isDeleted: 1 });
CustomerSchema.index({ createdAt: -1 });

// 🔥 For analytics (top customers)
CustomerSchema.index({ totalSpent: -1 });
CustomerSchema.index({ totalOrders: -1 });

export const Customer = model<ICustomer>("Customer", CustomerSchema);