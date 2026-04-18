import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { createApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

// ✅ Create User (Admin only)
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUserService(req.body);
  res.status(201).json(createApiResponse(201, user, 'User created successfully'));
});

// ✅ Get Single User
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserService(req.params.id as string);
  res.status(200).json(createApiResponse(200, user, 'User retrieved successfully'));
});

// ✅ List All Users with Pagination
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await userService.listUsersService(req.query);
  res.status(200).json(createApiResponse(200, data, 'Users fetched successfully', pagination));
});

// ✅ Update User (Admin only)
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUserService(req.params.id as string, req.body);
  res.status(200).json(createApiResponse(200, user, 'User updated successfully'));
});

// ✅ Delete User - Soft Delete (Admin only)
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUserService(req.params.id as string);
  res.status(200).json(createApiResponse(200, null, 'User deleted successfully'));
});

// ✅ Change Password (Any authenticated user for their own account)
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id; // Set by auth middleware
  if (!userId) {
    throw new Error('User not authenticated');
  }
  const { oldPassword, newPassword } = req.body;

  await userService.changePasswordService(userId, oldPassword, newPassword);
  res.status(200).json(createApiResponse(200, null, 'Password changed successfully'));
});
