import { ISocialProofEvent, SocialProofEventType } from "../models/socialProofEvent.model";

/**
 * Social Proof Message Generator
 *
 * Converts Social Proof events into user-facing messages by extracting
 * relevant metadata and formatting it into human-readable text.
 *
 * **Extensibility Strategy:**
 * - Message templates are centralized in a single mapping object
 * - Adding new event types requires only updating the MESSAGE_TEMPLATES object
 * - Each template is a function that receives event metadata for flexible formatting
 *
 * **Usage:**
 * ```typescript
 * const message = generateMessage(socialProofEvent);
 * // Returns: "John Doe joined recently"
 * ```
 */

/**
 * Type definition for message template functions.
 * Each template receives event metadata and returns a formatted message string.
 */
type MessageTemplate = (metadata?: Record<string, any>) => string;

/**
 * Centralized message templates for all Social Proof event types.
 *
 * **Design Decision:**
 * Using a mapping object instead of a switch statement makes it trivial to:
 * - Add new event types without modifying control flow logic
 * - Test individual message templates in isolation
 * - Override or extend templates dynamically if needed in the future
 */
const MESSAGE_TEMPLATES: Record<SocialProofEventType, MessageTemplate> = {
  [SocialProofEventType.SIGNUP]: (metadata) => {
    const userName = metadata?.name || "Someone";
    return `${userName} joined recently`;
  },

  [SocialProofEventType.PURCHASE]: (metadata) => {
    console.log("metadata", metadata);
    const userName = metadata?.userName || metadata?.name || "Someone";
    return `${userName}  bought  ${metadata?.productName || "a product"}`;
  },

  [SocialProofEventType.REVIEW]: (metadata) => {
    const userName = metadata?.userName || metadata?.name || "Someone";
    return `${userName} left a review`;
  },

  // Extensible placeholders for future event types
  [SocialProofEventType.VIEW]: (metadata) => {
    const userName = metadata?.userName || metadata?.name || "Someone";
    return `${userName} is viewing a product`;
  },

  [SocialProofEventType.ONLINE_USER]: (metadata) => {
    const userName = metadata?.userName || metadata?.name || "Someone";
    return `${userName} is online`;
  },
};

/**
 * Generates a user-facing message from a Social Proof event.
 *
 * **Implementation Notes:**
 * - Falls back to "Someone" if user name is not available in metadata
 * - Returns a generic fallback message for unknown event types
 * - Does not throw errors for missing metadata (graceful degradation)
 *
 * @param {ISocialProofEvent} event - The social proof event document
 * @returns {string} A human-readable message describing the event
 *
 * @example
 * // SIGNUP event with name metadata
 * generateMessage({
 *   type: SocialProofEventType.SIGNUP,
 *   metadata: { name: "John Doe" }
 * });
 * // Returns: "John Doe joined recently"
 *
 * @example
 * // PURCHASE event without metadata
 * generateMessage({
 *   type: SocialProofEventType.PURCHASE,
 *   metadata: {}
 * });
 * // Returns: "Someone completed a purchase"
 */
export const generateMessage = (event: ISocialProofEvent): string => {
  const template = MESSAGE_TEMPLATES[event.type];

  if (template) {
    return template(event.metadata);
  }

  // Fallback for unknown event types (future-proofing)
  return "A recent activity occurred";
};
