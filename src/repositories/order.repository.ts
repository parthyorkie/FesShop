import mongoose, { Types } from "mongoose";
import { IOrder, Order } from "../models/order.model";

// 🔹 Utils
const toObjectId = (id: string) => new Types.ObjectId(id);

// 🔹 Common populate config (centralized)
const ORDER_POPULATE = [
  { path: "customer", select: "name phone" },
  { path: "festival", select: "name" },
  { path: "items.product", select: "name price" },
];

// ✅ Create Order
export const createOrderInDb = async (
  data: Partial<IOrder>
): Promise<IOrder> => {
  return await Order.create(data);
};

// ✅ Find Order by ID
export const findOrderById = async (
  id: string
): Promise<IOrder | null> => {
  return await Order.findOne({
    _id: toObjectId(id),
    isDeleted: false,
  })
    .populate(ORDER_POPULATE)
    .lean();
};

// ✅ Find All Orders (pagination + filters)
export const findAllOrders = async (
  filter: Record<string, any>,
  skip: number,
  limit: number
): Promise<{ data: IOrder[]; total: number }> => {
  const query = {
    ...filter,
    isDeleted: false,
  };

  const [data, total] = await Promise.all([
    Order.find(query)
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1 }) // 🔥 latest first
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments(query),
  ]);

  return { data, total };
};

// ✅ Update Order
export const updateOrderInDb = async (
  id: string,
  data: mongoose.UpdateQuery<IOrder>
): Promise<IOrder | null> => {
  return await Order.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    data,
    {
      new: true,
      runValidators: true,
    }
  )
    .populate(ORDER_POPULATE)
    .lean();
};

// ✅ Soft Delete Order
export const softDeleteOrderInDb = async (
  id: string
): Promise<IOrder | null> => {
  return await Order.findOneAndUpdate(
    { _id: toObjectId(id), isDeleted: false },
    { isDeleted: true },
    { new: true }
  ).lean();
};