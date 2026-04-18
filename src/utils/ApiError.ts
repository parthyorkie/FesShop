export interface IApiError extends Error {
  statusCode: number;
  success: boolean;
  errors: any[];
  isOperational: boolean;
}

export const createApiError = (
  statusCode: number,
  message = 'Something went wrong',
  errors: any[] = [],
  stack = ''
): IApiError => {
  const error = new Error(message) as IApiError;
  error.statusCode = statusCode;
  error.success = false;
  error.errors = errors;
  error.isOperational = true;

  if (stack) {
    error.stack = stack;
  } else {
    Error.captureStackTrace(error, createApiError);
  }

  return error;
};
