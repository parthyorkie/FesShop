import Joi from "joi";

// 🔹 Shared ObjectId pattern validator
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("{{#label}} must be a valid MongoDB ObjectId");

// ✅ Create Review Schema
export const createReviewSchema = Joi.object({
  userId: objectId.required().messages({
    "any.required": "userId is required",
  }),
  productId: objectId.required().messages({
    "any.required": "productId is required",
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.min": "Rating must be at least 1",
    "number.max": "Rating must be at most 5",
    "any.required": "Rating is required",
  }),
  comment: Joi.string().trim().max(1000).optional(),
});

// ✅ Get/Delete Review Schema (ID only)
export const reviewIdSchema = Joi.object({
  id: objectId.required().messages({
    "any.required": "Review ID is required",
  }),
});

// ✅ Update Review Schema
export const updateReviewSchema = Joi.object({
  id: objectId.required().messages({
    "any.required": "Review ID is required",
  }),
  rating: Joi.number().integer().min(1).max(5).optional().messages({
    "number.min": "Rating must be at least 1",
    "number.max": "Rating must be at most 5",
  }),
  comment: Joi.string().trim().max(1000).optional(),
}).or("rating", "comment"); // At least one updatable field required

// ✅ List Reviews Schema (query params)
export const listReviewsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  productId: objectId.optional(),
  userId: objectId.optional(),
});
