import { Router } from "express";
import {
  createReview,
  deleteReview,
  getReview,
  listReviews,
  updateReview,
} from "../controllers/review.controller";

import { validate } from "../middlewares/validate.middleware";
import {
  createReviewSchema,
  reviewIdSchema,
  listReviewsSchema,
  updateReviewSchema,
} from "../validations/review.validation";

import { authenticate, authorizeRole } from "../middlewares/auth.middleware";

const router = Router();

// ✅ CREATE REVIEW (authenticated users)
router.post(
  "/",
  authenticate,
  validate(createReviewSchema),
  createReview
);

// ✅ LIST REVIEWS (public)
router.get(
  "/",
  validate(listReviewsSchema),
  listReviews
);

// ✅ GET SINGLE REVIEW (public)
router.get(
  "/:id",
  validate(reviewIdSchema),
  getReview
);

// ✅ UPDATE REVIEW (authenticated users)
router.put(
  "/:id",
  authenticate,
  validate(updateReviewSchema),
  updateReview
);

// ✅ DELETE REVIEW - SOFT DELETE (admin only)
router.delete(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(reviewIdSchema),
  deleteReview
);

export default router;
