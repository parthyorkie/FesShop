import { Document, Schema, model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
  otp?: string;
  otpExpiry?: Date;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
  },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER' },
  otp: String,
  otpExpiry: Date,
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

export default model<IUser>("User", userSchema);
