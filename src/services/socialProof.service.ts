import {
  createSocialProofEventInDb,
  findRecentSocialProofEventsInDb,
  countEventsByTypeInDateRange,
  countDistinctActiveUsersInDateRange,
} from "../repositories/socialProofEvent.repository";
import { findUserById } from "../repositories/user.repository";
import { findProductById } from "../repositories/product.repository";
import { trackEventSchema } from "../validations/socialProof.validation";
import { createApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { generateMessage } from "../utils/socialProofMessage";
import { ISocialProofEvent, SocialProofEventType } from "../models/socialProofEvent.model";
import { RecentSocialProofEventDto } from "../dtos/socialProof.dto";
import { broadcastSocialProofEvent } from "./socket.service";
import Joi from "joi";

/**
 * Duplicate Broadcast Prevention
 *
 * **Implementation Strategy:**
 * - In-memory Set to track broadcasted event IDs
 * - Prevents duplicate broadcasts for the same event
 * - Automatically cleans up old entries after 1 hour (prevents memory leak)
 *
 * **Design Decision:**
 * Using a Set instead of more complex solutions (Redis, DB flags) because:
 * - Minimal complexity: No external dependencies
 * - Server restart clears the cache (acceptable for this use case)
 * - Performance: O(1) lookup time
 * - Memory efficient: Only stores event IDs as strings
 *
 * **Cleanup Strategy:**
 * Old entries are removed after 1 hour to prevent unbounded memory growth.
 * This is acceptable because:
 * - Events older than 1 hour are unlikely to be re-broadcast
 * - Worst case: Duplicate broadcast after server restart (rare, non-critical)
 */
const broadcastedEventIds = new Set<string>();

/**
 * Removes an event ID from the broadcast cache after a delay.
 * Prevents unbounded memory growth.
 *
 * @param {string} eventId - The event ID to remove from cache
 */
const scheduleEventIdCleanup = (eventId: string): void => {
  const CLEANUP_DELAY_MS = 60 * 60 * 1000; // 1 hour
  setTimeout(() => {
    broadcastedEventIds.delete(eventId);
    logger.debug(`[SocialProof] Cleaned up broadcasted event ID from cache - eventId: ${eventId}`);
  }, CLEANUP_DELAY_MS);
};

/**
 * Validates and tracks/persists a Social Proof event.
 *
 * @param {any} payload - The social proof event payload to track.
 * @returns {Promise<ISocialProofEvent>} The persisted social proof event document.
 * @throws {IApiError} If validation fails or reference entities do not exist.
 */
export const trackEvent = async (payload: any): Promise<ISocialProofEvent> => {
  const eventType = payload?.type;
  const productId = payload?.productId;
  const userId = payload?.userId;

  // Log: Event tracking started
  logger.info(
    `[SocialProofEvent] Event tracking started - eventType: ${eventType || "N/A"}, productId: ${productId || "N/A"}, userId: ${userId || "N/A"}`
  );

  // 1. Validate payload structure using Joi
  const schema = Joi.object(trackEventSchema);
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    // Log: Validation failed
    logger.warn(
      `[SocialProofEvent] Validation failed - eventType: ${eventType || "N/A"}, productId: ${productId || "N/A"}, userId: ${userId || "N/A"} - Error: ${errorMessage}`
    );
    throw createApiError(400, errorMessage, error.details);
  }

  try {
    // 2. Validate referenced User if provided
    if (value.userId) {
      const user = await findUserById(value.userId);
      if (!user) {
        const msg = `User with ID ${value.userId} does not exist`;
        logger.warn(
          `[SocialProofEvent] Validation failed - User reference not found - userId: ${value.userId}`
        );
        throw createApiError(400, msg);
      }
    }

    // 3. Validate referenced Product if provided
    if (value.productId) {
      const product = await findProductById(value.productId);
      if (!product) {
        const msg = `Product with ID ${value.productId} does not exist`;
        logger.warn(
          `[SocialProofEvent] Validation failed - Product reference not found - productId: ${value.productId}`
        );
        throw createApiError(400, msg);
      }
    }

    // 4. Persist the event in the database
    const persistedEvent = await createSocialProofEventInDb(value);

    // Log: Event persisted successfully
    logger.info(
      `[SocialProofEvent] Event persisted successfully - id: ${persistedEvent._id}, eventType: ${persistedEvent.type}, productId: ${persistedEvent.productId || "N/A"}, userId: ${persistedEvent.userId || "N/A"}`
    );

    // 5. Broadcast event to connected clients (non-blocking, after successful persistence)
    try {
      const eventId = persistedEvent._id.toString();

      // Check for duplicate broadcast
      if (broadcastedEventIds.has(eventId)) {
        logger.warn(
          `[SocialProof] Duplicate broadcast prevented - eventId: ${eventId} already broadcasted`
        );
      } else {
        // Generate user-facing message
        const message = generateMessage(persistedEvent);

        // Broadcast to all connected clients
        broadcastSocialProofEvent({
          id: eventId,
          type: persistedEvent.type,
          message,
          createdAt: persistedEvent.createdAt,
        });

        // Mark as broadcasted to prevent duplicates
        broadcastedEventIds.add(eventId);

        // Schedule cleanup to prevent memory leak
        scheduleEventIdCleanup(eventId);

        logger.info(
          `[SocialProof] Event broadcast triggered - eventId: ${eventId}, message: "${message}"`
        );
      }
    } catch (broadcastErr: any) {
      // ERROR HANDLING: Broadcast failures must NOT break event creation
      logger.error(
        `[SocialProof] Broadcast failed but event persisted successfully - eventId: ${persistedEvent._id}, error: ${broadcastErr.message}`
      );
      // Do not throw - event creation succeeded
    }

    return persistedEvent;
  } catch (err: any) {
    // Handle operational errors thrown by reference checks
    if (err.isOperational) {
      throw err;
    }

    // Log: Persistence failed or unexpected exception
    logger.error(
      `[SocialProofEvent] Persistence failed - eventType: ${eventType || "N/A"}, productId: ${productId || "N/A"}, userId: ${userId || "N/A"} - Error: ${err.message}`
    );

    // Do not expose internal database details, throw a safe generic error
    throw createApiError(500, "Failed to persist social proof event");
  }
};

/**
 * Retrieves the most recent Social Proof Events.
 *
 * @param {number} limit - The maximum number of events to retrieve.
 * @returns {Promise<RecentSocialProofEventDto[]>} A promise that resolves to an array of recent social proof event DTOs.
 */
export const getRecentSocialProofEventsService = async (
  limit: number
): Promise<RecentSocialProofEventDto[]> => {
  logger.info(`[SocialProof] Fetching recent social proof events with limit: ${limit}`);

  const events = await findRecentSocialProofEventsInDb(limit);

  // Map to DTO using the centralized message generator
  const eventDtos: RecentSocialProofEventDto[] = events.map((event) => ({
    id: event._id.toString(),
    message: generateMessage(event),
    createdAt: event.createdAt,
  }));

  logger.info(`[SocialProof] Successfully fetched ${eventDtos.length} recent social proof events`);
  return eventDtos;
};

/**
 * Social Proof Metrics Interface
 *
 * Represents aggregated social proof metrics for internal use.
 * NOT exposed via API — intended for internal services, dashboards, or analytics.
 */
export interface SocialProofMetrics {
  /** Total SIGNUP events created today */
  totalSignupsToday: number;
  /** Total PURCHASE events created today */
  totalPurchasesToday: number;
  /** Total REVIEW events created today */
  totalReviewsToday: number;
  /** Count of distinct users who generated events today */
  activeUsersCount: number;
}

/**
 * Retrieves aggregated Social Proof metrics for internal use.
 *
 * **Aggregation Strategy:**
 * - Uses individual count queries per event type for clarity and maintainability
 * - Queries are parallelized using Promise.all for optimal performance
 * - Date range is calculated based on server timezone (start of today to end of today)
 *
 * **Active User Calculation:**
 * Active users are determined by counting distinct userIds from all Social Proof events
 * created today. This includes users who performed SIGNUP, PURCHASE, REVIEW, or VIEW actions.
 * Anonymous/guest events (with null userId) are excluded from the count.
 *
 * **Date Handling:**
 * Uses UTC-based date boundaries to ensure consistent aggregation across time zones.
 * The "today" range spans from 00:00:00.000 UTC to 23:59:59.999 UTC of the current date.
 *
 * @returns {Promise<SocialProofMetrics>} Aggregated metrics object
 * @throws {IApiError} If database query fails
 */
export const getSocialProofMetrics = async (): Promise<SocialProofMetrics> => {
  logger.info("[SocialProof] Metrics aggregation started");

  try {
    // Calculate today's date range (UTC-based for consistency)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // Execute all aggregation queries in parallel for optimal performance
    const [totalSignupsToday, totalPurchasesToday, totalReviewsToday, activeUsersCount] =
      await Promise.all([
        countEventsByTypeInDateRange(SocialProofEventType.SIGNUP, startOfToday, endOfToday),
        countEventsByTypeInDateRange(SocialProofEventType.PURCHASE, startOfToday, endOfToday),
        countEventsByTypeInDateRange(SocialProofEventType.REVIEW, startOfToday, endOfToday),
        countDistinctActiveUsersInDateRange(startOfToday, endOfToday),
      ]);

    const metrics: SocialProofMetrics = {
      totalSignupsToday,
      totalPurchasesToday,
      totalReviewsToday,
      activeUsersCount,
    };

    logger.info(
      `[SocialProof] Metrics aggregation completed - signups: ${totalSignupsToday}, purchases: ${totalPurchasesToday}, reviews: ${totalReviewsToday}, activeUsers: ${activeUsersCount}`
    );

    return metrics;
  } catch (err: any) {
    // Log failure with context
    logger.error(`[SocialProof] Metrics aggregation failed - Error: ${err.message}`);

    // Do not expose internal database details
    throw createApiError(500, "Failed to retrieve social proof metrics");
  }
};
