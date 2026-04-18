import { Request, Response } from "express";
import { Types } from "mongoose";
import * as companyService from "../services/company.service";
import { createApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

// 🔹 Create
export const createCompany = asyncHandler(async (req: Request, res: Response) => {
  const company = await companyService.createCompanyService(req.body);
  res
    .status(201)
    .json(createApiResponse(201, company, "Company created successfully"));
});

// 🔹 Get
export const getCompany = asyncHandler(async (req: Request, res: Response) => {
  const company = await companyService.getCompanyService(new Types.ObjectId(req.params.id as string));
  res
    .status(200)
    .json(createApiResponse(200, company, "Company retrieved successfully"));
});

// 🔹 List
export const listCompanies = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await companyService.listCompaniesService(req.query);
  res
    .status(200)
    .json(createApiResponse(200, data, "Companies fetched successfully", pagination));
});

// 🔹 Update
export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  const company = await companyService.updateCompanyService(
    req.params.id as string,
    req.body
  );
  res
    .status(200)
    .json(createApiResponse(200, company, "Company updated successfully"));
});

// 🔹 Delete
export const deleteCompany = asyncHandler(async (req: Request, res: Response) => {
  await companyService.deleteCompanyService(req.params.id as string);
  res
    .status(200)
    .json(createApiResponse(200, null, "Company deleted successfully"));
});