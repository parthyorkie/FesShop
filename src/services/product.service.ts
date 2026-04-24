// import * as productRepo from '../repositories/product.repository';
// import * as categoryRepo from '../repositories/category.repository';
// import { createApiError } from '../utils/ApiError';
// import { IProduct } from '../models/product.model';
// import { formatPaginationData, getPaginationOptions } from '../utils/pagination';

// const validateCategories = async (categories: string[]) => {
//   if (!categories || categories.length === 0) return;
//   for (const catId of categories) {
//     const exists = await categoryRepo.findCategoryById(catId);
//     if (!exists) {
//       throw createApiError(400, `Category ${catId} does not exist`);
//     }
//   }
// };

// export const createProductService = async (data: Partial<IProduct>) => {
//   if (data.category && data.category.length > 0) {
//     await validateCategories(data.category as unknown as string[]);
//   } else {
//     throw createApiError(400, 'Product must have at least one category');
//   }

//   return await productRepo.createProductInDb(data);
// };

// export const getProductService = async (id: string) => {
//   const product = await productRepo.findProductById(id);
//   if (!product) {
//     throw createApiError(404, 'Product not found');
//   }
//   return product;
// };

// export const listProductsService = async (query: any) => {
//   const { page, limit, skip } = getPaginationOptions(query);
//   const filter: any = {};

//   if (query.search) {
//     filter.name = { $regex: query.search, $options: 'i' };
//   }

//   if (query.category) {
//     filter.category = query.category;
//   }

//   if (query.startDate || query.endDate) {
//     filter.createdAt = {};
//     if (query.startDate) filter.createdAt.$gte = new Date(query.startDate as string);
//     if (query.endDate) filter.createdAt.$lte = new Date(query.endDate as string);
//   }

//   const { data, total } = await productRepo.findAllProducts(filter, skip, limit);
//   const pagination = formatPaginationData(total, page, limit);

//   return { data, pagination };
// };

// export const updateProductService = async (id: string, updateData: any) => {
//   if (updateData.category && updateData.category.length > 0) {
//     await validateCategories(updateData.category);
//   }

//   const product = await productRepo.updateProductInDb(id, updateData);
//   if (!product) {
//     throw createApiError(404, 'Product not found or already deleted');
//   }
//   return product;
// };

// export const deleteProductService = async (id: string) => {
//   const product = await productRepo.softDeleteProductInDb(id);
//   if (!product) {
//     throw createApiError(404, 'Product not found or already deleted');
//   }
//   return product;
// };

import * as categoryRepo from "../repositories/category.repository";
import * as companyRepo from "../repositories/company.repository";
import * as festivalRepo from "../repositories/festival.repository";
import * as productRepo from "../repositories/product.repository";

import { Types } from "mongoose";
import { IProduct } from "../models/product.model";
import { createApiError } from "../utils/ApiError";
import {
  formatPaginationData,
  getPaginationOptions,
} from "../utils/pagination";

// ✅ Validate Categories (optimized)
const validateCategories = async (categories: Types.ObjectId[]) => {
  if (!categories?.length) {
    throw createApiError(400, "Product must have at least one category");
  }

  const count = await categoryRepo.countCategoriesByIds(
    categories.map((id) => id.toString()),
  );

  if (count !== categories.length) {
    throw createApiError(400, "One or more categories are invalid");
  }
};

// ✅ Validate Festivals (optional)
const validateFestivals = async (festivals?: Types.ObjectId[]) => {
  if (!festivals?.length) return;

  const count = await festivalRepo.countFestivalsByIds(
    festivals.map((id) => id.toString()),
  );

  if (count !== festivals.length) {
    throw createApiError(400, "One or more festivals are invalid");
  }
};

// ✅ Validate Company (required)
const validateCompany = async (companyId?: Types.ObjectId) => {
  if (!companyId) {
    throw createApiError(400, "Company is required");
  }

  const exists = await companyRepo.findCompanyById(companyId);

  if (!exists) {
    throw createApiError(400, "Invalid company");
  }
};

// ✅ CREATE
export const createProductService = async (data: Partial<IProduct>) => {
  console.log("Validating product data:", data);  
  await validateCategories(data.categories || []);
  // await validateFestivals(data.festivals || []);
  // await validateCompany(data.company || undefined);

  console.log("data from create product service ", data);
  return await productRepo.createProductInDb(data);
};

// ✅ GET SINGLE
export const getProductService = async (id: string) => {
  const product = await productRepo.findProductById(id);

  if (!product) {
    throw createApiError(404, "Product not found");
  }

  return product;
};

// ✅ LIST (FILTER + PAGINATION)
export const listProductsService = async (query: any) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: any = {
    isDeleted: false,
  };

  // 🔍 Search
  if (query.search) {
    filter.name = { $regex: query.search, $options: "i" };
  }

  console.log("List products with filter:", filter, "and query:", query);
  // 🔍 Category filter (array)
  // if (query.category) {
  //   filter.categories = query.category;
  // }

  if (query?.categories ) {
    const categories = Array.isArray(query.categories)
      ? query.categories
      : (query.categories as string).split(",");

    filter.categories = { $in: categories };
  }

  // 🔍 Festival filter
  // if (query.festival) {
  //   filter.festivals = query.festival;
  // }
  
  if (query?.festivals) {
    const festivals = Array.isArray(query.festivals)
      ? query.festivals
      : (query.festivals as string).split(",");

    filter.festivals = { $in: festivals };
  }

  // 🔍 Company filter
  if (query.company) {
    filter.company = query.company;
  }

  // 📅 Date range
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }

  const { data, total } = await productRepo.findAllProducts(
    filter,
    skip,
    limit,
  );

  console.log("data from list product service ", data);
  const pagination = formatPaginationData(total, page, limit);

  return { data, pagination };
};

// ✅ UPDATE
export const updateProductService = async (
  id: string,
  updateData: Partial<IProduct>,
) => {

  console.log("update data from update product service ", updateData);
  if (updateData.categories) {
    await validateCategories(updateData.categories as Types.ObjectId[]);
  }

  // if (updateData.festivals) {
  //   await validateFestivals(updateData.festivals as Types.ObjectId[]);
  // }

  // if (updateData.company) {
  //   await validateCompany(updateData.company as Types.ObjectId);
  // }

  const product = await productRepo.updateProductInDb(id, updateData);

  if (!product) {
    throw createApiError(404, "Product not found or already deleted");
  }

  return product;
};

// ✅ DELETE (SOFT DELETE)
export const deleteProductService = async (id: string) => {
  const product = await productRepo.softDeleteProductInDb(id);

  if (!product) {
    throw createApiError(404, "Product not found or already deleted");
  }

  return product;
};
