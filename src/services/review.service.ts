import { Types } from "mongoose";
import * as reviewRepo from "../repositories/review.repository";
import * as productRepo from "../repositories/product.repository";
import * as userRepo from "../repositories/user.repository";
import { trackEvent } from "./socialProof.service";
import { IReview } from "../models/review.model";
import { SocialProofEventType } from "../models/socialProofEvent.model";
import { createApiError } from "../utils/ApiError";
import { formatPaginationData, getPaginationOptions } from "../utils/pagination";
import { logger } from "../utils/logger";

// ✅ CREATE REVIEW
export const createReviewService = async (data: Partial<IReview>) => {
  // Validate user exists
  if (!data.userId) {
    throw createApiError(400, "userId is required");
  }

  const user = await userRepo.findUserById(data.userId.toString());
  if (!user) {
    throw createApiError(404, "User not found");
  }

  // Validate product exists
  if (!data.productId) {
    throw createApiError(400, "productId is required");
  }

  const product = await productRepo.findProductById(data.productId.toString());
  if (!product) {
    throw createApiError(404, "Product not found");
  }

  // Persist review
  const review = await reviewRepo.createReviewInDb(data);

  // ✅ SOCIAL PROOF: Trigger REVIEW event (non-blocking — must not fail review creation)
  try {
    logger.info(
      `[SocialProof] Review social proof triggered - userId: ${review.userId}, productId: ${review.productId}`
    );

    await trackEvent({
      type: SocialProofEventType.REVIEW,
      userId: review.userId.toString(),
      productId: review.productId.toString(),
      metadata: {
        rating: review.rating,
        reviewId: review._id.toString(),
      },
    });
  } catch (socialProofErr: any) {
    // ✅ ERROR HANDLING: Social proof failure must NOT fail review creation
    logger.error(
      `[SocialProof] Social proof tracking failed after review creation - reviewId: ${review._id}, userId: ${review.userId}, productId: ${review.productId} - Error: ${socialProofErr.message}`
    );
  }

  return review;
};

// ✅ GET SINGLE REVIEW
export const getReviewService = async (id: string) => {
  const review = await reviewRepo.findReviewById(id);

  if (!review) {
    throw createApiError(404, "Review not found");
  }

  return review;
};

// ✅ LIST REVIEWS (FILTER + PAGINATION)
export const listReviewsService = async (query: any) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: Record<string, any> = {};

  // 🔍 Filter by product
  if (query.productId && Types.ObjectId.isValid(query.productId)) {
    filter.productId = new Types.ObjectId(query.productId);
  }

  // 🔍 Filter by user
  if (query.userId && Types.ObjectId.isValid(query.userId)) {
    filter.userId = new Types.ObjectId(query.userId);
  }

  const { data, total } = await reviewRepo.findAllReviews(filter, skip, limit);

  const pagination = formatPaginationData(total, page, limit);

  return { data, pagination };
};

// ✅ UPDATE REVIEW
export const updateReviewService = async (
  id: string,
  updateData: Partial<IReview>
) => {
  const review = await reviewRepo.updateReviewInDb(id, updateData);

  if (!review) {
    throw createApiError(404, "Review not found or already deleted");
  }

  return review;
};

// ✅ DELETE REVIEW (SOFT DELETE)
export const deleteReviewService = async (id: string) => {
  const review = await reviewRepo.softDeleteReviewInDb(id);

  if (!review) {
    throw createApiError(404, "Review not found or already deleted");
  }

  return review;
};
