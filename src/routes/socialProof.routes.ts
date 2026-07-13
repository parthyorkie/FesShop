import { Router } from "express";
import { getRecentSocialProofEvents, getSocialProofMetricsController } from "../controllers/socialProof.controller";
import { validate } from "../middlewares/validate.middleware";
import { getRecentEventsSchema } from "../validations/socialProof.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Social Proof
 *   description: Social proof event management
 */

router.route("/recent").get(validate(getRecentEventsSchema), getRecentSocialProofEvents);

/**
 * GET /social-proof/metrics
 * Returns aggregated social proof metrics for the current day.
 * No validation required - endpoint has no input parameters.
 */
router.route("/metrics").get(getSocialProofMetricsController);

export default router;
