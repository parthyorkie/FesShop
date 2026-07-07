import Joi from "joi";
import { SocialProofEventType } from "../models/socialProofEvent.model";

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("{{#label}} must be a valid MongoDB ID");

export const trackEventSchema = {
  type: Joi.string()
    .valid(...Object.values(SocialProofEventType))
    .required()
    .messages({
      "any.only": `Type must be one of: ${Object.values(SocialProofEventType).join(", ")}`,
      "any.required": "Type is required",
    }),
  userId: objectId.optional(),
  productId: objectId.optional(),
  metadata: Joi.object().unknown(true).optional().default({}),
};

export const getRecentEventsSchema = {
  query: Joi.object({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100) // Assuming a reasonable max limit
      .default(10)
      .optional()
      .messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),
  }),
};
