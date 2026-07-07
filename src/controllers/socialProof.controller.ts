import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createApiResponse } from "../utils/ApiResponse";
import { getRecentSocialProofEventsService, getSocialProofMetrics } from "../services/socialProof.service";
import { logger } from "../utils/logger";
import { SocialProofMetricsDto } from "../dtos/socialProof.dto";

/**
 * @swagger
 * /social-proof/recent:
 *   get:
 *     summary: Get recent social proof events
 *     tags:
 *       - Social Proof
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of recent social proof events to return.
 *     responses:
 *       200:
 *         description: Successfully retrieved recent social proof events.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RecentSocialProofEventDto'
 *                 message:
 *                   type: string
 *                   example: "Recent social proof events fetched successfully"
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request, e.g., invalid limit parameter.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
export const getRecentSocialProofEvents = asyncHandler(async (req: Request, res: Response) => {
  // The limit has already been validated by the validate middleware
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const events = await getRecentSocialProofEventsService(limit);

  res.status(200).json(createApiResponse(200, events, "Recent social proof events fetched successfully"));
});

/**
 * @swagger
 * /social-proof/metrics:
 *   get:
 *     summary: Get aggregated social proof metrics
 *     description: |
 *       Returns aggregated social proof metrics for the current day (UTC-based).
 *       Metrics include counts of signups, purchases, reviews, and active users.
 *     tags:
 *       - Social Proof
 *     responses:
 *       200:
 *         description: Successfully retrieved social proof metrics.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   $ref: '#/components/schemas/SocialProofMetricsDto'
 *                 message:
 *                   type: string
 *                   example: "Social proof metrics fetched successfully"
 *                 success:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
export const getSocialProofMetricsController = asyncHandler(async (_req: Request, res: Response) => {
  // Call existing aggregation service - business logic is in the service layer
  const metrics = await getSocialProofMetrics();

  // Map service response to API DTO format (matches required response structure)
  const metricsDto: SocialProofMetricsDto = {
    signupsToday: metrics.totalSignupsToday,
    purchasesToday: metrics.totalPurchasesToday,
    reviewsToday: metrics.totalReviewsToday,
    activeUsers: metrics.activeUsersCount,
  };

  res.status(200).json(createApiResponse(200, metricsDto, "Social proof metrics fetched successfully"));
});
