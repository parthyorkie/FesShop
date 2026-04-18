import { Types } from "mongoose";
import { Festival, IFestival } from "../models/festival.model";


export const createFestivalInDb = async (
  data: Partial<IFestival>
): Promise<IFestival> => {
  return await Festival.create(data);
};

export const findFestivalById = async (
  id: string
): Promise<IFestival | null> => {
  return await Festival.findOne({
    _id: toObjectId(id),
    isDeleted: false,
  }).lean();
};

export const findAllFestivals = async (
  filter: any,
  skip: number,
  limit: number,
  sort: any
) => {
  const query = { ...filter, isDeleted: false };

  const [data, total] = await Promise.all([
    Festival.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    Festival.countDocuments(query),
  ]);

  return { data, total };
};

export const updateFestivalInDb = async (
  id: string,
  data: Partial<IFestival>
): Promise<IFestival | null> => {
  return await Festival.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    data,
    { new: true, runValidators: true }
  ).lean();
};

export const softDeleteFestivalInDb = async (
  id: string
): Promise<IFestival | null> => {
  return await Festival.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { isDeleted: true },
    { new: true }
  ).lean();
};

// ✅ Count by IDs (already optimized)
export const countFestivalsByIds = async (
  ids: string[]
): Promise<number> => {
  return await Festival.countDocuments({
    _id: { $in: toObjectIds(ids) },
    isDeleted: false,
  });
};

// single
const toObjectId = (id: string) => new Types.ObjectId(id);

// multiple 🔥
const toObjectIds = (ids: string[]) =>
  ids.map((id) => new Types.ObjectId(id));