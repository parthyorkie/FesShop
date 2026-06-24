import mongoose, { Types } from "mongoose";
import { IReview, Review } from "../models/review.model";

// 🔹 Utils
const toObjectId = (id: string) => new Types.ObjectId(id);

// ✅ Create Review
export const createReviewInDb = async (
  data: Partial<IReview>
): Promise<IReview> => {
  return await Review.create(data);
};

// ✅ Find Review by ID (excluding soft-deleted)
export const findReviewById = async (
  id: string
): Promise<IReview | null> => {
  return await Review.findOne({
    _id: toObjectId(id),
    isDeleted: false,
  })
    .populate([
      { path: "userId", select: "name email" },
      { path: "productId", select: "name" },
    ])
    .lean();
};

// ✅ Find All Reviews (pagination + filters)
export const findAllReviews = async (
  filter: Record<string, any>,
  skip: number,
  limit: number
): Promise<{ data: IReview[]; total: number }> => {
  const query = {
    ...filter,
    isDeleted: false,
  };

  const [data, total] = await Promise.all([
    Review.find(query)
      .populate([
        { path: "userId", select: "name email" },
        { path: "productId", select: "name" },
      ])
      .sort({ createdAt: -1 }) // 🔥 latest first
      .skip(skip)
      .limit(limit)
      .lean(),

    Review.countDocuments(query),
  ]);

  return { data, total };
};

// ✅ Update Review
export const updateReviewInDb = async (
  id: string,
  updateData: mongoose.UpdateQuery<IReview>
): Promise<IReview | null> => {
  return await Review.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  )
    .populate([
      { path: "userId", select: "name email" },
      { path: "productId", select: "name" },
    ])
    .lean();
};

// ✅ Soft Delete Review
export const softDeleteReviewInDb = async (
  id: string
): Promise<IReview | null> => {
  return await Review.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { isDeleted: true },
    { new: true }
  ).lean();
};
