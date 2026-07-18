/**
 * Video Call Constants
 * 
 * Defines event names, status enums, and configuration constants
 * for WebRTC signaling via Socket.IO.
 */

// Call status for call history records
export const CALL_STATUS = {
  MISSED: 'MISSED',
  REJECTED: 'REJECTED',
  ANSWERED: 'ANSWERED',
  COMPLETED: 'COMPLETED',
} as const;

export type CallStatus = typeof CALL_STATUS[keyof typeof CALL_STATUS];

// Client to Server events
export const CLIENT_EVENTS = {
  REGISTER_USER: 'register-user',
  GET_ONLINE_USERS: 'get-online-users',
  CALL_USER: 'call-user',
  ANSWER_CALL: 'answer-call',
  ICE_CANDIDATE: 'ice-candidate',
  REJECT_CALL: 'reject-call',
  END_CALL: 'end-call',
  RECOVER_CALL: 'recover-call',
} as const;

// Server to Client events
export const SERVER_EVENTS = {
  INCOMING_CALL: 'incoming-call',
  CALL_ANSWERED: 'call-answered',
  ICE_CANDIDATE: 'ice-candidate',
  CALL_REJECTED: 'call-rejected',
  CALL_ENDED: 'call-ended',
  USER_ONLINE: 'user-online',
  USER_OFFLINE: 'user-offline',
  ONLINE_USERS: 'online-users',
  ERROR: 'error',
  REGISTERED: 'registered',
  CALL_STATE: 'call-state',
  CALL_RECOVERED: 'call-recovered',
  PEER_RECONNECTING: 'peer-reconnecting',
} as const;

// Call timeout configuration (milliseconds)
export const CALL_CONFIG = {
  // Time to wait for call answer before marking as missed
  CALL_TIMEOUT_MS: 30000,
  // Maximum ICE candidates to store temporarily
  MAX_ICE_CANDIDATES: 50,
  // Grace period before cleaning up call state on disconnect (allows reconnection)
  DISCONNECT_GRACE_MS: 10000,
  // Time to wait for socket replacement during reconnect
  SOCKET_REPLACEMENT_TIMEOUT_MS: 5000,
  // Maximum time allowed for call recovery process to complete
  RECOVERY_TIMEOUT_MS: 15000,
  // Interval for periodic stale call cleanup check
  STALE_CLEANUP_INTERVAL_MS: 60000,
  // Maximum age of a call in recovery state before marking as stale
  MAX_RECOVERY_AGE_MS: 30000,
} as const;

// Error codes for socket errors
export const SOCKET_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_OFFLINE: 'USER_OFFLINE',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  CALL_FAILED: 'CALL_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SocketErrorCode = typeof SOCKET_ERROR_CODES[keyof typeof SOCKET_ERROR_CODES];
