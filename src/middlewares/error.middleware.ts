import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { createApiError, IApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  if (error.isOperational === undefined) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error ? 400 : 500;
    const message = error.message || 'Internal Server Error';
    error = createApiError(statusCode, message, error?.errors || [], err.stack);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && !error.isOperational) {
    error.statusCode = 500;
    error.message = 'Internal Server Error';
  }

  const response = {
    success: false,
    message: error.message,
    ...(error.errors?.length > 0 && { errors: error.errors }),
    ...(!isProduction && { stack: error.stack }),
  };

  logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  res.status(error.statusCode).json(response);
};
