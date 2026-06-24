/**
 * Presence Service
 * 
 * Manages user presence state for video calling.
 * Maps userId ↔ socketId for real-time user lookup.
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
// userId -> PresenceUser (for user lookup)
const userToSocket: Map<string, PresenceUser> = new Map();

// socketId -> userId (for reverse lookup on disconnect)
const socketToUser: Map<string, string> = new Map();

/**
 * Register a user with their socket connection
 * Handles duplicate registrations by replacing old socket
 * 
 * @returns Previous socketId if user was already registered, null otherwise
 */
export const registerUser = (userId: string, socketId: string): string | null => {
  let previousSocketId: string | null = null;

  // Check for existing registration
  const existingPresence = userToSocket.get(userId);
  if (existingPresence) {
    previousSocketId = existingPresence.socketId;
    
    // Clean up old socket mapping
    socketToUser.delete(existingPresence.socketId);
    
    logDuplicateRegistration(userId, existingPresence.socketId, socketId);
  }

  // Create new presence entry
  const presence: PresenceUser = {
    userId,
    socketId,
    connectedAt: new Date(),
  };

  // Update both maps
  userToSocket.set(userId, presence);
  socketToUser.set(socketId, userId);

  logUserRegistered(userId, socketId);

  return previousSocketId;
};

/**
 * Remove a user from presence by userId
 * 
 * @returns true if user was present and removed, false otherwise
 */
export const removeUser = (userId: string): boolean => {
  const presence = userToSocket.get(userId);
  
  if (!presence) {
    return false;
  }

  // Clean up both maps
  socketToUser.delete(presence.socketId);
  userToSocket.delete(userId);

  logUserUnregistered(userId, presence.socketId);

  return true;
};

/**
 * Remove a user from presence by socketId
 * Used primarily on disconnect event
 * 
 * @returns userId if socket was found and removed, null otherwise
 */
export const removeBySocketId = (socketId: string): string | null => {
  const userId = socketToUser.get(socketId);
  
  if (!userId) {
    return null;
  }

  // Clean up both maps
  socketToUser.delete(socketId);
  userToSocket.delete(userId);

  logUserUnregistered(userId, socketId);

  return userId;
};

/**
 * Get socket ID for a user
 * 
 * @returns socketId if user is online, null otherwise
 */
export const getSocketByUserId = (userId: string): string | null => {
  const presence = userToSocket.get(userId);
  return presence?.socketId || null;
};

/**
 * Check if a user is currently online
 */
export const isUserOnline = (userId: string): boolean => {
  return userToSocket.has(userId);
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
 * Get full presence info for a user
 */
export const getPresence = (userId: string): PresenceUser | null => {
  return userToSocket.get(userId) || null;
};

/**
 * Get count of online users
 */
export const getOnlineCount = (): number => {
  return userToSocket.size;
};

/**
 * Get all online user IDs
 * Useful for broadcasting or debugging
 */
export const getAllOnlineUserIds = (): string[] => {
  return Array.from(userToSocket.keys());
};

/**
 * Clear all presence data
 * Used for testing or server shutdown
 */
export const clearAll = (): void => {
  userToSocket.clear();
  socketToUser.clear();
};

// Export as namespace for convenience
export const presenceService = {
  registerUser,
  removeUser,
  removeBySocketId,
  getSocketByUserId,
  isUserOnline,
  getUserBySocketId,
  getPresence,
  getOnlineCount,
  getAllOnlineUserIds,
  clearAll,
};
