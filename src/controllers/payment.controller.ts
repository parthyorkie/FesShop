import { Request, Response } from "express";
import { createApiError } from "../utils/ApiError";
import { createApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import * as paymentService from "../services/payment.service";

export const createRazorpayOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw createApiError(401, "Not authorized");

  const paymentOrder = await paymentService.createRazorpayOrder(req.body.orderId, userId);
  res.status(201).json(createApiResponse(201, paymentOrder, "Payment order created"));
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw createApiError(401, "Not authorized");

  const result = await paymentService.verifyPaymentSignature(req.body, userId);
  res.status(200).json(createApiResponse(200, result, "Payment verified successfully"));
});

export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.headers["x-razorpay-signature"];
  if (!rawBody || typeof signature !== "string") {
    throw createApiError(400, "Missing webhook signature or raw request body");
  }

  const result = await paymentService.handleWebhook(req.body, signature, rawBody);
  res.status(200).json(createApiResponse(200, result, "Webhook processed"));
});