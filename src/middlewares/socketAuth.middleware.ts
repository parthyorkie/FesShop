/**
 * Socket.IO Authentication Middleware
 * 
 * Validates JWT tokens during Socket.IO connection handshake.
 * Reuses existing JWT verification logic from utils/jwt.ts.
 */

import { ExtendedError } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import User from '../models/User';
import { TypedSocket, SocketUser } from '../types/socket.types';

interface JwtPayload {
  userId: string;
  role?: 'ADMIN' | 'USER';
  iat?: number;
  exp?: number;
}

/**
 * Extract JWT token from socket handshake
 * Supports both auth object and Authorization header
 */
const extractToken = (socket: TypedSocket): string | null => {
  // Try auth object first (recommended for Socket.IO)
  const authToken = socket.handshake.auth?.token;
  if (authToken && typeof authToken === 'string') {
    return authToken;
  }

  // Fallback to Authorization header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

/**
 * Socket.IO authentication middleware
 * Validates JWT and attaches user to socket.data
 */
export const socketAuthMiddleware = async (
  socket: TypedSocket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  const socketId = socket.id;

  try {
    // Extract token
    const token = extractToken(socket);

    if (!token) {
      logger.warn(`[Socket Auth] No token provided - socketId: ${socketId}`);
      return next(new Error('Authentication required: No token provided'));
    }

    // Verify token using existing JWT utility
    let decoded: JwtPayload;
    try {
      decoded = verifyAccessToken(token) as JwtPayload;
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        logger.warn(`[Socket Auth] Token expired - socketId: ${socketId}`);
        return next(new Error('Authentication failed: Token expired'));
      }
      logger.warn(`[Socket Auth] Invalid token - socketId: ${socketId}, error: ${jwtError.message}`);
      return next(new Error('Authentication failed: Invalid token'));
    }

    if (!decoded.userId) {
      logger.warn(`[Socket Auth] Token missing userId - socketId: ${socketId}`);
      return next(new Error('Authentication failed: Invalid token payload'));
    }

    // Fetch user from database to get name and verify existence
    const user = await User.findById(decoded.userId).select('name email role isDeleted');

    if (!user) {
      logger.warn(`[Socket Auth] User not found - userId: ${decoded.userId}, socketId: ${socketId}`);
      return next(new Error('Authentication failed: User not found'));
    }

    if (user.isDeleted) {
      logger.warn(`[Socket Auth] User deleted - userId: ${decoded.userId}, socketId: ${socketId}`);
      return next(new Error('Authentication failed: User account deleted'));
    }

    // Attach user to socket.data
    const socketUser: SocketUser = {
      id: decoded.userId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    socket.data.user = socketUser;

    logger.info(`[Socket Auth] Authenticated - userId: ${decoded.userId}, name: ${user.name}, socketId: ${socketId}`);

    next();
  } catch (error: any) {
    logger.error(`[Socket Auth] Unexpected error - socketId: ${socketId}, error: ${error.message}`);
    next(new Error('Authentication failed: Internal error'));
  }
};

/**
 * Helper to get authenticated user from socket
 * Throws if user not authenticated (should not happen after middleware)
 */
export const getSocketUser = (socket: TypedSocket): SocketUser => {
  const user = socket.data.user;
  if (!user) {
    throw new Error('Socket user not authenticated');
  }
  return user;
};
