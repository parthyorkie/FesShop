/**
 * Presence Service
 * 
 * Manages user presence state for video calling.
 * Supports multiple sockets per user for multi-device support.
 * Maps userId ↔ socketIds for real-time user lookup.
 * 
 * Note: This is an in-memory implementation suitable for single-server deployment.
 * For horizontal scaling, migrate to Redis-backed presence with pub/sub.
 */

import { PresenceUser } from '../interfaces/videoCall.interface';
import { 
  logUserRegistered, 
  logUserUnregistered, 
  logDuplicateRegistration 
} from '../utils/videoCall.logger';

// In-memory presence maps
// userId -> Set<socketId> (supports multiple sockets per user)
const userToSockets: Map<string, Set<string>> = new Map();

// socketId -> userId (for reverse lookup on disconnect)
const socketToUser: Map<string, string> = new Map();

// socketId -> PresenceUser (for socket-specific metadata)
const socketMetadata: Map<string, PresenceUser> = new Map();

/**
 * Register a user with their socket connection
 * Supports multiple sockets per user for multi-device
 * 
 * @returns Previous socketId if it's the same socket reconnecting, null otherwise
 */
export const registerUser = (userId: string, socketId: string): string | null => {
  let previousSocketId: string | null = null;

  // Check if this exact socket was already registered (duplicate registration from same connection)
  const existingUserId = socketToUser.get(socketId);
  if (existingUserId === userId) {
    // Same user, same socket - this is a duplicate registration, return the socketId
    return socketId;
  }

  // Get or create socket set for user
  let userSockets = userToSockets.get(userId);
  if (!userSockets) {
    userSockets = new Set<string>();
    userToSockets.set(userId, userSockets);
  } else {
    // Check if we're replacing a disconnected socket (for call continuity)
    // This is different from multi-device - it's for replacing old sockets
    if (userSockets.size === 1) {
      const oldSocketId = Array.from(userSockets)[0];
      const oldMetadata = socketMetadata.get(oldSocketId);
      if (oldMetadata) {
        // Check if old socket is stale (would be handled in videoCall.socket.ts)
        // For now, we keep both sockets as the disconnect handler will clean up stale ones
        logDuplicateRegistration(userId, oldSocketId, socketId);
      }
    }
  }

  // Add new socket to user's socket set
  userSockets.add(socketId);

  // Create presence metadata
  const presence: PresenceUser = {
    userId,
    socketId,
    connectedAt: new Date(),
  };

  // Update maps
  socketToUser.set(socketId, userId);
  socketMetadata.set(socketId, presence);

  logUserRegistered(userId, socketId);

  return previousSocketId;
};

/**
 * Remove a user from presence by userId (removes ALL sockets)
 * 
 * @returns true if user was present and removed, false otherwise
 */
export const removeUser = (userId: string): boolean => {
  const userSockets = userToSockets.get(userId);
  
  if (!userSockets || userSockets.size === 0) {
    return false;
  }

  // Clean up all sockets for this user
  for (const socketId of userSockets) {
    socketToUser.delete(socketId);
    socketMetadata.delete(socketId);
    logUserUnregistered(userId, socketId);
  }

  // Remove user from main map
  userToSockets.delete(userId);

  return true;
};

/**
 * Remove a socket from presence by socketId
 * Used primarily on disconnect event
 * 
 * @returns Object with userId and whether user is now completely offline
 */
export const removeBySocketId = (socketId: string): { userId: string | null; userOffline: boolean } => {
  const userId = socketToUser.get(socketId);
  
  if (!userId) {
    return { userId: null, userOffline: false };
  }

  // Remove socket from maps
  socketToUser.delete(socketId);
  socketMetadata.delete(socketId);

  // Remove socket from user's socket set
  const userSockets = userToSockets.get(userId);
  if (userSockets) {
    userSockets.delete(socketId);
    
    // Check if user has no more sockets
    if (userSockets.size === 0) {
      userToSockets.delete(userId);
      logUserUnregistered(userId, socketId);
      return { userId, userOffline: true };
    }
  }

  logUserUnregistered(userId, socketId);
  return { userId, userOffline: false };
};

/**
 * Get socket ID for a user (returns first active socket for backward compatibility)
 * For video calls, we use the first available socket
 * 
 * @returns socketId if user is online, null otherwise
 */
export const getSocketByUserId = (userId: string): string | null => {
  const userSockets = userToSockets.get(userId);
  if (!userSockets || userSockets.size === 0) {
    return null;
  }
  // Return first socket (for backward compatibility with single-socket logic)
  return Array.from(userSockets)[0];
};

/**
 * Check if a user is currently online
 */
export const isUserOnline = (userId: string): boolean => {
  const userSockets = userToSockets.get(userId);
  return userSockets !== undefined && userSockets.size > 0;
};

/**
 * Get userId from socketId
 * 
 * @returns userId if socket is registered, null otherwise
 */
export const getUserBySocketId = (socketId: string): string | null => {
  return socketToUser.get(socketId) || null;
};

/**
 * Get full presence info for a user (returns first socket's metadata)
 */
export const getPresence = (userId: string): PresenceUser | null => {
  const socketId = getSocketByUserId(userId);
  if (!socketId) {
    return null;
  }
  return socketMetadata.get(socketId) || null;
};

/**
 * Get count of online users
 */
export const getOnlineCount = (): number => {
  return userToSockets.size;
};

/**
 * Get all online user IDs
 * Useful for broadcasting or debugging
 */
export const getAllOnlineUserIds = (): string[] => {
  return Array.from(userToSockets.keys());
};

/**
 * Get all socket IDs for a user
 * Useful for multi-device support
 */
export const getAllSocketsByUserId = (userId: string): string[] => {
  const userSockets = userToSockets.get(userId);
  return userSockets ? Array.from(userSockets) : [];
};

/**
 * Check if this is the user's first socket connection
 */
export const isFirstSocket = (userId: string): boolean => {
  const userSockets = userToSockets.get(userId);
  return userSockets ? userSockets.size === 1 : false;
};

/**
 * Clear all presence data
 * Used for testing or server shutdown
 */
export const clearAll = (): void => {
  userToSockets.clear();
  socketToUser.clear();
  socketMetadata.clear();
};

// Export as namespace for convenience
export const presenceService = {
  registerUser,
  removeUser,
  removeBySocketId,
  getSocketByUserId,
  getAllSocketsByUserId,
  isUserOnline,
  isFirstSocket,
  getUserBySocketId,
  getPresence,
  getOnlineCount,
  getAllOnlineUserIds,
  clearAll,
};
