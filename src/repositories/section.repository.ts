import { UpdateQuery } from "mongoose";
import { SectionModel } from "../models/section/section.model";
import { SectionDocument } from "../models/section/section.types";

export type SectionFilter = Partial<{
  _id: string;
  type: string;
  status: "draft" | "published" | "archived";
  isActive: boolean;
  festival: string;
}>;

export type FindOptions = {
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
};

// ✅ Create
export const createSection = async (
  data: Partial<SectionDocument>
): Promise<SectionDocument> => {
  return SectionModel.create(data);
};

// ✅ Find Many
export const findSections = async (
  filter: SectionFilter = {},
  options: FindOptions = {}
): Promise<SectionDocument[]> => {
  const { skip = 0, limit = 10, sort = { createdAt: -1 } } = options;

  return SectionModel.find(filter)
    .skip(skip)
    .limit(limit)
    .sort(sort)
    .lean();
};

// ✅ Find One
export const findSection = async (
  filter: SectionFilter
): Promise<SectionDocument | null> => {
  return SectionModel.findOne(filter).lean();
};

// ✅ Find By Id
export const findSectionById = async (
  id: string
): Promise<SectionDocument | null> => {
  return SectionModel.findById(id).lean();
};

// ✅ Update
export const updateSection = async (
  id: string,
  update: UpdateQuery<SectionDocument>
): Promise<SectionDocument | null> => {
  return SectionModel.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();
};

// ✅ Delete
export const deleteSection = async (id: string): Promise<boolean> => {
  const res = await SectionModel.findByIdAndDelete(id);
  return !!res;
};

// ✅ Count
export const countSections = async (
  filter: SectionFilter = {}
): Promise<number> => {
  return SectionModel.countDocuments(filter);
};