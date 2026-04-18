import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

interface JwtPayload {
  id: string;
  role: 'ADMIN' | 'USER';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      throw createApiError(401, 'Not authorized, no token provided');
    }
    
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_ACCESS_SECRET!
      ) as JwtPayload;
      
      req.user = decoded;
      next();
    } catch (error) {
      throw createApiError(401, 'Not authorized, token failed');
    }
  }
);

export const authorizeRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createApiError(401, 'Not authorized, no user information found');
    }

    if (!roles.includes(req.user.role)) {
      throw createApiError(
        403,
        `User role ${req.user.role} is not authorized to access this route. Allowed role(s): ${roles.join(', ')}`
      );
    }

    next();
  };
};
