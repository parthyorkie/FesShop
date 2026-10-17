import Joi from "joi";
import { Types } from "mongoose";

const objectId = (value: string, helpers: Joi.CustomHelpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error("string.hex");
  }
  return value;
};

export const createRazorpayOrderSchema = {
  body: Joi.object({
    orderId: Joi.string().custom(objectId).required(),
  }),
};

export const verifyPaymentSignatureSchema = {
  body: Joi.object({
    razorpay_order_id: Joi.string().trim().required(),
    razorpay_payment_id: Joi.string().trim().required(),
    razorpay_signature: Joi.string().hex().length(64).required(),
    internalOrderId: Joi.string().custom(objectId).required(),
  }),
};