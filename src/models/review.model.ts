import { Document, Schema, Types, model } from "mongoose";

/**
 * TypeScript interface representing a Review document in MongoDB.
 *
 * @interface IReview
 * @extends {Document}
 */
export interface IReview extends Document {
  /** The unique identifier of the review */
  _id: Types.ObjectId;

  /** The reference to the User who wrote the review */
  userId: Types.ObjectId;

  /** The reference to the Product being reviewed */
  productId: Types.ObjectId;

  /** Star rating from 1 to 5 */
  rating: number;

  /** Review text comment */
  comment?: string;

  /** Soft delete flag */
  isDeleted: boolean;

  /** Timestamp when the review was created */
  createdAt: Date;

  /** Timestamp when the review was last updated */
  updatedAt: Date;
}

/**
 * Mongoose Schema definition for the Review model.
 */
const ReviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Indexes (Query-driven optimization)

// Index for retrieving reviews for a specific product (most common query)
ReviewSchema.index({ productId: 1 });

// Index for retrieving reviews written by a specific user
ReviewSchema.index({ userId: 1 });

// Compound index for querying a product's reviews sorted by recency
ReviewSchema.index({ productId: 1, createdAt: -1 });

// Index for soft-delete filtering
ReviewSchema.index({ isDeleted: 1 });

/**
 * Mongoose model for the Review collection.
 */
export const Review = model<IReview>("Review", ReviewSchema);
