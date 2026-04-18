import * as categoryRepo from '../repositories/category.repository';
import { createApiError } from '../utils/ApiError';
import { ICategory } from '../models/category.model';
import { formatPaginationData, getPaginationOptions } from '../utils/pagination';

export const createCategoryService = async (data: Partial<ICategory>) => {
  if (!data.name) throw createApiError(400, 'Category name is required');
  
  const existing = await categoryRepo.findCategoryByName(data.name);
  if (existing) {
    throw createApiError(400, 'Category already exists');
  }

  return await categoryRepo.createCategoryInDb(data);
};

export const getCategoryService = async (id: string) => {
  const category = await categoryRepo.findCategoryById(id);
  if (!category) {
    throw createApiError(404, 'Category not found');
  }
  return category;
};

export const listCategoriesService = async (query: any) => {
  const { page, limit, skip } = getPaginationOptions(query);
  const filter: any = {};

  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate as string);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate as string);
  }

  const { data, total } = await categoryRepo.findAllCategories(filter, skip, limit);
  const pagination = formatPaginationData(total, page, limit);

  return { data, pagination };
};

export const updateCategoryService = async (id: string, updateData: any) => {
  if (updateData.name) {
    const existing = await categoryRepo.findCategoryByName(updateData.name);
    if (existing && existing._id.toString() !== id) {
      throw createApiError(400, 'Another category with this name already exists');
    }
  }

  const category = await categoryRepo.updateCategoryInDb(id, updateData);
  if (!category) {
    throw createApiError(404, 'Category not found or already deleted');
  }
  return category;
};

export const deleteCategoryService = async (id: string) => {
  const category = await categoryRepo.softDeleteCategoryInDb(id);
  if (!category) {
    throw createApiError(404, 'Category not found or already deleted');
  }
  return category;
};
