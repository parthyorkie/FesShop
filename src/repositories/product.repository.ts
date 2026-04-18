// import { Product, IProduct } from '../models/product.model';
// import mongoose from 'mongoose';

// export const createProductInDb = async (data: Partial<IProduct>): Promise<IProduct> => {
//   return await Product.create(data);
// };

// export const findProductById = async (id: string): Promise<IProduct | null> => {
//   return await Product.findOne({ _id: id, isDeleted: false })
//     .populate('category', 'name')
//     .lean();
// };

// export const findAllProducts = async (
//   filter: Record<string, any>,
//   skip: number,
//   limit: number
// ): Promise<{ data: IProduct[]; total: number }> => {
//   const query = { ...filter, isDeleted: false };
//   const [data, total] = await Promise.all([
//     Product.find(query)
//       .populate('category', 'name')
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 })
//       .lean(),
//     Product.countDocuments(query),
//   ]);
//   return { data, total };
// };

// export const updateProductInDb = async (id: string, data: mongoose.UpdateQuery<IProduct>): Promise<IProduct | null> => {
//   return await Product.findOneAndUpdate(
//     { _id: id, isDeleted: false },
//     data,
//     { new: true, runValidators: true }
//   ).lean();
// };

// export const softDeleteProductInDb = async (id: string): Promise<IProduct | null> => {
//   return await Product.findOneAndUpdate(
//     { _id: id, isDeleted: false },
//     { isDeleted: true },
//     { new: true }
//   ).lean();
// };


import mongoose, { Types } from "mongoose";
import { IProduct, Product } from "../models/product.model";

// 🔹 Utils
const toObjectId = (id: string) => new Types.ObjectId(id);

// ✅ Create (no lean)
export const createProductInDb = async (
  data: Partial<IProduct>
): Promise<IProduct> => {
  return await Product.create(data);
};

// ✅ Find by ID (lean + correct populate)
export const findProductById = async (
  id: string
): Promise<IProduct | null> => {
  return await Product.findOne({
    _id: toObjectId(id),
    isDeleted: false,
  })
    .populate([
      { path: "categories", select: "name" },
      { path: "festivals", select: "name" },
      { path: "company", select: "name" },
    ])
    .lean();
};

// ✅ Find All (lean + parallel + optimized populate)
export const findAllProducts = async (
  filter: Record<string, any>,
  skip: number,
  limit: number
): Promise<{ data: IProduct[]; total: number }> => {
  const query = {
    ...filter,
    isDeleted: false,
  };

  const [data, total] = await Promise.all([
    Product.find(query)
      .populate([
        { path: "categories", select: "name" },
        { path: "festivals", select: "name" },
        { path: "company", select: "name" },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Product.countDocuments(query),
  ]);

  return { data, total };
};

// ✅ Update (lean + validation + ObjectId safe)
export const updateProductInDb = async (
  id: string,
  data: mongoose.UpdateQuery<IProduct>
): Promise<IProduct | null> => {
  return await Product.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    data,
    {
      new: true,
      runValidators: true,
    }
  )
    .populate([
      { path: "categories", select: "name" },
      { path: "festivals", select: "name" },
      { path: "company", select: "name" },
    ])
    .lean();
};

// ✅ Soft Delete (lean + ObjectId safe)
export const softDeleteProductInDb = async (
  id: string
): Promise<IProduct | null> => {
  return await Product.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { isDeleted: true },
    { new: true }
  ).lean();
};