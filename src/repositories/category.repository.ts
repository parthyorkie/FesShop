import mongoose, { Types } from 'mongoose';
import { Category, ICategory } from '../models/category.model';

export const createCategoryInDb = async (data: Partial<ICategory>): Promise<ICategory> => {
  console.log('Creating category with data:', data);
  return await Category.create(data);
};

export const findCategoryById = async (id: string): Promise<ICategory | null> => {
  return await Category.findOne({ _id: id, isDeleted: false }).lean();
};

export const findCategoryByName = async (name: string): Promise<ICategory | null> => {
  return await Category.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') }, 
    isDeleted: false 
  }).lean();
};

export const findAllCategories = async (
  filter: Record<string, any>,
  skip: number,
  limit: number
): Promise<{ data: ICategory[]; total: number }> => {
  const query = { ...filter, isDeleted: false };
  const [data, total] = await Promise.all([
    Category.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    Category.countDocuments(query),
  ]);
  return { data, total };
};

export const updateCategoryInDb = async (id: string, data: mongoose.UpdateQuery<ICategory>): Promise<ICategory | null> => {
  return await Category.findOneAndUpdate(
    { _id: id, isDeleted: false },
    data,
    { returnDocument: 'after', runValidators: true }
  ).lean();
};

export const softDeleteCategoryInDb = async (id: string): Promise<ICategory | null> => {
  return await Category.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { returnDocument: 'after' }
  ).lean();
};
// ✅ Count Categories by IDs (USED IN VALIDATION)
export const countCategoriesByIds = async (
  ids: string[]
): Promise<number> => {
  return await Category.countDocuments({
    _id: { $in: ids.map(id => new Types.ObjectId(id)) },
    isDeleted: false,
  });
};
