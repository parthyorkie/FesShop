import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createApiError } from '../utils/ApiError';

export const validate = (schema: object) => 
  (req: Request, res: Response, next: NextFunction) => {
    const validSchema = Joi.object(schema);
    const object = Object.keys(schema).reduce((obj: any, key: string) => {
      if (Object.prototype.hasOwnProperty.call(req, key)) {
        obj[key] = (req as any)[key];
      }
      return obj;
    }, {});

    const { value, error } = validSchema.validate(object, { abortEarly: false });

    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      return next(createApiError(400, errorMessage, error.details));
    }
    
    // Override the validated keys on req
    Object.assign(req, value);
    return next();
  };
