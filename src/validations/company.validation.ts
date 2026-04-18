import Joi from "joi";

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("Invalid ObjectId");

// 🔹 Create
export const createCompanySchema = {
  body: Joi.object({
    name: Joi.string().trim().required(),
    description: Joi.string().trim().optional(),
  }),
};

// 🔹 Get
export const getCompanySchema = {
  params: Joi.object({
    id: objectId.required(),
  }),
};

// 🔹 List
export const listCompaniesSchema = {
  query: Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    search: Joi.string().optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
  }),
};

// 🔹 Update
export const updateCompanySchema = {
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
  }).min(1),
};