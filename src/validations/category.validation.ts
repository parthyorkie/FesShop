import Joi from 'joi';

export const createCategorySchema = {
  body: Joi.object().keys({
    name: Joi.string().required().trim(),
  }),
};

export const updateCategorySchema = {
  body: Joi.object().keys({
    name: Joi.string().trim(),
  }),
  params: Joi.object().keys({
    id: Joi.string().required().hex().length(24),
  }),
};

export const getCategorySchema = {
  params: Joi.object().keys({
    id: Joi.string().required().hex().length(24),
  }),
};

export const listCategoriesSchema = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().allow(''),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }),
};
