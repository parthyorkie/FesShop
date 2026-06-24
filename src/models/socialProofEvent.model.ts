import { Document, Schema, Types, model } from "mongoose";

/**
 * Supported event types for Social Proof events.
 */
export enum SocialProofEventType {
  PURCHASE = "PURCHASE",
  SIGNUP = "SIGNUP",
  REVIEW = "REVIEW",
  VIEW = "VIEW",
  ONLINE_USER = "ONLINE_USER",
}

/**
 * TypeScript interface representing a SocialProofEvent document in MongoDB.
 *
 * @interface ISocialProofEvent
 * @extends {Document}
 */
export interface ISocialProofEvent extends Document {
  /** The unique identifier of the event */
  _id: Types.ObjectId;

  /** The type of the social proof event (e.g., PURCHASE, SIGNUP) */
  type: SocialProofEventType;

  /** The reference to the User associated with the event (optional for anonymous/guest events) */
  userId?: Types.ObjectId;

  /** The reference to the Product associated with the event (optional for non-product specific events like SIGNUP) */
  productId?: Types.ObjectId;

  /** Additional dynamic metadata associated with the event stored as a JSON object */
  metadata?: Record<string, any>;

  /** Timestamp when the event was created */
  createdAt: Date;

  /** Timestamp when the event was last updated */
  updatedAt: Date;
}

/**
 * Mongoose Schema definition for the SocialProofEvent model.
 */
const SocialProofEventSchema = new Schema<ISocialProofEvent>(
  {
    type: {
      type: String,
      enum: Object.values(SocialProofEventType),
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Indexes (Query-driven optimization)

// Index for sorting and retrieving recent events (e.g., dashboard, live feed)
SocialProofEventSchema.index({ createdAt: -1 });

// Index for retrieving events for a specific product
SocialProofEventSchema.index({ productId: 1 });

// Index for retrieving events for a specific user
SocialProofEventSchema.index({ userId: 1 });

// Index for filtering events by type (e.g., all recent purchase events)
SocialProofEventSchema.index({ type: 1 });

// Compound index for querying a product's events of a specific type sorted by recency
SocialProofEventSchema.index({ productId: 1, type: 1, createdAt: -1 });

/**
 * Mongoose model for the SocialProofEvent collection.
 */
export const SocialProofEvent = model<ISocialProofEvent>(
  "SocialProofEvent",
  SocialProofEventSchema
);
