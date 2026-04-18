import { IFestival } from "../models/festival.model";
import * as repo from "../repositories/festival.repository";

// 🔹 Escape regex (🔥 security)
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 🔹 Create
export const createFestival = async (data: Partial<IFestival>) => {
  if (!data.name || !data.code) {
    throw new Error("Name and code are required");
  }

  data.code = data.code.toUpperCase();

  return await repo.createFestivalInDb(data);
};

// 🔹 Get by ID
export const getFestivalById = async (id: string) => {
  const festival = await repo.findFestivalById(id);

  if (!festival) throw new Error("Festival not found");

  return festival;
};

// 🔹 Get All (🔥 Optimized Search)
export const getAllFestivals = async (query: any) => {
  const {
    page = 1,
    limit = 10,
    search,
    isActive,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};

  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }

  // 🔥 HYBRID SEARCH (BEST PRACTICE)
  if (search) {
    const safeSearch = escapeRegex(search.trim());
    const normalized = search.toUpperCase();

    filter.$or = [
      { code: normalized }, // exact match 🚀
      { name: { $regex: `^${safeSearch}`, $options: "i" } }, // prefix 🚀
    ];
  }

  const sort: any = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
  };

  return await repo.findAllFestivals(
    filter,
    skip,
    Number(limit),
    sort
  );
};

// 🔹 Update
export const updateFestival = async (
  id: string,
  data: Partial<IFestival>
) => {
  if (data.code) {
    data.code = data.code.toUpperCase();
  }

  const updated = await repo.updateFestivalInDb(id, data);

  if (!updated) throw new Error("Festival not found");

  return updated;
};

// 🔹 Delete
export const deleteFestival = async (id: string) => {
  const deleted = await repo.softDeleteFestivalInDb(id);

  if (!deleted) throw new Error("Festival not found");

  return deleted;
};