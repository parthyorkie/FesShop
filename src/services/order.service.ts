import { Types } from "mongoose";
import * as festivalRepo from "../repositories/festival.repository";
import * as orderRepo from "../repositories/order.repository";
import * as productRepo from "../repositories/product.repository";

import { IOrder } from "../models/order.model";
import { createApiError } from "../utils/ApiError";
import {
  formatPaginationData,
  getPaginationOptions,
} from "../utils/pagination";

// 🔹 Validate Products (important for order integrity)
const validateProducts = async (items: IOrder["items"]) => {
  if (!items?.length) {
    throw createApiError(400, "Order must have at least one item");
  }

  const productIds = items.map((item) => item.product.toString());

  const count = await Promise.all(
    productIds.map((id) => productRepo.findProductById(id)),
  );

  if (count.some((p) => !p)) {
    throw createApiError(400, "One or more products are invalid");
  }
};

// 🔹 Validate Festival (optional)
const validateFestival = async (festival?: Types.ObjectId) => {
  if (!festival) return;

  const exists = await festivalRepo.findFestivalById(festival.toString());

  if (!exists) {
    throw createApiError(400, "Invalid festival");
  }
};

// ✅ CREATE ORDER
export const createOrderService = async (data: Partial<IOrder>) => {
  await validateProducts(data.items || []);
  await validateFestival(data.festival);

  if (!data.customerSnapshot?.phone) {
    throw createApiError(400, "Customer phone is required");
  }

  return await orderRepo.createOrderInDb(data);
};

// ✅ GET SINGLE ORDER
export const getOrderService = async (id: string) => {
  const order = await orderRepo.findOrderById(id);

  if (!order) {
    throw createApiError(404, "Order not found");
  }

  return order;
};

// ✅ LIST ORDERS (FILTER + PAGINATION)
export const listOrdersService = async (query: any) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: Record<string, any> = {};

  // 🔍 Payment Status
  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  // 🔍 Payment Method
  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  // 🔍 Festival
  if (query.festival && Types.ObjectId.isValid(query.festival)) {
    filter.festival = new Types.ObjectId(query.festival);
  }

  // 🔍 Customer
  if (query.customer && Types.ObjectId.isValid(query.customer)) {
    filter.customer = new Types.ObjectId(query.customer);
  }

  // 🔍 Phone (snapshot)
  if (query.phone) {
    filter["customerSnapshot.phone"] = query.phone;
  }

  // 🔍 Search (name/phone)
  if (query.search) {
    filter.$or = [
      {
        "customerSnapshot.name": {
          $regex: query.search,
          $options: "i",
        },
      },
      {
        "customerSnapshot.phone": {
          $regex: query.search,
          $options: "i",
        },
      },
    ];
  }

  // 📅 Date Range
  if (query.startDate || query.endDate) {
    filter.createdAt = {};

    if (query.startDate) {
      filter.createdAt.$gte = new Date(query.startDate);
    }

    if (query.endDate) {
      filter.createdAt.$lte = new Date(query.endDate);
    }
  }

  // 💰 Amount Range
  if (query.minAmount || query.maxAmount) {
    filter.totalAmount = {};

    if (query.minAmount) {
      filter.totalAmount.$gte = Number(query.minAmount);
    }

    if (query.maxAmount) {
      filter.totalAmount.$lte = Number(query.maxAmount);
    }
  }

  const { data, total } = await orderRepo.findAllOrders(filter, skip, limit);

  const pagination = formatPaginationData(total, page, limit);

  return { data, pagination };
};

// ✅ UPDATE ORDER
export const updateOrderService = async (
  id: string,
  updateData: Partial<IOrder>,
) => {
  if (updateData.items) {
    await validateProducts(updateData.items);
  }

  if (updateData.festival) {
    await validateFestival(updateData.festival as Types.ObjectId);
  }

  const order = await orderRepo.updateOrderInDb(id, updateData);

  if (!order) {
    throw createApiError(404, "Order not found or already deleted");
  }

  return order;
};

// ✅ DELETE ORDER (SOFT DELETE)
export const deleteOrderService = async (id: string) => {
  const order = await orderRepo.softDeleteOrderInDb(id);

  if (!order) {
    throw createApiError(404, "Order not found or already deleted");
  }

  return order;
};

// 🔹 Helper for Reorder: Validate products and get latest pricing
const getValidatedProductsWithLatestPricing = async (
  items: IOrder["items"],
) => {

  if (!items?.length) {
    throw createApiError(400, "Order must have at least one item");
  }

  const validatedItems = await Promise.all(
    items.map(async (item) => {

      // 🔥 Fetch latest product
      const product = await productRepo.findProductById(
        item.product.toString(),
      );

      if (!product) {
        throw createApiError(
          400,
          `Product not found: ${item.product}`,
        );
      }

      // 🔥 Optional validations
      if (product.isDeleted) {
        throw createApiError(400, `Product is deleted: ${item.product}`);
      }
      if (product.stock < item.quantity) {
        throw createApiError(400, `Insufficient stock for product: ${item.product}`);
      }

      // 🔥 Latest price
      const latestPrice = Number(product.price);

      return {
        product: product._id,

        // 🔥 Snapshot
        name: product.name,

        quantity: item.quantity,

        // 🔥 Latest price
        price: latestPrice,

        // 🔥 Dynamic total
        total: latestPrice * item.quantity,
      };
    }),
  );

  return validatedItems;
};

// ✅ REORDER
export const reorderService = async (
  id: string,
  paymentMethod?: "CASH" | "UPI" | "CARD",
  paymentStatus?: "PENDING" | "PAID",
) => {

  // 🔥 Step 1: Fetch Existing Order
  const existingOrder = await orderRepo.findOrderById(id);

  if (!existingOrder) {
    throw createApiError(404, "Order not found");
  }

  // 🔥 Step 2: Validate + Get Latest Pricing
  const validatedItems =
    await getValidatedProductsWithLatestPricing(
      existingOrder.items,
    );

  // 🔥 Step 3: Validate Festival
  if (existingOrder.festival) {
    await validateFestival(
      existingOrder.festival as Types.ObjectId,
    );
  }

  // 🔥 Step 4: Recalculate Totals
  const subTotal = validatedItems.reduce(
    (sum, item) => sum + item.total,
    0,
  );

  const discount = existingOrder.discount || 0;

  const totalAmount = subTotal - discount;

  // 🔥 Step 5: Create Fresh Payload
  const newOrderPayload: Partial<IOrder> = {
    customer: existingOrder.customer,

    customerSnapshot: {
      name: existingOrder.customerSnapshot?.name,
      phone: existingOrder.customerSnapshot.phone,
    },

    items: validatedItems,

    festival: existingOrder.festival,

    discount,

    subTotal,

    totalAmount,

    paymentMethod:
      paymentMethod || existingOrder.paymentMethod,

    // 🔥 Backend controlled
    paymentStatus: paymentStatus || "PENDING",
  };

  // 🔥 Step 6: Create Order
  return await orderRepo.createOrderInDb(
    newOrderPayload,
  );
};
