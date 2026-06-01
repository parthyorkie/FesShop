import { Document, Schema, model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string; // Made optional for Google auth users
  role: 'ADMIN' | 'USER';
  otp?: string;
  otpExpiry?: Date;
  isDeleted: boolean;
  googleId?: string;
  profilePicture?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
  },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // Optional for Google Auth
  role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER' },
  otp: String,
  otpExpiry: Date,
  isDeleted: { type: Boolean, default: false, index: true },
  googleId: {
    type: String,
    default: null,
  },
  profilePicture: {
    type: String,
    default: null,
  },
}, { timestamps: true });

export default model<IUser>("User", userSchema);
