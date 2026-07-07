import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createApiError } from '../utils/ApiError';

// Validate a Joi schema against a combined view of req.params, req.query, and req.body.
// Also supports a mapping object like { body, query, params } where each value is a Joi schema.
// NOTE: Express 5 exposes `req.query` as a getter-only property, so we never reassign it —
// we only mutate `req.body` / `req.params` where safe.
export const validate = (schema: any) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!schema) return next();

    // Mapping object shape: { body?: Joi, query?: Joi, params?: Joi }
    if (!Joi.isSchema(schema) && typeof schema === 'object') {
      const parts = ['body', 'query', 'params'] as const;
      const messages: string[] = [];
      const details: any[] = [];
      const validatedByPart: Record<string, any> = {};

      for (const part of parts) {
        const partSchema = (schema as any)[part];
        if (!partSchema) continue;
        const source = (req as any)[part] ?? {};
        const { value, error } = partSchema.validate(source, { abortEarly: false });
        if (error) {
          messages.push(...error.details.map((d: any) => d.message));
          details.push(...error.details);
        } else {
          validatedByPart[part] = value;
        }
      }

      if (messages.length) {
        return next(createApiError(400, messages.join(', '), details));
      }

      // Safely apply validated values (skip req.query — it's a getter in Express 5)
      if (validatedByPart.body !== undefined) req.body = validatedByPart.body;
      if (validatedByPart.params !== undefined) {
        for (const k of Object.keys(validatedByPart.params)) {
          (req.params as any)[k] = validatedByPart.params[k];
        }
      }
      return next();
    }

    // Plain Joi schema — validate against combined params + query + body
    const combined = {
      ...(req.params || {}),
      ...(req.query || {}),
      ...(req.body || {}),
    };

    const { value, error } = schema.validate(combined, { abortEarly: false });

    if (error) {
      const errorMessage = error.details.map((d: any) => d.message).join(', ');
      return next(createApiError(400, errorMessage, error.details));
    }

    // Assign validated values back to their original locations.
    // Do NOT reassign req.query (getter-only in Express 5) — mutate props in place.
    for (const key of Object.keys(value)) {
      if (req.params && Object.prototype.hasOwnProperty.call(req.params, key)) {
        (req.params as any)[key] = value[key];
      } else if (req.query && Object.prototype.hasOwnProperty.call(req.query, key)) {
        try {
          (req.query as any)[key] = value[key];
        } catch {
          // req.query may be read-only; ignore — controllers can re-parse if needed
        }
      } else {
        if (!req.body || typeof req.body !== 'object') req.body = {};
        (req.body as any)[key] = value[key];
      }
    }

    return next();
  };
