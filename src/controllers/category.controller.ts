import { Request, Response } from 'express';
import * as categoryService from '../services/category.service';
import { createApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategoryService(req.body);
  res.status(201).json(createApiResponse(201, category, 'Category created successfully'));
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryService(req.params.id as string);
  res.status(200).json(createApiResponse(200, category, 'Category retrieved successfully'));
});

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await categoryService.listCategoriesService(req.query);
  res.status(200).json(createApiResponse(200, data, 'Categories fetched successfully', pagination));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategoryService(req.params.id as string, req.body);
  res.status(200).json(createApiResponse(200, category, 'Category updated successfully'));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.deleteCategoryService(req.params.id as string);
  res.status(200).json(createApiResponse(200, null, 'Category deleted successfully'));
});
