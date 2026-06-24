import { SocialProofEvent, ISocialProofEvent, SocialProofEventType } from "../models/socialProofEvent.model";

/**
 * Creates and persists a Social Proof Event in the database.
 * 
 * @param {Partial<ISocialProofEvent>} data - The social proof event data to persist.
 * @returns {Promise<ISocialProofEvent>} The created social proof event document.
 */
export const createSocialProofEventInDb = async (
  data: Partial<ISocialProofEvent>
): Promise<ISocialProofEvent> => {
  return await SocialProofEvent.create(data);
};

/**
 * Counts Social Proof Events by type within a date range.
 *
 * **Aggregation Strategy:**
 * Uses MongoDB aggregation pipeline with $match for efficient date + type filtering.
 * Compound index on (type, createdAt) optimizes this query pattern.
 *
 * @param {SocialProofEventType} eventType - The type of event to count
 * @param {Date} startDate - Start of the date range (inclusive)
 * @param {Date} endDate - End of the date range (inclusive)
 * @returns {Promise<number>} The count of events matching the criteria
 */
export const countEventsByTypeInDateRange = async (
  eventType: SocialProofEventType,
  startDate: Date,
  endDate: Date
): Promise<number> => {
  return await SocialProofEvent.countDocuments({
    type: eventType,
    createdAt: { $gte: startDate, $lte: endDate },
  });
};

/**
 * Counts distinct active users based on Social Proof event activity within a date range.
 *
 * **Active User Definition:**
 * A user is considered "active" if they have generated any Social Proof event
 * (SIGNUP, PURCHASE, REVIEW, VIEW) within the specified time window.
 * Uses MongoDB aggregation with $group to count unique userIds.
 *
 * **Query Optimization:**
 * - Filters by date range first to reduce dataset
 * - Excludes null userIds (anonymous/guest events)
 * - Uses $group with distinct userId count
 *
 * @param {Date} startDate - Start of the date range (inclusive)
 * @param {Date} endDate - End of the date range (inclusive)
 * @returns {Promise<number>} The count of distinct active users
 */
export const countDistinctActiveUsersInDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<number> => {
  const result = await SocialProofEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        userId: { $ne: null }, // Exclude anonymous/guest events
      },
    },
    {
      $group: {
        _id: "$userId",
      },
    },
    {
      $count: "activeUsers",
    },
  ]);

  // Return 0 if no active users found
  return result.length > 0 ? result[0].activeUsers : 0;
};

/**
 * Retrieves the most recent Social Proof Events from the database.
 *
 * @param {number} limit - The maximum number of events to retrieve.
 * @returns {Promise<ISocialProofEvent[]>} A promise that resolves to an array of recent social proof event documents.
 */
export const findRecentSocialProofEventsInDb = async (
  limit: number
): Promise<ISocialProofEvent[]> => {
  return await SocialProofEvent.find()
    .sort({ createdAt: -1 }) // Sort by newest first
    .limit(limit)
    .lean(); // Return plain JavaScript objects
};
