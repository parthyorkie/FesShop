import { NextFunction, Request, Response } from 'express';
import { createApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';

interface JwtPayload {
  userId: string;
  id?: string; // Backwards compatibility if needed
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
      const decoded = verifyAccessToken(token) as JwtPayload;
      
      // Map userId to id for backwards compatibility if needed by other components
      if (decoded.userId && !decoded.id) {
        decoded.id = decoded.userId;
      }
      
      req.user = decoded;
      next();
    } catch (error: any) {
      console.error('JWT verification failure:', error.message);
      if (error.name === 'TokenExpiredError') {
        throw createApiError(401, 'Not authorized, token expired');
      }
      throw createApiError(401, 'Not authorized, invalid token');
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
