import { Types } from "mongoose";
import { Company, ICompany } from "../models/company.model";

// ✅ Create
export const createCompanyInDb = async (
  data: Partial<ICompany>
): Promise<ICompany> => {
  return await Company.create(data);
};


// ✅ Find by ID
export const findCompanyById = async (
  id:  Types.ObjectId
): Promise<ICompany | null> => {
  return await Company.findOne({
    _id: id,
    isDeleted: false,
  });
};


// ✅ Count by IDs (optional, future use)
export const countCompaniesByIds = async (
  ids: string[]
): Promise<number> => {
  return await Company.countDocuments({
    _id: { $in: ids.map(id => new Types.ObjectId(id)) },
    isDeleted: false,
  });
};


// ✅ Find all
export const findAllCompanies = async (
  filter: any,
  skip: number,
  limit: number,
  sort: any
) => {
  const query = { ...filter, isDeleted: false };

  const [data, total] = await Promise.all([
    Company.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Company.countDocuments(query),
  ]);

  return { data, total };
};


// ✅ Update
export const updateCompanyInDb = async (
  id: string,
  updateData: Partial<ICompany>
): Promise<ICompany | null> => {
  return await Company.findOneAndUpdate(
    { _id: id, isDeleted: false },
    updateData,
    { new: true }
  );
};


// ✅ Soft Delete
export const softDeleteCompanyInDb = async (
  id: string
): Promise<ICompany | null> => {
  return await Company.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
};