/**
 * Video Call Logger
 * 
 * Structured logging for WebRTC signaling events.
 * Wraps existing Winston logger with video call context.
 */

import { logger } from './logger';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  socketId?: string;
  targetUserId?: string;
  callRecordId?: string;
  event?: string;
  [key: string]: unknown;
}

/**
 * Format context object for logging
 */
const formatContext = (context: LogContext): string => {
  const parts: string[] = [];
  
  if (context.userId) parts.push(`userId: ${context.userId}`);
  if (context.socketId) parts.push(`socketId: ${context.socketId}`);
  if (context.targetUserId) parts.push(`targetUserId: ${context.targetUserId}`);
  if (context.callRecordId) parts.push(`callId: ${context.callRecordId}`);
  if (context.event) parts.push(`event: ${context.event}`);
  
  // Add any extra context
  const knownKeys = ['userId', 'socketId', 'targetUserId', 'callRecordId', 'event'];
  Object.keys(context).forEach(key => {
    if (!knownKeys.includes(key) && context[key] !== undefined) {
      parts.push(`${key}: ${JSON.stringify(context[key])}`);
    }
  });
  
  return parts.length > 0 ? ` - ${parts.join(', ')}` : '';
};

/**
 * Base log function
 */
const log = (level: LogLevel, prefix: string, message: string, context: LogContext = {}): void => {
  const formattedMessage = `[${prefix}] ${message}${formatContext(context)}`;
  logger[level](formattedMessage);
};

// ============================================
// Connection Events
// ============================================

export const logConnection = (userId: string, socketId: string, userName?: string): void => {
  log('info', 'Socket', `User connected${userName ? ` (${userName})` : ''}`, { userId, socketId });
};

export const logDisconnect = (userId: string, socketId: string, reason?: string): void => {
  log('info', 'Socket', `User disconnected${reason ? ` - reason: ${reason}` : ''}`, { userId, socketId });
};

export const logAuthFailed = (socketId: string, reason: string): void => {
  log('warn', 'Socket Auth', `Authentication failed - ${reason}`, { socketId });
};

// ============================================
// Registration Events
// ============================================

export const logUserRegistered = (userId: string, socketId: string): void => {
  log('info', 'Presence', 'User registered for calls', { userId, socketId });
};

export const logUserUnregistered = (userId: string, socketId: string): void => {
  log('info', 'Presence', 'User unregistered from calls', { userId, socketId });
};

export const logDuplicateRegistration = (userId: string, oldSocketId: string, newSocketId: string): void => {
  log('warn', 'Presence', `Duplicate registration - replacing old socket`, { 
    userId, 
    socketId: newSocketId,
    oldSocketId 
  });
};

// ============================================
// Call Events
// ============================================

export const logCallInitiated = (
  callerId: string, 
  receiverId: string, 
  callRecordId?: string
): void => {
  log('info', 'Call', 'Call initiated', { 
    userId: callerId, 
    targetUserId: receiverId,
    callRecordId 
  });
};

export const logIncomingCall = (
  callerId: string, 
  receiverId: string, 
  receiverSocketId: string
): void => {
  log('info', 'Call', 'Incoming call forwarded', { 
    userId: callerId, 
    targetUserId: receiverId,
    socketId: receiverSocketId 
  });
};

export const logCallAnswered = (
  callerId: string, 
  receiverId: string,
  callRecordId?: string
): void => {
  log('info', 'Call', 'Call answered', { 
    userId: receiverId, 
    targetUserId: callerId,
    callRecordId 
  });
};

export const logCallRejected = (
  callerId: string, 
  receiverId: string,
  callRecordId?: string
): void => {
  log('info', 'Call', 'Call rejected', { 
    userId: receiverId, 
    targetUserId: callerId,
    callRecordId 
  });
};

export const logCallEnded = (
  endedBy: string, 
  otherUserId: string,
  callRecordId?: string,
  duration?: number
): void => {
  log('info', 'Call', `Call ended${duration !== undefined ? ` (duration: ${duration}s)` : ''}`, { 
    userId: endedBy, 
    targetUserId: otherUserId,
    callRecordId 
  });
};

export const logCallMissed = (
  callerId: string, 
  receiverId: string,
  callRecordId?: string
): void => {
  log('info', 'Call', 'Call missed (timeout)', { 
    userId: callerId, 
    targetUserId: receiverId,
    callRecordId 
  });
};

// ============================================
// ICE Candidate Events
// ============================================

export const logIceCandidate = (
  senderId: string, 
  receiverId: string,
  candidateType?: string
): void => {
  log('debug', 'ICE', 'ICE candidate forwarded', { 
    userId: senderId, 
    targetUserId: receiverId,
    candidateType 
  });
};

// ============================================
// Notification Events
// ============================================

export const logNotificationSent = (
  userId: string, 
  type: string,
  success: boolean
): void => {
  if (success) {
    log('info', 'Notification', `${type} notification sent`, { userId });
  } else {
    log('warn', 'Notification', `${type} notification failed`, { userId });
  }
};

export const logNotificationError = (
  userId: string, 
  error: string
): void => {
  log('error', 'Notification', `Notification error - ${error}`, { userId });
};

// ============================================
// Error Events
// ============================================

export const logSocketError = (
  socketId: string, 
  event: string, 
  error: string,
  userId?: string
): void => {
  log('error', 'Socket', `Error in ${event} - ${error}`, { socketId, userId, event });
};

export const logValidationError = (
  socketId: string, 
  event: string, 
  errors: string[],
  userId?: string
): void => {
  log('warn', 'Validation', `Invalid payload for ${event} - ${errors.join(', ')}`, { 
    socketId, 
    userId, 
    event 
  });
};

// ============================================
// Database Events
// ============================================

export const logDbError = (
  operation: string, 
  error: string,
  context?: LogContext
): void => {
  log('error', 'Database', `${operation} failed - ${error}`, context || {});
};

export const logCallRecordCreated = (callRecordId: string): void => {
  log('debug', 'Database', 'Call record created', { callRecordId });
};

export const logCallRecordUpdated = (callRecordId: string, status: string): void => {
  log('debug', 'Database', `Call record updated to ${status}`, { callRecordId });
};

// ============================================
// Export all as namespace for convenience
// ============================================

export const videoCallLogger = {
  logConnection,
  logDisconnect,
  logAuthFailed,
  logUserRegistered,
  logUserUnregistered,
  logDuplicateRegistration,
  logCallInitiated,
  logIncomingCall,
  logCallAnswered,
  logCallRejected,
  logCallEnded,
  logCallMissed,
  logIceCandidate,
  logNotificationSent,
  logNotificationError,
  logSocketError,
  logValidationError,
  logDbError,
  logCallRecordCreated,
  logCallRecordUpdated,
};
