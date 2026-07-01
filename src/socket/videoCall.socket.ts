/**
 * Video Call Socket Handler
 * 
 * Main entry point for WebRTC signaling via Socket.IO.
 * Handles all video call related socket events including:
 * - User registration and presence
 * - Call initiation and answering
 * - ICE candidate exchange
 * - Call rejection and termination
 */

import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware, getSocketUser } from '../middlewares/socketAuth.middleware';
import { presenceService } from '../services/presence.service';
import { videoCallService } from '../services/videoCall.service';
import { oneSignalService } from '../services/oneSignal.service';
import { validateSocketPayload, schemas } from '../validators/videoCall.validator';
import { CLIENT_EVENTS, SERVER_EVENTS, SOCKET_ERROR_CODES, CALL_CONFIG } from '../constants/videoCall.constants';
import {
  TypedServer,
  TypedSocket,
  SocketUser,
} from '../types/socket.types';
import {
  CallUserPayload,
  AnswerCallPayload,
  IceCandidatePayload,
  RejectCallPayload,
  EndCallPayload,
  ActiveCall,
  SocketErrorPayload,
  BufferedIceCandidate,
} from '../interfaces/videoCall.interface';
import {
  logConnection,
  logDisconnect,
  logCallInitiated,
  logIncomingCall,
  logCallAnswered,
  logCallRejected,
  logCallEnded,
  logCallMissed,
  logIceCandidate,
  logSocketError,
  logValidationError,
  logUserOnline,
  logUserOffline,
  logOnlineUsersRequested,
  logCurrentOnlineCount,
} from '../utils/videoCall.logger';
import User from '../models/User';

// ============================================
// Active Calls Tracking (in-memory)
// ============================================

// Map callRecordId -> ActiveCall for timeout management
const activeCalls: Map<string, ActiveCall> = new Map();

// Map participantId -> callRecordId for quick lookup
const userToActiveCall: Map<string, string> = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Emit error to socket with consistent structure
 */
const emitError = (
  socket: TypedSocket,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void => {
  const errorPayload: SocketErrorPayload = {
    code,
    message,
    ...(details && { details }),
  };
  socket.emit(SERVER_EVENTS.ERROR, errorPayload);
};

/**
 * Get socket instance by socketId
 */
const getSocketById = (io: TypedServer, socketId: string): TypedSocket | null => {
  const socket = io.sockets.sockets.get(socketId);
  return (socket as TypedSocket) || null;
};

/**
 * Clear active call timeout and tracking
 */
const clearActiveCall = (callRecordId: string): void => {
  const activeCall = activeCalls.get(callRecordId);
  if (activeCall) {
    // Clear timeouts if exist
    if (activeCall.timeoutId) {
      clearTimeout(activeCall.timeoutId);
    }
    if (activeCall.disconnectTimeoutId) {
      clearTimeout(activeCall.disconnectTimeoutId);
    }
    // Remove from tracking maps
    userToActiveCall.delete(activeCall.callerId);
    userToActiveCall.delete(activeCall.receiverId);
    activeCalls.delete(callRecordId);
  }
};

/**
 * Set up call timeout for unanswered calls
 */
const setupCallTimeout = (
  io: TypedServer,
  callRecordId: string,
  callerId: string,
  receiverId: string
): void => {
  const timeoutId = setTimeout(async () => {
    const activeCall = activeCalls.get(callRecordId);
    if (activeCall) {
      // Mark as missed in database
      await videoCallService.markMissed(callRecordId);
      
      // Notify caller that call was not answered
      const callerSocketId = presenceService.getSocketByUserId(callerId);
      if (callerSocketId) {
        const callerSocket = getSocketById(io, callerSocketId);
        if (callerSocket) {
          callerSocket.emit(SERVER_EVENTS.CALL_ENDED, {
            endedBy: 'system',
            reason: 'Call not answered',
          });
        }
      }

      // Send missed call notification to receiver
      const receiverUser = await User.findById(receiverId).select('name');
      if (receiverUser) {
        const callerUser = await User.findById(callerId).select('name');
        if (callerUser) {
          await oneSignalService.sendMissedCallNotification(
            receiverId,
            callerUser.name
          );
        }
      }

      logCallMissed(callerId, receiverId, callRecordId);
      clearActiveCall(callRecordId);
    }
  }, CALL_CONFIG.CALL_TIMEOUT_MS);

  // Store timeout reference
  const activeCall = activeCalls.get(callRecordId);
  if (activeCall) {
    activeCall.timeoutId = timeoutId;
  }
};

// ============================================
// Socket Event Handlers
// ============================================

/**
 * Handle user registration for calls
 */
const handleRegisterUser = (
  io: TypedServer,
  socket: TypedSocket
) => {
  const user = getSocketUser(socket);
  
  // Check if this is the user's first socket BEFORE registering
  const wasOnline = presenceService.isUserOnline(user.id);
  
  // Register user in presence service (supports multi-device)
  const previousSocketId = presenceService.registerUser(user.id, socket.id);

  // If user had previous connection from a DIFFERENT socket, disconnect the old one
  // Skip if it's the same socket (duplicate registration from same connection)
  // NOTE: This logic is for replacing old sockets during call migration, not multi-device
  if (previousSocketId && previousSocketId !== socket.id) {
    const previousSocket = getSocketById(io, previousSocketId);
    if (previousSocket) {
      emitError(previousSocket, SOCKET_ERROR_CODES.UNAUTHORIZED, 'New connection established');
      previousSocket.disconnect(true);
    }
  }

  // Cancel any pending disconnect grace period if user reconnected during a call
  const callRecordId = userToActiveCall.get(user.id);
  if (callRecordId) {
    const activeCall = activeCalls.get(callRecordId);
    if (activeCall?.disconnectTimeoutId) {
      clearTimeout(activeCall.disconnectTimeoutId);
      activeCall.disconnectTimeoutId = undefined;
    }
  }

  // Broadcast user online status ONLY if this is the user's first socket
  // (user wasn't online before)
  if (!wasOnline) {
    socket.broadcast.emit(SERVER_EVENTS.USER_ONLINE, {
      userId: user.id,
      userName: user.name,
    });
    logUserOnline(user.id);
  }

  // Send confirmation
  socket.emit(SERVER_EVENTS.REGISTERED, {
    userId: user.id,
    message: 'Successfully registered for calls',
  });
};

/**
 * Handle call initiation
 */
const handleCallUser = async (
  io: TypedServer,
  socket: TypedSocket,
  payload: CallUserPayload,
  callback?: (response: { success: boolean; message?: string; callRecordId?: string }) => void
) => {
  const user = getSocketUser(socket);

  // Validate payload
  const validation = validateSocketPayload(schemas.callUser, payload);
  if (!validation.valid) {
    logValidationError(socket.id, CLIENT_EVENTS.CALL_USER, validation.errors!, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INVALID_PAYLOAD, validation.errors!.join(', '));
    callback?.({ success: false, message: validation.errors!.join(', ') });
    return;
  }

  const { callerId, receiverId, offer } = validation.value as CallUserPayload;

  // Verify caller matches authenticated user
  if (callerId !== user.id) {
    emitError(socket, SOCKET_ERROR_CODES.UNAUTHORIZED, 'Caller ID mismatch');
    callback?.({ success: false, message: 'Unauthorized' });
    return;
  }

  // Check if caller already in active call
  if (userToActiveCall.has(callerId)) {
    emitError(socket, SOCKET_ERROR_CODES.CALL_FAILED, 'Already in an active call');
    callback?.({ success: false, message: 'Already in an active call' });
    return;
  }

  try {
    // Fetch receiver user data
    const receiverUser = await User.findById(receiverId).select('name email isDeleted');

    if (!receiverUser) {
      emitError(socket, SOCKET_ERROR_CODES.USER_NOT_FOUND, 'User not found');
      callback?.({ success: false, message: 'User not found' });
      return;
    }

    if (receiverUser.isDeleted) {
      emitError(socket, SOCKET_ERROR_CODES.USER_NOT_FOUND, 'User not available');
      callback?.({ success: false, message: 'User not available' });
      return;
    }

    // Create call record in database
    const callRecord = await videoCallService.createCallRecord({
      callerId,
      receiverId,
    });
    const callRecordId = callRecord._id.toString();

    // Check if receiver is online
    const receiverSocketId = presenceService.getSocketByUserId(receiverId);

    if (!receiverSocketId) {
      // Receiver is offline - send push notification
      await oneSignalService.sendCallNotification({
        receiverExternalUserId: receiverId,
        callerId,
        callerName: user.name,
        callRecordId,
      });

      logCallInitiated(callerId, receiverId, callRecordId);
      
      // Mark as missed since receiver can't answer
      await videoCallService.markMissed(callRecordId);
      
      emitError(socket, SOCKET_ERROR_CODES.USER_OFFLINE, 'User is offline. Notification sent.');
      callback?.({ success: false, message: 'User is offline. Notification sent.', callRecordId });
      return;
    }

    // Track active call
    const activeCall: ActiveCall = {
      callRecordId,
      callerId,
      receiverId,
      startedAt: new Date(),
      answered: false,
      bufferedCandidates: {
        forCaller: [],
        forReceiver: [],
      },
    };
    activeCalls.set(callRecordId, activeCall);
    userToActiveCall.set(callerId, callRecordId);
    userToActiveCall.set(receiverId, callRecordId);

    // Set up call timeout
    setupCallTimeout(io, callRecordId, callerId, receiverId);

    // Get receiver socket and forward call
    const receiverSocket = getSocketById(io, receiverSocketId);
    if (receiverSocket) {
      receiverSocket.emit(SERVER_EVENTS.INCOMING_CALL, {
        callerId,
        callerName: user.name,
        offer,
        callRecordId,
      });

      logIncomingCall(callerId, receiverId, receiverSocketId);
    }

    logCallInitiated(callerId, receiverId, callRecordId);
    callback?.({ success: true, message: 'Call initiated', callRecordId });

  } catch (error: any) {
    logSocketError(socket.id, CLIENT_EVENTS.CALL_USER, error.message, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INTERNAL_ERROR, 'Failed to initiate call');
    callback?.({ success: false, message: 'Failed to initiate call' });
  }
};

/**
 * Handle call answer
 */
const handleAnswerCall = async (
  io: TypedServer,
  socket: TypedSocket,
  payload: AnswerCallPayload,
  callback?: (response: { success: boolean; message?: string }) => void
) => {
  const user = getSocketUser(socket);

  // Validate payload
  const validation = validateSocketPayload(schemas.answerCall, payload);
  if (!validation.valid) {
    logValidationError(socket.id, CLIENT_EVENTS.ANSWER_CALL, validation.errors!, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INVALID_PAYLOAD, validation.errors!.join(', '));
    callback?.({ success: false, message: validation.errors!.join(', ') });
    return;
  }

  const { callerId, answer } = validation.value as AnswerCallPayload;

  try {
    // Find active call
    const callRecordId = userToActiveCall.get(user.id);
    if (!callRecordId) {
      emitError(socket, SOCKET_ERROR_CODES.CALL_FAILED, 'No incoming call found');
      callback?.({ success: false, message: 'No incoming call found' });
      return;
    }

    const activeCall = activeCalls.get(callRecordId);
    if (!activeCall || activeCall.callerId !== callerId) {
      emitError(socket, SOCKET_ERROR_CODES.CALL_FAILED, 'Call not found');
      callback?.({ success: false, message: 'Call not found' });
      return;
    }

    // Clear timeout since call is being answered
    if (activeCall.timeoutId) {
      clearTimeout(activeCall.timeoutId);
      activeCall.timeoutId = undefined;
    }

    // Mark call as answered for ICE candidate forwarding
    activeCall.answered = true;

    // Update call record to answered
    await videoCallService.markAnswered(callRecordId);

    // Find caller socket and forward answer
    const callerSocketId = presenceService.getSocketByUserId(callerId);
    if (callerSocketId) {
      const callerSocket = getSocketById(io, callerSocketId);
      if (callerSocket) {
        callerSocket.emit(SERVER_EVENTS.CALL_ANSWERED, {
          receiverId: user.id,
          receiverName: user.name,
          answer,
        });

        // Flush buffered ICE candidates to caller (from receiver)
        for (const buffered of activeCall.bufferedCandidates.forCaller) {
          callerSocket.emit(SERVER_EVENTS.ICE_CANDIDATE, buffered);
        }
      }
    }

    // Flush buffered ICE candidates to receiver (from caller)
    const receiverSocketId = presenceService.getSocketByUserId(user.id);
    if (receiverSocketId) {
      const receiverSocket = getSocketById(io, receiverSocketId);
      if (receiverSocket) {
        for (const buffered of activeCall.bufferedCandidates.forReceiver) {
          receiverSocket.emit(SERVER_EVENTS.ICE_CANDIDATE, buffered);
        }
      }
    }

    // Clear buffered candidates
    activeCall.bufferedCandidates.forCaller = [];
    activeCall.bufferedCandidates.forReceiver = [];

    logCallAnswered(callerId, user.id, callRecordId);
    callback?.({ success: true, message: 'Call answered' });

  } catch (error: any) {
    logSocketError(socket.id, CLIENT_EVENTS.ANSWER_CALL, error.message, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INTERNAL_ERROR, 'Failed to answer call');
    callback?.({ success: false, message: 'Failed to answer call' });
  }
};

/**
 * Handle ICE candidate exchange
 */
const handleIceCandidate = (
  io: TypedServer,
  socket: TypedSocket,
  payload: IceCandidatePayload
) => {
  const user = getSocketUser(socket);

  // Validate payload
  const validation = validateSocketPayload(schemas.iceCandidate, payload);
  if (!validation.valid) {
    logValidationError(socket.id, CLIENT_EVENTS.ICE_CANDIDATE, validation.errors!, user.id);
    return; // Silent fail for ICE candidates
  }

  const { receiverId, candidate } = validation.value as IceCandidatePayload;

  // Check if there's an active call and whether it's been answered
  const callRecordId = userToActiveCall.get(user.id);
  if (callRecordId) {
    const activeCall = activeCalls.get(callRecordId);
    if (activeCall && !activeCall.answered) {
      // Buffer ICE candidates until the call is answered
      const candidateData: BufferedIceCandidate = { senderId: user.id, candidate };
      if (receiverId === activeCall.callerId) {
        activeCall.bufferedCandidates.forCaller.push(candidateData);
      } else {
        activeCall.bufferedCandidates.forReceiver.push(candidateData);
      }
      logIceCandidate(user.id, receiverId);
      return;
    }
  }

  // Call is answered or no active call - forward immediately
  const receiverSocketId = presenceService.getSocketByUserId(receiverId);
  if (!receiverSocketId) {
    return; // Silent fail - receiver may have disconnected
  }

  const receiverSocket = getSocketById(io, receiverSocketId);
  if (receiverSocket) {
    receiverSocket.emit(SERVER_EVENTS.ICE_CANDIDATE, {
      senderId: user.id,
      candidate,
    });

    logIceCandidate(user.id, receiverId);
  }
};

/**
 * Handle call rejection
 */
const handleRejectCall = async (
  io: TypedServer,
  socket: TypedSocket,
  payload: RejectCallPayload,
  callback?: (response: { success: boolean; message?: string }) => void
) => {
  const user = getSocketUser(socket);

  // Validate payload
  const validation = validateSocketPayload(schemas.rejectCall, payload);
  if (!validation.valid) {
    logValidationError(socket.id, CLIENT_EVENTS.REJECT_CALL, validation.errors!, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INVALID_PAYLOAD, validation.errors!.join(', '));
    callback?.({ success: false, message: validation.errors!.join(', ') });
    return;
  }

  const { receiverId: callerId } = validation.value as RejectCallPayload; // receiverId in payload is actually the caller

  try {
    // Find active call
    const callRecordId = userToActiveCall.get(user.id);
    if (callRecordId) {
      // Update call record to rejected
      await videoCallService.markRejected(callRecordId);
      
      // Clear active call tracking
      clearActiveCall(callRecordId);
    }

    // Notify caller of rejection
    const callerSocketId = presenceService.getSocketByUserId(callerId);
    if (callerSocketId) {
      const callerSocket = getSocketById(io, callerSocketId);
      if (callerSocket) {
        callerSocket.emit(SERVER_EVENTS.CALL_REJECTED, {
          receiverId: user.id,
          reason: 'Call rejected by user',
        });
      }
    }

    logCallRejected(callerId, user.id, callRecordId);
    callback?.({ success: true, message: 'Call rejected' });

  } catch (error: any) {
    logSocketError(socket.id, CLIENT_EVENTS.REJECT_CALL, error.message, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INTERNAL_ERROR, 'Failed to reject call');
    callback?.({ success: false, message: 'Failed to reject call' });
  }
};

/**
 * Handle call end
 */
const handleEndCall = async (
  io: TypedServer,
  socket: TypedSocket,
  payload: EndCallPayload,
  callback?: (response: { success: boolean; message?: string }) => void
) => {
  const user = getSocketUser(socket);

  // Validate payload
  const validation = validateSocketPayload(schemas.endCall, payload);
  if (!validation.valid) {
    logValidationError(socket.id, CLIENT_EVENTS.END_CALL, validation.errors!, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INVALID_PAYLOAD, validation.errors!.join(', '));
    callback?.({ success: false, message: validation.errors!.join(', ') });
    return;
  }

  const { receiverId: otherUserId } = validation.value as EndCallPayload;

  try {
    // Find and complete active call
    const callRecordId = userToActiveCall.get(user.id);
    let duration: number | undefined;

    if (callRecordId) {
      const callRecord = await videoCallService.markCompleted(callRecordId);
      duration = callRecord?.duration ?? undefined;
      
      // Clear active call tracking
      clearActiveCall(callRecordId);
    }

    // Notify other participant
    const otherSocketId = presenceService.getSocketByUserId(otherUserId);
    if (otherSocketId) {
      const otherSocket = getSocketById(io, otherSocketId);
      if (otherSocket) {
        otherSocket.emit(SERVER_EVENTS.CALL_ENDED, {
          endedBy: user.id,
          reason: 'Call ended by user',
        });
      }
    }

    logCallEnded(user.id, otherUserId, callRecordId, duration);
    callback?.({ success: true, message: 'Call ended' });

  } catch (error: any) {
    logSocketError(socket.id, CLIENT_EVENTS.END_CALL, error.message, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INTERNAL_ERROR, 'Failed to end call');
    callback?.({ success: false, message: 'Failed to end call' });
  }
};

/**
 * Handle get online users request
 */
const handleGetOnlineUsers = (
  socket: TypedSocket
) => {
  const user = getSocketUser(socket);
  
  // Get all online user IDs from presence service
  const userIds = presenceService.getAllOnlineUserIds();
  
  // Send response
  socket.emit(SERVER_EVENTS.ONLINE_USERS, {
    userIds
  });
  
  logOnlineUsersRequested(socket.id, user.id);
  logCurrentOnlineCount(userIds.length);
};

/**
 * Handle socket disconnection
 */
const handleDisconnect = async (
  io: TypedServer,
  socket: TypedSocket,
  reason: string
) => {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  // Check if user has already reconnected with a new socket
  // If so, this is a stale disconnect — don't clear call state or presence
  const currentSocketId = presenceService.getSocketByUserId(user.id);
  const isStaleDisconnect = currentSocketId !== null && currentSocketId !== socket.id;

  if (!isStaleDisconnect) {
    // Check if user had an active call
    const callRecordId = userToActiveCall.get(user.id);
    if (callRecordId) {
      const activeCall = activeCalls.get(callRecordId);
      if (activeCall) {
        // Grant a grace period for reconnection before cleaning up the call
        // This prevents call termination on brief network disruptions
        const disconnectTimeout = setTimeout(async () => {
          // Re-check if user reconnected during grace period
          const reconnectedSocketId = presenceService.getSocketByUserId(user.id);
          if (reconnectedSocketId) {
            // User reconnected — clear the disconnect timeout reference and keep call alive
            activeCall.disconnectTimeoutId = undefined;
            return;
          }

          // User did not reconnect — clean up the call
          const otherUserId = activeCall.callerId === user.id 
            ? activeCall.receiverId 
            : activeCall.callerId;

          const callRecord = await videoCallService.getCallById(callRecordId);
          if (callRecord?.status === 'ANSWERED') {
            await videoCallService.markCompleted(callRecordId);
          }

          // Notify other participant
          const otherSocketId = presenceService.getSocketByUserId(otherUserId);
          if (otherSocketId) {
            const otherSocket = getSocketById(io, otherSocketId);
            if (otherSocket) {
              otherSocket.emit(SERVER_EVENTS.CALL_ENDED, {
                endedBy: user.id,
                reason: 'User disconnected',
              });
            }
          }

          clearActiveCall(callRecordId);

          // Broadcast user offline (deferred)
          io.emit(SERVER_EVENTS.USER_OFFLINE, {
            userId: user.id,
            userName: user.name,
          });
        }, CALL_CONFIG.DISCONNECT_GRACE_MS);

        activeCall.disconnectTimeoutId = disconnectTimeout;

        // Remove stale socket from presence but keep call state alive
        const removalResult = presenceService.removeBySocketId(socket.id);
        
        // Only emit USER_OFFLINE if this was the user's last socket
        if (removalResult.userOffline) {
          // Deferred offline broadcast (will be cancelled if user reconnects)
          // Note: This is included in the timeout to allow cancellation during grace period
        }

        logDisconnect(user.id, socket.id, `${reason} (grace period started)`);
        return;
      }
    }

    // No active call — clean up immediately
    const removalResult = presenceService.removeBySocketId(socket.id);

    // Broadcast user offline only if this was the last socket
    if (removalResult.userOffline) {
      socket.broadcast.emit(SERVER_EVENTS.USER_OFFLINE, {
        userId: user.id,
        userName: user.name,
      });
      logUserOffline(user.id);
    }
  }

  logDisconnect(user.id, socket.id, reason);
};

// ============================================
// Main Initialization
// ============================================

/**
 * Initialize video call socket handler
 * 
 * @param httpServer - HTTP server instance to attach Socket.IO to
 * @param corsOrigins - CORS origins to allow (default: all)
 * @returns Socket.IO server instance
 */
export const initializeVideoCallSocket = (
  httpServer: HttpServer,
  corsOrigins: string | string[] = '*'
): TypedServer => {
  const io: TypedServer = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection settings
    pingTimeout: 60000,
    pingInterval: 25000,
    // Transport settings
    transports: ['websocket', 'polling'],
    // Allow EIO3 clients
    allowEIO3: true,
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle new connections
  io.on('connection', (socket: TypedSocket) => {
    const user = getSocketUser(socket);
    logConnection(user.id, socket.id, user.name);

    // Auto-register user on connection
    handleRegisterUser(io, socket);

    // Register event handlers
    socket.on(CLIENT_EVENTS.REGISTER_USER, () => {
      handleRegisterUser(io, socket);
    });

    socket.on(CLIENT_EVENTS.CALL_USER, (payload, callback) => {
      handleCallUser(io, socket, payload, callback);
    });

    socket.on(CLIENT_EVENTS.ANSWER_CALL, (payload, callback) => {
      handleAnswerCall(io, socket, payload, callback);
    });

    socket.on(CLIENT_EVENTS.ICE_CANDIDATE, (payload) => {
      handleIceCandidate(io, socket, payload);
    });

    socket.on(CLIENT_EVENTS.REJECT_CALL, (payload, callback) => {
      handleRejectCall(io, socket, payload, callback);
    });

    socket.on(CLIENT_EVENTS.END_CALL, (payload, callback) => {
      handleEndCall(io, socket, payload, callback);
    });

    socket.on(CLIENT_EVENTS.GET_ONLINE_USERS, () => {
      handleGetOnlineUsers(socket);
    });

    socket.on('disconnect', (reason) => {
      handleDisconnect(io, socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      logSocketError(socket.id, 'socket_error', error.message, user?.id);
    });
  });

  return io;
};

export default initializeVideoCallSocket;
