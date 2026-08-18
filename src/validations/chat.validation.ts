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
  type: Joi.string().valid('text', 'voice').required(),
  text: Joi.when('type', {
    is: 'text',
    then: Joi.string().required().max(2000),
    otherwise: Joi.forbidden(),
  }),
  voice: Joi.when('type', {
    is: 'voice',
    then: Joi.object({
      url: Joi.string().required(),
      duration: Joi.number().required().positive(),
      mimeType: Joi.string().required().valid('audio/m4a'),
      size: Joi.number().required().positive(),
    }).required(),
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);

export const socketMessageStatusSchema = Joi.object({
  conversationId: Joi.string().required().custom(objectId),
  messageId: Joi.string().required().custom(objectId),
}).unknown(false);

export const socketReactionSchema = Joi.object({
  conversationId: Joi.string().required().custom(objectId),
  messageId: Joi.string().required().custom(objectId),
  emoji: Joi.string().min(1).max(8).required(),
}).unknown(false);

export const presignedUrlSchema = {
  body: Joi.object().keys({
    conversationId: Joi.string().required().custom(objectId),
    mimeType: Joi.string().required().valid('audio/m4a'),
    size: Joi.number().required().positive(),
  }).unknown(false),
};
