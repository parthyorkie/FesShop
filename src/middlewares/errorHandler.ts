import { ErrorRequestHandler, Request, Response } from "express";

type MongoDuplicateError = Error & { code?: number; keyValue?: Record<string, unknown> };

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json({
    message: "Route not found",
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = err as MongoDuplicateError;

  if (error.code === 11000) {
    return res.status(409).json({
      message: "User with this email already exists.",
      details: error.keyValue ?? {},
    });
  }

  return res.status(500).json({
    message: error.message || "Internal server error",
  });
};
