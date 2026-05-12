import { SectionModel } from "../models/section/section.model";
import { SectionDocument } from "../models/section/section.types";
import {
  countSections,
  createSection,
  deleteSection,
  findSectionById,
  findSections,
  SectionFilter
} from "../repositories/section.repository";

// ✅ Create
export const createSectionService = async (
  payload: Partial<SectionDocument>
) => {
  // 🔒 Add validations here if needed
  return createSection(payload);
};

// ✅ Get All (with pagination + filters)
export const getSectionsService = async (query: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  festival?: string;
  isActive?: boolean;
}) => {
  const {
    page = 1,
    limit = 10,
    ...filters
  } = query;

  const skip = (page - 1) * limit;

  const sectionFilter: SectionFilter = {
    ...(filters.type && { type: filters.type }),
    ...(filters.status && { status: filters.status as any }),
    ...(filters.festival && { festival: filters.festival }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
  };

  const [data, total] = await Promise.all([
    findSections(sectionFilter, { skip, limit }),
    countSections(sectionFilter),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ✅ Get By Id
export const getSectionByIdService = async (id: string) => {
  const section = await findSectionById(id);

  if (!section) {
    throw new Error("Section not found");
  }

  return section;
};

// ✅ Update
export const updateSectionService = async (id: string, payload: any) => {
  const section = await SectionModel.findById(id); // ✅ define first

  if (!section) return null;

  Object.assign(section, payload);

  return section.save(); // ✅ discriminator-safe
};

// ✅ Delete
export const deleteSectionService = async (id: string) => {
  const isDeleted = await deleteSection(id);

  if (!isDeleted) {
    throw new Error("Failed to delete section");
  }

  return { success: true };
};