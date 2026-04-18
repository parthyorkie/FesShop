import { Request, Response } from "express";
import * as festivalService from "../services/festival.service";
import { createApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

// 🔹 Create Festival
export const createFestival = asyncHandler(async (req: Request, res: Response) => {
  const festival = await festivalService.createFestival(req.body);

  res
    .status(201)
    .json(createApiResponse(201, festival, "Festival created successfully"));
});

// 🔹 Get Festival by ID
export const getFestival = asyncHandler(async (req: Request, res: Response) => {
  const festival = await festivalService.getFestivalById(req.params.id as string);

  res
    .status(200)
    .json(createApiResponse(200, festival, "Festival retrieved successfully"));
});

// 🔹 List Festivals (with pagination + search)
export const listFestivals = asyncHandler(async (req: Request, res: Response) => {
  const { data, total } = await festivalService.getAllFestivals(req.query);

  // 🔥 Pagination structure (consistent with your category pattern)
  const pagination = {
    total,
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 10),
  };

  res
    .status(200)
    .json(
      createApiResponse(
        200,
        data,
        "Festivals fetched successfully",
        pagination
      )
    );
});

// 🔹 Update Festival
export const updateFestival = asyncHandler(async (req: Request, res: Response) => {
  const festival = await festivalService.updateFestival(
    req.params.id as string,
    req.body
  );

  res
    .status(200)
    .json(createApiResponse(200, festival, "Festival updated successfully"));
});

// 🔹 Delete Festival (Soft Delete)
export const deleteFestival = asyncHandler(async (req: Request, res: Response) => {
  await festivalService.deleteFestival(req.params.id as string);

  res
    .status(200)
    .json(createApiResponse(200, null, "Festival deleted successfully"));
});