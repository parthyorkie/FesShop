import { Request, Response } from "express";
import * as reviewService from "../services/review.service";
import { createApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

// ✅ CREATE REVIEW
export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.createReviewService(req.body);

  res
    .status(201)
    .json(createApiResponse(201, review, "Review created successfully"));
});

// ✅ GET SINGLE REVIEW
export const getReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.getReviewService(req.params.id as string);

  res
    .status(200)
    .json(createApiResponse(200, review, "Review retrieved successfully"));
});

// ✅ LIST REVIEWS (FILTER + PAGINATION)
export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await reviewService.listReviewsService(req.query);

  res
    .status(200)
    .json(
      createApiResponse(200, data, "Reviews fetched successfully", pagination)
    );
});

// ✅ UPDATE REVIEW
export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.updateReviewService(
    req.params.id as string,
    req.body
  );

  res
    .status(200)
    .json(createApiResponse(200, review, "Review updated successfully"));
});

// ✅ DELETE REVIEW (SOFT DELETE)
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.deleteReviewService(req.params.id as string);

  res
    .status(200)
    .json(createApiResponse(200, null, "Review deleted successfully"));
});
