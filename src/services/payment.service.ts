import { createHmac, timingSafeEqual } from "crypto";
import mongoose, { Types } from "mongoose";
import { config } from "../config/config";
import { razorpay } from "../config/razorpay";
import { Order } from "../models/order.model";
import { Product } from "../models/product.model";
import { Transaction } from "../models/transaction.model";
import { oneSignalService } from "./oneSignal.service";
import { socketService } from "./socket.service";
import { createApiError } from "../utils/ApiError";

interface PaymentSignaturePayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  internalOrderId: string;
}

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  error_description?: string;
  error_reason?: string;
}

interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: { id?: string; amount_paid?: number; currency?: string } };
  };
}

const isSignatureValid = (expected: string, received: string): boolean => {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length
    && expectedBuffer.length > 0
    && timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getPaymentOrder = async (orderId: string) => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw createApiError(400, "Invalid order ID");
  }

  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order) {
    throw createApiError(404, "Order not found");
  }

  const payableAmount = Number(order.totalAmount);
  if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
    throw createApiError(400, "Order has an invalid payable amount");
  }

  return { order, payableAmount };
};

export const createRazorpayOrder = async (orderId: string, userId: string) => {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    throw createApiError(503, "Razorpay is not configured");
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw createApiError(401, "Invalid authenticated user");
  }

  const { order, payableAmount } = await getPaymentOrder(orderId);
  if (order.paymentStatus === "PAID") {
    throw createApiError(409, "Order has already been paid");
  }

  const existingTransaction = await Transaction.findOne({
    orderId: order._id,
    paymentGateway: "RAZORPAY",
  });
  if (existingTransaction?.userId && existingTransaction.userId.toString() !== userId) {
    throw createApiError(403, "This order is associated with another user");
  }

  if (
    order.paymentStatus === "PENDING"
    && existingTransaction?.status === "PENDING"
    && existingTransaction.razorpayOrderId === order.razorpayOrderId
  ) {
    return {
      razorpayOrderId: existingTransaction.razorpayOrderId,
      amount: Math.round(existingTransaction.amount * 100),
      currency: existingTransaction.currency || "INR",
      keyId: config.RAZORPAY_KEY_ID,
    };
  }

  const amountInSubunits = Math.round(payableAmount * 100);
  const razorpayOrder = await razorpay.orders.create({
    amount: amountInSubunits,
    currency: "INR",
    receipt: order._id.toString(),
    notes: { internalOrderId: order._id.toString() },
  });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          isDeleted: false,
          paymentStatus: { $in: ["UNPAID", "PENDING", "FAILED"] },
        },
        {
          $set: { paymentStatus: "PENDING", razorpayOrderId: razorpayOrder.id },
        },
        { new: true, session },
      );

      if (!updatedOrder) {
        throw createApiError(409, "Order is not available for payment");
      }

      await Transaction.findOneAndUpdate(
        { orderId: order._id, paymentGateway: "RAZORPAY" },
        {
          $set: {
            order: order._id,
            userId: new Types.ObjectId(userId),
            amount: payableAmount,
            currency: "INR",
            paymentGateway: "RAZORPAY",
            razorpayOrderId: razorpayOrder.id,
            status: "PENDING",
            paymentMethod: "RAZORPAY",
            type: "SALE",
            isDeleted: false,
          },
          $unset: { razorpayPaymentId: "", razorpaySignature: "" },
        },
        { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: config.RAZORPAY_KEY_ID,
  };
};

const completePayment = async (
  internalOrderId: string,
  razorpayOrderId: string,
  razorpayPaymentId?: string,
  signature?: string,
  userId?: string,
  expectedAmount?: number,
) => {
  if (!Types.ObjectId.isValid(internalOrderId)) {
    throw createApiError(400, "Invalid internal order ID");
  }

  const session = await mongoose.startSession();
  let paidUserId = userId;
  let transactionId: string | undefined;
  let alreadyProcessed = false;

  try {
    await session.withTransaction(async () => {
      const transaction = await Transaction.findOne({
        orderId: internalOrderId,
        paymentGateway: "RAZORPAY",
        razorpayOrderId,
      }).session(session);

      if (!transaction) {
        throw createApiError(404, "Payment transaction not found");
      }
      if (userId && transaction.userId?.toString() !== userId) {
        throw createApiError(403, "Payment transaction belongs to another user");
      }
      paidUserId = transaction.userId?.toString() || userId;
      transactionId = transaction._id.toString();

      const order = await Order.findOne({ _id: internalOrderId, isDeleted: false }).session(session);
      if (!order || order.razorpayOrderId !== razorpayOrderId) {
        throw createApiError(404, "Order does not match this Razorpay payment");
      }

      if (Math.round(transaction.amount * 100) !== Math.round(Number(order.totalAmount) * 100)) {
        throw createApiError(409, "Order amount changed after payment was initiated");
      }

      if (expectedAmount !== undefined && expectedAmount !== Math.round(Number(order.totalAmount) * 100)) {
        throw createApiError(400, "Payment amount does not match the order amount");
      }
      if (order.paymentStatus === "PAID" && transaction.status === "SUCCESS") {
        alreadyProcessed = true;
        return;
      }
      if (order.paymentStatus === "PAID") {
        throw createApiError(409, "Order is already paid by another transaction");
      }

      order.paymentStatus = "PAID";
      await order.save({ session });

      transaction.status = "SUCCESS";
      if (razorpayPaymentId) transaction.razorpayPaymentId = razorpayPaymentId;
      if (signature) transaction.razorpaySignature = signature;
      await transaction.save({ session });

      for (const item of order.items) {
        const inventoryUpdate = await Product.updateOne(
          {
            _id: item.product,
            isDeleted: false,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { session },
        );

        if (inventoryUpdate.modifiedCount !== 1) {
          throw createApiError(409, `Insufficient stock for product ${item.product.toString()}`);
        }
      }
    });
  } finally {
    await session.endSession();
  }

  if (!alreadyProcessed && paidUserId && transactionId) {
    socketService.emitPaymentSuccess(paidUserId, {
      orderId: internalOrderId,
      transactionId,
      paymentStatus: "PAID",
    });
    await oneSignalService.sendOrderConfirmationNotification(paidUserId, internalOrderId);
  }

  return { success: true, orderId: internalOrderId, alreadyProcessed };
};

export const verifyPaymentSignature = async (payload: PaymentSignaturePayload, userId: string) => {
  if (!config.RAZORPAY_KEY_SECRET) {
    throw createApiError(503, "Razorpay is not configured");
  }

  const expectedSignature = createHmac("sha256", config.RAZORPAY_KEY_SECRET)
    .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
    .digest("hex");

  if (!isSignatureValid(expectedSignature, payload.razorpay_signature)) {
    throw createApiError(400, "Invalid payment signature");
  }

  return completePayment(
    payload.internalOrderId,
    payload.razorpay_order_id,
    payload.razorpay_payment_id,
    payload.razorpay_signature,
    userId,
  );
};

export const handleWebhook = async (
  event: RazorpayWebhookEvent,
  signature: string,
  rawBody: Buffer,
) => {
  if (!config.RAZORPAY_WEBHOOK_SECRET) {
    throw createApiError(503, "Razorpay webhook is not configured");
  }
  if (!signature || !Buffer.isBuffer(rawBody)) {
    throw createApiError(400, "Missing webhook signature or raw request body");
  }

  const expectedSignature = createHmac("sha256", config.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  if (!isSignatureValid(expectedSignature, signature)) {
    throw createApiError(400, "Invalid webhook signature");
  }

  if (![
    "payment.captured",
    "order.paid",
    "payment.failed",
  ].includes(event.event || "")) {
    return { success: true, processed: false };
  }

  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id || order?.id;
  if (!razorpayOrderId) {
    throw createApiError(400, "Webhook does not contain a Razorpay order ID");
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const transaction = await Transaction.findOne({
      razorpayOrderId,
      paymentGateway: "RAZORPAY",
    }).select("orderId");

    if (!transaction?.orderId) {
      throw createApiError(404, "Payment transaction not found");
    }

    const amount = payment?.amount ?? order?.amount_paid;
    const currency = payment?.currency ?? order?.currency;
    if (currency && currency !== "INR") {
      throw createApiError(400, "Unexpected payment currency");
    }

    return completePayment(
      transaction.orderId.toString(),
      razorpayOrderId,
      payment?.id,
      undefined,
      undefined,
      amount,
    );
  }

  if (event.event === "payment.failed") {
    const session = await mongoose.startSession();
    let failedUserId: string | undefined;
    let failedOrderId: string | undefined;
    let newlyFailed = false;
    const failureReason = payment?.error_description || payment?.error_reason || "Payment failed";
    try {
      await session.withTransaction(async () => {
        const transaction = await Transaction.findOne({
          razorpayOrderId,
          paymentGateway: "RAZORPAY",
        }).session(session);

        if (!transaction) {
          throw createApiError(404, "Payment transaction not found");
        }
        if (transaction.status === "SUCCESS" || transaction.status === "FAILED") return;

        transaction.status = "FAILED";
        if (payment?.id) transaction.razorpayPaymentId = payment.id;
        await transaction.save({ session });
        failedUserId = transaction.userId?.toString();
        failedOrderId = transaction.orderId?.toString();
        newlyFailed = true;

        await Order.updateOne(
          { _id: transaction.orderId, paymentStatus: { $in: ["UNPAID", "PENDING"] } },
          { $set: { paymentStatus: "FAILED" } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (newlyFailed && failedUserId && failedOrderId) {
      socketService.emitPaymentFailed(failedUserId, {
        orderId: failedOrderId,
        reason: failureReason,
      });
    }

    return { success: true, processed: true };
  }

  return { success: true, processed: false };
};