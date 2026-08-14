import Joi from 'joi';

const objectId = (value: string, helpers: any) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('any.invalid', { message: 'must be a valid MongoDB ID' });
  }
  return value;
};

export const createConversationSchema = {
  body: Joi.object().keys({
    participantId: Joi.string().required().custom(objectId),
  }).unknown(false),
};

export const getConversationsSchema = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }).unknown(false),
};

export const getConversationSchema = {
  params: Joi.object().keys({
    conversationId: Joi.string().required().custom(objectId),
  }),
};

export const getMessagesSchema = {
  params: Joi.object().keys({
    conversationId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(100).default(30),
    cursor: Joi.string().custom(objectId).optional(),
  }).unknown(false),
};

export const socketMessageSchema = Joi.object({
  conversationId: Joi.string().required().custom(objectId),
  clientMessageId: Joi.string().required().max(100),
  type: Joi.string().valid('text').required(),
  text: Joi.string().required().max(2000),
}).unknown(false);
