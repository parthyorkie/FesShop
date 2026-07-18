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

export const logSocketReplaced = (userId: string, oldSocketId: string, newSocketId: string): void => {
  log('info', 'Reconnect', 'Socket replaced for reconnection', {
    userId,
    oldSocketId,
    newSocketId
  });
};

export const logReconnectDetected = (userId: string, socketId: string): void => {
  log('info', 'Reconnect', 'User reconnected', {
    userId,
    socketId
  });
};

export const logStaleDisconnectIgnored = (userId: string, socketId: string): void => {
  log('info', 'Reconnect', 'Ignoring stale disconnect - user already reconnected', {
    userId,
    socketId
  });
};

export const logCallRecoveryStarted = (userId: string, callRecordId: string): void => {
  log('info', 'CallRecovery', 'Active call recovery started', {
    userId,
    callRecordId
  });
};

export const logCallRecoveryCompleted = (userId: string, callRecordId: string): void => {
  log('info', 'CallRecovery', 'Active call recovery completed', {
    userId,
    callRecordId
  });
};

export const logCallRecoveryFailed = (userId: string, callRecordId: string, reason: string): void => {
  log('warn', 'CallRecovery', `Active call recovery failed - ${reason}`, {
    userId,
    callRecordId
  });
};

export const logPeerNotifiedOfReconnect = (userId: string, peerId: string, callRecordId: string): void => {
  log('info', 'CallRecovery', 'Peer notified of reconnection', {
    userId,
    targetUserId: peerId,
    callRecordId
  });
};

export const logRecoveryAlreadyInProgress = (userId: string, callRecordId: string): void => {
  log('warn', 'CallRecovery', 'Duplicate recovery attempt ignored - already in progress', {
    userId,
    callRecordId
  });
};

export const logCleanupAlreadyCompleted = (context: string, callRecordId: string): void => {
  log('info', 'Cleanup', 'Idempotent cleanup skipped - already cleaned up', {
    callRecordId,
    context
  });
};

export const logDisconnectGraceExpired = (userId: string, callRecordId: string): void => {
  log('info', 'Disconnect', 'Grace period expired - cleaning up call', {
    userId,
    callRecordId
  });
};

export const logDisconnectGraceCancelled = (userId: string, callRecordId: string): void => {
  log('info', 'Disconnect', 'Grace period cancelled - user reconnected', {
    userId,
    callRecordId
  });
};

export const logRecoveryTimeoutStarted = (userId: string, callRecordId: string, timeoutMs: number): void => {
  log('info', 'Timeout', `Recovery timeout started (${timeoutMs}ms)`, {
    userId,
    callRecordId,
    timeoutMs
  });
};

export const logRecoveryTimeoutExpired = (userId: string, callRecordId: string): void => {
  log('warn', 'Timeout', 'Recovery timeout expired - cleaning up call', {
    userId,
    callRecordId
  });
};

export const logRecoveryTimeoutCancelled = (userId: string, callRecordId: string): void => {
  log('info', 'Timeout', 'Recovery timeout cancelled - recovery completed', {
    userId,
    callRecordId
  });
};

export const logStaleCallDetected = (callRecordId: string, ageMs: number): void => {
  log('warn', 'Cleanup', `Stale call detected (age: ${ageMs}ms) - cleaning up`, {
    callRecordId,
    ageMs
  });
};

export const logStaleCleanupRun = (totalCalls: number, staleCalls: number): void => {
  log('info', 'Cleanup', `Stale call cleanup completed (${staleCalls}/${totalCalls} cleaned)`, {
    totalCalls,
    staleCalls
  });
};

export const logAllTimersCleaned = (callRecordId: string, timersCleaned: string[]): void => {
  log('debug', 'Cleanup', `All timers cleaned for call`, {
    callRecordId,
    timersCleaned: timersCleaned.join(', ')
  });
};

// ============================================
// Presence Events
// ============================================

export const logUserOnline = (userId: string): void => {
  log('info', 'Presence', 'User Online', { userId });
};

export const logUserOffline = (userId: string): void => {
  log('info', 'Presence', 'User Offline', { userId });
};

export const logOnlineUsersRequested = (socketId: string, userId: string): void => {
  log('info', 'Presence', 'Online Users Requested', { socketId, userId });
};

export const logCurrentOnlineCount = (count: number): void => {
  log('info', 'Presence', `Current Online Count: ${count}`, { count });
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
  logSocketReplaced,
  logReconnectDetected,
  logStaleDisconnectIgnored,
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
