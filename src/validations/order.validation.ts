import Joi from "joi";
import { Types } from "mongoose";

// 🔹 Reusable ObjectId validator (same pattern as yours)
const objectId = (value: string, helpers: any) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};



// ✅ CREATE ORDER
export const createOrderSchema = {
  body: Joi.object().keys({
    customer: Joi.string().custom(objectId),

    customerSnapshot: Joi.object({
      name: Joi.string().trim().allow("", null),
      phone: Joi.string().required(),
    }).required(),

    items: Joi.array()
      .items(
        Joi.object({
          product: Joi.string().custom(objectId).required(),
          name: Joi.string().required().trim(), // snapshot
          quantity: Joi.number().integer().min(1).required(),
          price: Joi.number().min(0).required(),
          total: Joi.number().min(0).required(),
        })
      )
      .min(1)
      .required(),

    subTotal: Joi.number().min(0), // calculated but allow input
    discount: Joi.number().min(0).default(0),
    totalAmount: Joi.number().min(0),

    festival: Joi.string().custom(objectId),

    paymentMethod: Joi.string().valid("CASH", "UPI", "CARD"),
    paymentStatus: Joi.string().valid("PENDING", "PAID"),
  }),
};



// ✅ UPDATE ORDER
export const updateOrderSchema = {
  body: Joi.object()
    .keys({
      customer: Joi.string().custom(objectId),

      customerSnapshot: Joi.object({
        name: Joi.string().trim().allow("", null),
        phone: Joi.string(),
      }),

      items: Joi.array().items(
        Joi.object({
          product: Joi.string().custom(objectId).required(),
          name: Joi.string().required().trim(),
          quantity: Joi.number().integer().min(1).required(),
          price: Joi.number().min(0).required(),
          total: Joi.number().min(0).required(),
        })
      ),

      discount: Joi.number().min(0),

      festival: Joi.string().custom(objectId),

      paymentMethod: Joi.string().valid("CASH", "UPI", "CARD"),
      paymentStatus: Joi.string().valid("PENDING", "PAID"),
    })
    .min(1), // 🔥 at least one field required

  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};



// ✅ GET ORDER
export const getOrderSchema = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};



// ✅ DELETE ORDER
export const deleteOrderSchema = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};



// ✅ LIST ORDERS (FILTERS + PAGINATION)
export const listOrdersSchema = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),

    paymentStatus: Joi.string().valid("PENDING", "PAID"),
    paymentMethod: Joi.string().valid("CASH", "UPI", "CARD"),

    festival: Joi.string().custom(objectId),
    customer: Joi.string().custom(objectId),

    phone: Joi.string(),
    search: Joi.string().allow(""),

    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref("startDate")),

    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(Joi.ref("minAmount")),
  }),
};