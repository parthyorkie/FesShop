/**
 * @swagger
 * components:
 *   schemas:
 *     RecentSocialProofEventDto:
 *       type: object
 *       required:
 *         - id
 *         - message
 *         - createdAt
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier of the social proof event.
 *           example: "652a2b2e8c1d2f3a4b5c6d7e"
 *         message:
 *           type: string
 *           description: A human-readable message describing the social proof event.
 *           example: "User joined recently"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the social proof event occurred.
 *           example: "2026-01-01T00:00:00.000Z"
 */
export interface RecentSocialProofEventDto {
  id: string;
  message: string;
  createdAt: Date;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SocialProofMetricsDto:
 *       type: object
 *       required:
 *         - signupsToday
 *         - purchasesToday
 *         - reviewsToday
 *         - activeUsers
 *       properties:
 *         signupsToday:
 *           type: integer
 *           description: Total SIGNUP events created today (UTC-based).
 *           example: 25
 *         purchasesToday:
 *           type: integer
 *           description: Total PURCHASE events created today (UTC-based).
 *           example: 8
 *         reviewsToday:
 *           type: integer
 *           description: Total REVIEW events created today (UTC-based).
 *           example: 12
 *         activeUsers:
 *           type: integer
 *           description: Count of distinct users who generated events today.
 *           example: 102
 */
export interface SocialProofMetricsDto {
  signupsToday: number;
  purchasesToday: number;
  reviewsToday: number;
  activeUsers: number;
}
