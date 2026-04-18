import Joi from 'joi';

const objectId = (value: string, helpers: any) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('"{{#label}}" must be a valid MongoDB ID');
  }
  return value;
};

// ✅ Create User Schema
export const createUserSchema = {
  body: Joi.object().keys({
    name: Joi.string().required().min(2).max(100).trim(),
    email: Joi.string().required().email().lowercase().trim(),
    password: Joi.string().required().min(6).max(100),
    role: Joi.string().valid('ADMIN', 'USER').default('USER'),
  }).unknown(false),
};

// ✅ Update User Schema
export const updateUserSchema = {
  body: Joi.object().keys({
    name: Joi.string().min(2).max(100).trim(),
    email: Joi.string().email().lowercase().trim(),
    role: Joi.string().valid('ADMIN', 'USER'),
  }).min(1).unknown(false),
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};

// ✅ Get User Schema
export const getUserSchema = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};

// ✅ Delete User Schema
export const deleteUserSchema = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};

// ✅ List Users Schema
export const listUsersSchema = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim(),
    role: Joi.string().valid('ADMIN', 'USER'),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
  }).unknown(false),
};

// ✅ Change Password Schema
export const changePasswordSchema = {
  body: Joi.object().keys({
    oldPassword: Joi.string().required().min(6),
    newPassword: Joi.string().required().min(6).max(100),
  }).unknown(false),
};
