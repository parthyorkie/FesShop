import Joi from "joi";

// 🔹 Common ObjectId validation
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("Invalid ObjectId");

// 🔹 Create Festival
export const createFestivalSchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      "string.empty": "Name is required",
    }),

    code: Joi.string().trim().uppercase().required().max(30).messages({
      "string.empty": "Code is required",
      "string.max": "Code must be less than 30 characters",
    }),

    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),

    isActive: Joi.boolean().optional(),
  }),
};

// 🔹 Get Festival by ID
export const getFestivalSchema = {
  params: Joi.object({
    id: objectId.required(),
  }),
};

// 🔹 List Festivals
export const listFestivalsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),

    search: Joi.string().trim().optional(),

    isActive: Joi.boolean().optional(),

    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  }),
};

// 🔹 Update Festival
export const updateFestivalSchema = {
  params: Joi.object({
    id: objectId.required(),
  }),

  body: Joi.object({
    name: Joi.string().trim().optional(),

    code: Joi.string().trim().uppercase().max(30).optional(),

    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),

    isActive: Joi.boolean().optional(),
  }).min(1), // 🔥 at least one field required
};