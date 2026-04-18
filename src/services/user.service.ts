import bcrypt from 'bcryptjs';
import { IUser } from '../models/User';
import * as userRepo from '../repositories/user.repository';
import { createApiError } from '../utils/ApiError';
import { formatPaginationData, getPaginationOptions } from '../utils/pagination';

// ✅ Create User Service
export const createUserService = async (data: Partial<IUser>) => {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email || '')) {
    throw createApiError(400, 'Invalid email format');
  }

  // Check if user already exists
  const existingUser = await userRepo.findUserByEmail(data.email!);
  if (existingUser) {
    throw createApiError(409, 'User with this email already exists');
  }

  // Validate password strength
  if (!data.password || data.password.length < 6) {
    throw createApiError(400, 'Password must be at least 6 characters long');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10);

  return await userRepo.createUserInDb({
    ...data,
    password: hashedPassword,
  });
};

// ✅ Get Single User Service
export const getUserService = async (id: string) => {
  const user = await userRepo.findUserById(id);
  if (!user) {
    throw createApiError(404, 'User not found');
  }
  return user;
};

// ✅ List Users Service
export const listUsersService = async (query: any) => {
  const { page, limit, skip } = getPaginationOptions(query);
  const filter: any = {};

  // Search by name or email
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  // Filter by role
  if (query.role) {
    if (!['ADMIN', 'USER'].includes(query.role)) {
      throw createApiError(400, 'Invalid role. Must be ADMIN or USER');
    }
    filter.role = query.role;
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }

  const { data, total } = await userRepo.findAllUsers(filter, skip, limit);
  const pagination = formatPaginationData(total, page, limit);

  return { data, pagination };
};

// ✅ Update User Service
export const updateUserService = async (id: string, updateData: any) => {
  // Prevent direct password update through this endpoint
  if (updateData.password) {
    throw createApiError(400, 'Use change-password endpoint to update password');
  }

  // Validate email if being updated
  if (updateData.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updateData.email)) {
      throw createApiError(400, 'Invalid email format');
    }

    // Check if new email already exists
    const existingUser = await userRepo.findUserByEmail(updateData.email);
    if (existingUser && existingUser._id.toString() !== id) {
      throw createApiError(409, 'Email already in use');
    }
  }

  // Validate role if being updated
  if (updateData.role && !['ADMIN', 'USER'].includes(updateData.role)) {
    throw createApiError(400, 'Invalid role. Must be ADMIN or USER');
  }

  const user = await userRepo.updateUserInDb(id, updateData);
  if (!user) {
    throw createApiError(404, 'User not found or already deleted');
  }
  return user;
};

// ✅ Delete User Service (Soft Delete)
export const deleteUserService = async (id: string) => {
  const user = await userRepo.softDeleteUserInDb(id);
  if (!user) {
    throw createApiError(404, 'User not found or already deleted');
  }
  return user;
};

// ✅ Change Password Service
export const changePasswordService = async (id: string, oldPassword: string, newPassword: string) => {
  if (newPassword.length < 6) {
    throw createApiError(400, 'New password must be at least 6 characters long');
  }

  const user = await userRepo.findUserById(id);
  if (!user) {
    throw createApiError(404, 'User not found');
  }

  // Verify old password (note: user from findUserById doesn't include password, need raw fetch)
  const userWithPassword = await require('../models/User').default.findOne({ _id: id, isDeleted: false });
  const isPasswordValid = await bcrypt.compare(oldPassword, userWithPassword.password);
  if (!isPasswordValid) {
    throw createApiError(400, 'Old password is incorrect');
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  const updatedUser = await userRepo.updateUserInDb(id, { password: hashedNewPassword });

  return updatedUser;
};
