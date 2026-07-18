/**
 * Video Call Socket Validators
 * 
 * Joi validation schemas for Socket.IO event payloads.
 * Validates required fields, data types, and SDP structure.
 */

import Joi from 'joi';
import { Types } from 'mongoose';

// ============================================
// Reusable Validators
// ============================================

/**
 * MongoDB ObjectId validator
 */
const objectId = (value: string, helpers: any) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.message('"{{#label}}" must be a valid MongoDB ID');
  }
  return value;
};

/**
 * RTC Session Description validator
 * Validates SDP offer/answer structure
 */
const rtcSessionDescription = Joi.object({
  type: Joi.string()
    .valid('offer', 'answer', 'pranswer', 'rollback')
    .required()
    .messages({
      'any.only': '"type" must be one of [offer, answer, pranswer, rollback]',
    }),
  sdp: Joi.string().allow('', null),
}).required();

/**
 * RTC ICE Candidate validator
 */
const rtcIceCandidate = Joi.object({
  candidate: Joi.string().allow('', null),
  sdpMid: Joi.string().allow('', null),
  sdpMLineIndex: Joi.number().integer().min(0).allow(null),
  usernameFragment: Joi.string().allow('', null),
}).required();

// ============================================
// Event Payload Schemas
// ============================================

/**
 * register-user event
 */
export const registerUserSchema = Joi.object({
  userId: Joi.string().custom(objectId).required(),
});

/**
 * call-user event
 */
export const callUserSchema = Joi.object({
  callerId: Joi.string().custom(objectId).required(),
  receiverId: Joi.string().custom(objectId).required(),
  offer: rtcSessionDescription,
}).custom((value, helpers) => {
  // Validate caller and receiver are different
  if (value.callerId === value.receiverId) {
    return helpers.error('any.invalid', { message: 'Cannot call yourself' });
  }
  return value;
}).messages({
  'any.invalid': 'Cannot call yourself',
});

/**
 * answer-call event
 */
export const answerCallSchema = Joi.object({
  callerId: Joi.string().custom(objectId).required(),
  answer: rtcSessionDescription.keys({
    type: Joi.string().valid('answer', 'pranswer').required(),
  }),
});

/**
 * ice-candidate event
 */
export const iceCandidateSchema = Joi.object({
  receiverId: Joi.string().custom(objectId).required(),
  candidate: rtcIceCandidate,
});

/**
 * reject-call event
 */
export const rejectCallSchema = Joi.object({
  receiverId: Joi.string().custom(objectId).required(),
});

/**
 * end-call event
 */
export const endCallSchema = Joi.object({
  receiverId: Joi.string().custom(objectId).required(),
});

/**
 * recover-call event
 */
export const recoverCallSchema = Joi.object({
  callRecordId: Joi.string().custom(objectId).required(),
});

// ============================================
// Validation Helper
// ============================================

export interface ValidationResult<T = any> {
  valid: boolean;
  value?: T;
  errors?: string[];
}

/**
 * Validate a socket payload against a schema
 * 
 * @param schema - Joi schema to validate against
 * @param payload - Data to validate
 * @returns Validation result with value or errors
 */
export const validateSocketPayload = <T>(
  schema: Joi.Schema,
  payload: unknown
): ValidationResult<T> => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false, // Collect all errors
    stripUnknown: true, // Remove unknown fields
  });

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    value: value as T,
  };
};

/**
 * Create validation middleware for socket events
 * Returns validated payload or throws with errors
 */
export const createSocketValidator = <T>(schema: Joi.Schema) => {
  return (payload: unknown): T => {
    const result = validateSocketPayload<T>(schema, payload);
    
    if (!result.valid) {
      const error = new Error(result.errors?.join(', ') || 'Validation failed');
      (error as any).validationErrors = result.errors;
      throw error;
    }
    
    return result.value!;
  };
};

// ============================================
// Pre-built Validators
// ============================================

export const validators = {
  registerUser: createSocketValidator(registerUserSchema),
  callUser: createSocketValidator(callUserSchema),
  answerCall: createSocketValidator(answerCallSchema),
  iceCandidate: createSocketValidator(iceCandidateSchema),
  rejectCall: createSocketValidator(rejectCallSchema),
  endCall: createSocketValidator(endCallSchema),
  recoverCall: createSocketValidator(recoverCallSchema),
};

// ============================================
// Schema exports for direct use
// ============================================

export const schemas = {
  registerUser: registerUserSchema,
  callUser: callUserSchema,
  answerCall: answerCallSchema,
  iceCandidate: iceCandidateSchema,
  rejectCall: rejectCallSchema,
  endCall: endCallSchema,
  recoverCall: recoverCallSchema,
};
