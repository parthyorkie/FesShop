import { Types } from "mongoose";
import { ICompany } from "../models/company.model";
import * as repo from "../repositories/company.repository";

// 🔹 Escape regex
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 🔹 Create
export const createCompanyService = async (data: Partial<ICompany>) => {
  if (!data.name) throw new Error("Company name is required");

  return await repo.createCompanyInDb(data);
};

// 🔹 Get by ID
export const getCompanyService = async (id:  Types.ObjectId) => {
  const company = await repo.findCompanyById(id);
  if (!company) throw new Error("Company not found");
  return company;
};

// 🔹 List (with search)
export const listCompaniesService = async (query: any) => {
  const {
    page = 1,
    limit = 10,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};

  // 🔥 Search by name
  if (search) {
    const safeSearch = escapeRegex(search.trim());
    filter.name = { $regex: `^${safeSearch}`, $options: "i" };
  }

  const sort: any = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
  };

  const { data, total } = await repo.findAllCompanies(
    filter,
    skip,
    Number(limit),
    sort
  );

  return {
    data,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
    },
  };
};

// 🔹 Update
export const updateCompanyService = async (
  id: string,
  data: Partial<ICompany>
) => {
  const updated = await repo.updateCompanyInDb(id, data);
  if (!updated) throw new Error("Company not found");
  return updated;
};

// 🔹 Delete
export const deleteCompanyService = async (id: string) => {
  const deleted = await repo.softDeleteCompanyInDb(id);
  if (!deleted) throw new Error("Company not found");
  return deleted;
};