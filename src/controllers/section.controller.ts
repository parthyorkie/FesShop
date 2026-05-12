import { Request, Response } from "express";
import * as sectionService from "../services/section.service";
import { createApiError } from "../utils/ApiError";
import { createApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * 🔹 Helper: safely extract string param
 */
const getParamId = (id: string | string[]): string => {
  return Array.isArray(id) ? id[0] : id;
};

/**
 * ✅ Create Section
 */
export const createSection = asyncHandler(async (req: Request, res: Response) => {
  const section = await sectionService.createSectionService(req.body);

  res
    .status(201)
    .json(createApiResponse(201, section, "Section created successfully"));
});

/**
 * ✅ Get Section by ID
 */
export const getSection = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);

  // ✅ FIX: using correct service name
  const section = await sectionService.getSectionByIdService( id );

  if (!section) {
    throw createApiError(404, "Section not found");
  }

  res
    .status(200)
    .json(createApiResponse(200, section, "Section retrieved successfully"));
});

/**
 * ✅ List Sections
 */
export const listSections = asyncHandler(async (req: Request, res: Response) => {
  // ✅ FIX: using correct service
  const result = await sectionService.getSectionsService(req.query);

  res
    .status(200)
    .json(
      createApiResponse(
        200,
        result.data ?? result, // supports both shapes
        "Sections fetched successfully",
        result.meta
      )
    );
});

/**
 * ✅ Update Section
 */
export const updateSection = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);

  const section = await sectionService.updateSectionService(id, req.body);

  if (!section) {
    throw createApiError(404, "Section not found");
  }

  res
    .status(200)
    .json(createApiResponse(200, section, "Section updated successfully"));
});

/**
 * ✅ Delete Section
 */
export const deleteSection = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);

  const isDeleted = await sectionService.deleteSectionService(id);

  if (!isDeleted) {
    throw createApiError(404, "Section not found");
  }

  res
    .status(200)
    .json(createApiResponse(200, null, "Section deleted successfully"));
});