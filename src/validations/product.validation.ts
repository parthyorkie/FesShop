import Joi from 'joi';

const objectId = (value: string, helpers: any) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};

export const createProductSchema = {
  body: Joi.object().keys({
    name: Joi.string().required().trim(),
    // Updated to plural "categories" to match your new schema
    categories: Joi.array().items(Joi.string().custom(objectId)).required(),
    
    // Added new fields allowed by your updated model
    festivals: Joi.array().items(Joi.string().custom(objectId)),
    
    // "company" is required in your Mongoose schema
    company: Joi.string().custom(objectId).required(),
    
    price: Joi.number().min(0),
    stock: Joi.number().integer().min(0),
    
    // Allows dynamic key-value pairs for your Map
    attributes: Joi.object().unknown(true),
  }),
};



export const updateProductSchema = {
  body: Joi.object().keys({
    name: Joi.string().trim(),
    categories: Joi.array().items(Joi.string().hex().length(24)).min(1),
    // Added new fields allowed by your updated model
    festivals: Joi.array().items(Joi.string().custom(objectId)),
    
    // "company" is required in your Mongoose schema
    company: Joi.string().custom(objectId).required(),
    
    price: Joi.number().min(0),
    stock: Joi.number().integer().min(0),
    
    // Allows dynamic key-value pairs for your Map
    attributes: Joi.object().unknown(true),
  }),
  params: Joi.object().keys({
    id: Joi.string().required().hex().length(24),
  }),
};

export const getProductSchema = {
  params: Joi.object().keys({
    id: Joi.string().required().hex().length(24),
  }),
};

export const listProductsSchema = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().allow(''),
    categories: Joi.string().hex().length(24),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }),
};
