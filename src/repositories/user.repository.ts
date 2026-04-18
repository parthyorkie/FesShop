import { Types } from 'mongoose';
import User, { IUser } from '../models/User';

// 🔹 Convert string to ObjectId
const toObjectId = (id: string) => new Types.ObjectId(id);

// ✅ Create User
export const createUserInDb = async (data: Partial<IUser>): Promise<IUser> => {
  return await User.create(data);
};

// ✅ Find User by ID (excluding soft deleted)
export const findUserById = async (id: string): Promise<IUser | null> => {
  return await User.findOne({
    _id: toObjectId(id),
    isDeleted: false,
  }).select('-password').lean();
};

// ✅ Find User by Email
export const findUserByEmail = async (email: string): Promise<IUser | null> => {
  return await User.findOne({
    email,
    isDeleted: false,
  }).lean();
};

// ✅ Find All Users with Pagination & Filtering
export const findAllUsers = async (
  filter: Record<string, any>,
  skip: number,
  limit: number
): Promise<{ data: IUser[]; total: number }> => {
  const query = { ...filter, isDeleted: false };

  const [data, total] = await Promise.all([
    User.find(query)
      .select('-password -otp -otpExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return { data, total };
};

// ✅ Update User
export const updateUserInDb = async (
  id: string,
  data: Partial<IUser>
): Promise<IUser | null> => {
  return await User.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { $set: data },
    { new: true, runValidators: true }
  ).select('-password -otp -otpExpiry').lean();
};

// ✅ Soft Delete User
export const softDeleteUserInDb = async (id: string): Promise<IUser | null> => {
  return await User.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { isDeleted: true },
    { new: true }
  ).lean();
};

// ✅ Count Users by Role
export const countUsersByRole = async (role: string): Promise<number> => {
  return await User.countDocuments({ role, isDeleted: false });
};
