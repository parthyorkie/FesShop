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
  CallStatePayload,
  RecoverCallPayload,
  CallRecoveredPayload,
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
  logSocketReplaced,
  logReconnectDetected,
  logStaleDisconnectIgnored,
  logCallRecoveryStarted,
  logCallRecoveryCompleted,
  logCallRecoveryFailed,
  logPeerNotifiedOfReconnect,
  logRecoveryAlreadyInProgress,
  logCleanupAlreadyCompleted,
  logDisconnectGraceExpired,
  logDisconnectGraceCancelled,
  logRecoveryDeadlineStarted,
  logRecoveryDeadlineExpired,
  logRecoveryDeadlineCancelled,
  logStaleCallDetected,
  logStaleCleanupRun,
  logAllTimersCleaned,
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
const clearActiveCall = (callRecordId: string): ActiveCall | null => {
  const activeCall = activeCalls.get(callRecordId);
  if (!activeCall) return null;

  // Track which timers are being cleaned
  const timersCleaned: string[] = [];

  // Clear all timeouts if exist
  if (activeCall.timeoutId) {
    clearTimeout(activeCall.timeoutId);
    timersCleaned.push('callTimeout');
  }
  if (activeCall.recoveryDeadlineId) {
    clearTimeout(activeCall.recoveryDeadlineId);
    timersCleaned.push('recoveryDeadline');
  }

  // Log timer cleanup for debugging
  if (timersCleaned.length > 0) {
    logAllTimersCleaned(callRecordId, timersCleaned);
  }

  // Remove from tracking maps
  if (userToActiveCall.get(activeCall.callerId) === callRecordId) {
    userToActiveCall.delete(activeCall.callerId);
  }
  if (userToActiveCall.get(activeCall.receiverId) === callRecordId) {
    userToActiveCall.delete(activeCall.receiverId);
  }
  activeCalls.delete(callRecordId);

  return activeCall;
};

/**
 * Cancel the recovery deadline timer (called when user reconnects successfully)
 */
const cancelRecoveryDeadline = (activeCall: ActiveCall, userId: string): void => {
  if (activeCall.recoveryDeadlineId) {
    clearTimeout(activeCall.recoveryDeadlineId);
    activeCall.recoveryDeadlineId = undefined;
    activeCall.recoveryStartedAt = undefined;
    activeCall.disconnectedUserId = undefined;
    logRecoveryDeadlineCancelled(userId, activeCall.callRecordId);
  }
};

/**
 * Handle call recovery when user reconnects during an active call.
 * The recovery deadline timer has already been cancelled by the caller.
 */
const handleCallRecoveryOnReconnect = async (
  io: TypedServer,
  socket: TypedSocket,
  user: SocketUser,
  activeCall: ActiveCall
): Promise<void> => {
  const callRecordId = activeCall.callRecordId;

  // Guard: prevent duplicate concurrent recovery attempts
  if (activeCall.recoveryInProgress) {
    logRecoveryAlreadyInProgress(user.id, callRecordId);
    return;
  }
  activeCall.recoveryInProgress = true;

  try {
    logCallRecoveryStarted(user.id, callRecordId);
    
    // Determine the peer in the call
    const peerId = activeCall.callerId === user.id 
      ? activeCall.receiverId 
      : activeCall.callerId;
    
    // Get peer user data
    const peerUser = await User.findById(peerId).select('name');

    // --- Post-await validation (Race 2 & 3) ---
    // Call may have been ended/rejected/cleaned during the await
    if (!activeCalls.has(callRecordId)) {
      logCallRecoveryFailed(user.id, callRecordId, 'Call ended during recovery');
      return;
    }
    // Socket may have been replaced by a newer connection during the await
    const currentSocketId = presenceService.getSocketByUserId(user.id);
    if (currentSocketId !== socket.id) {
      logCallRecoveryFailed(user.id, callRecordId, 'Socket replaced during recovery');
      return;
    }

    if (!peerUser) {
      logCallRecoveryFailed(user.id, callRecordId, 'Peer not found');
      return;
    }
    
    // Build call state payload
    const callState: CallStatePayload = {
      callRecordId,
      callerId: activeCall.callerId,
      receiverId: activeCall.receiverId,
      status: activeCall.answered ? 'ANSWERED' : 'PENDING',
      offer: activeCall.lastOffer,
      answer: activeCall.lastAnswer,
    };
    
    // Send call state to reconnected user
    socket.emit(SERVER_EVENTS.CALL_STATE, callState);
    
    // Notify peer about reconnection if they are online
    const peerSocketId = presenceService.getSocketByUserId(peerId);
    if (peerSocketId) {
      const peerSocket = getSocketById(io, peerSocketId);
      if (peerSocket) {
        const recoveryPayload: CallRecoveredPayload = {
          callRecordId,
          peerId: user.id,
          peerName: user.name,
          isReconnecting: true,
        };
        peerSocket.emit(SERVER_EVENTS.CALL_RECOVERED, recoveryPayload);
        logPeerNotifiedOfReconnect(user.id, peerId, callRecordId);
      }
    }
    
    logCallRecoveryCompleted(user.id, callRecordId);
  } catch (error: any) {
    logCallRecoveryFailed(user.id, callRecordId, error.message);
  } finally {
    activeCall.recoveryInProgress = false;
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
    // Idempotent: claim cleanup atomically before async work
    const cleanedCall = clearActiveCall(callRecordId);
    if (!cleanedCall) {
      logCleanupAlreadyCompleted('call-timeout', callRecordId);
      return;
    }

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
const handleRegisterUser = async (
  io: TypedServer,
  socket: TypedSocket
) => {
  const user = getSocketUser(socket);
  
  // Check if this is the user's first socket BEFORE registering
  const wasOnline = presenceService.isUserOnline(user.id);
  
  // Register user in presence service (handles reconnection)
  const previousSocketId = presenceService.registerUser(user.id, socket.id);

  // Handle socket replacement during reconnection
  if (previousSocketId && previousSocketId !== socket.id) {
    // This is a reconnection - replace the old socket
    const previousSocket = getSocketById(io, previousSocketId);
    if (previousSocket) {
      // Disconnect old socket gracefully
      emitError(previousSocket, SOCKET_ERROR_CODES.UNAUTHORIZED, 'Replaced by new connection');
      previousSocket.disconnect(true);
    }
    
    logSocketReplaced(user.id, previousSocketId, socket.id);
  }

  // Check if this is a reconnection during an active call
  const callRecordId = userToActiveCall.get(user.id);
  if (callRecordId) {
    const activeCall = activeCalls.get(callRecordId);
    if (activeCall) {
      // Cancel the recovery deadline — user reconnected in time
      cancelRecoveryDeadline(activeCall, user.id);
      
      logReconnectDetected(user.id, socket.id);
      
      // Start call recovery process
      await handleCallRecoveryOnReconnect(io, socket, user, activeCall);
    }
  }

  // Broadcast user online status ONLY if user was offline before
  // (prevents duplicate online notifications during reconnection)
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

  // Check if receiver is already in a call (atomically reserve)
  if (userToActiveCall.has(receiverId)) {
    emitError(socket, SOCKET_ERROR_CODES.CALL_FAILED, 'User is busy');
    callback?.({ success: false, message: 'User is busy' });
    return;
  }

  // Atomically reserve both users to prevent concurrent initiation race condition
  userToActiveCall.set(callerId, 'pending');
  userToActiveCall.set(receiverId, 'pending');

  try {
    // Fetch receiver user data
    const receiverUser = await User.findById(receiverId).select('name email isDeleted');

    if (!receiverUser) {
      userToActiveCall.delete(callerId);
      userToActiveCall.delete(receiverId);
      emitError(socket, SOCKET_ERROR_CODES.USER_NOT_FOUND, 'User not found');
      callback?.({ success: false, message: 'User not found' });
      return;
    }

    if (receiverUser.isDeleted) {
      userToActiveCall.delete(callerId);
      userToActiveCall.delete(receiverId);
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
      
      userToActiveCall.delete(callerId);
      userToActiveCall.delete(receiverId);
      
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
      lastOffer: offer, // Store offer for recovery
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
    if (userToActiveCall.get(callerId) === 'pending') {
      userToActiveCall.delete(callerId);
    }
    if (userToActiveCall.get(receiverId) === 'pending') {
      userToActiveCall.delete(receiverId);
    }
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
    if (!activeCall) {
      emitError(socket, SOCKET_ERROR_CODES.CALL_FAILED, 'Call not found');
      callback?.({ success: false, message: 'Call not found' });
      return;
    }

    // SECURITY: Verify user is the actual receiver and callerId matches
    if (activeCall.receiverId !== user.id || activeCall.callerId !== callerId) {
      emitError(socket, SOCKET_ERROR_CODES.UNAUTHORIZED, 'Not authorized to answer this call');
      callback?.({ success: false, message: 'Unauthorized' });
      return;
    }

    // Clear timeout since call is being answered
    if (activeCall.timeoutId) {
      clearTimeout(activeCall.timeoutId);
      activeCall.timeoutId = undefined;
    }

    // Mark call as answered for ICE candidate forwarding
    activeCall.answered = true;
    activeCall.lastAnswer = answer; // Store answer for recovery

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
  if (!callRecordId) {
    // No active call for this user - ignore
    return;
  }

  const activeCall = activeCalls.get(callRecordId);
  if (!activeCall) {
    // Call already ended - ignore
    return;
  }

  // SECURITY: Verify receiverId is the actual peer in this call
  const actualPeerId = activeCall.callerId === user.id 
    ? activeCall.receiverId 
    : activeCall.callerId;
  
  if (receiverId !== actualPeerId) {
    logSocketError(socket.id, CLIENT_EVENTS.ICE_CANDIDATE, `Unauthorized receiverId: ${receiverId}`, user.id);
    return;
  }

  if (!activeCall.answered) {
    // Buffer ICE candidates until the call is answered
    const candidateData: BufferedIceCandidate = { senderId: user.id, candidate };
    const targetBuffer = receiverId === activeCall.callerId 
      ? activeCall.bufferedCandidates.forCaller 
      : activeCall.bufferedCandidates.forReceiver;

    if (targetBuffer.length >= CALL_CONFIG.MAX_ICE_CANDIDATES) {
      logSocketError(socket.id, CLIENT_EVENTS.ICE_CANDIDATE, `Max ICE candidates (${CALL_CONFIG.MAX_ICE_CANDIDATES}) reached`, user.id);
      return;
    }

    targetBuffer.push(candidateData);
    logIceCandidate(user.id, receiverId);
    return;
  }

  // Call is answered - forward immediately
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
    // Find active call (idempotent cleanup)
    const callRecordId = userToActiveCall.get(user.id);
    if (!callRecordId) {
      // No active call - already rejected or ended
      callback?.({ success: true, message: 'No active call to reject' });
      return;
    }

    const activeCall = activeCalls.get(callRecordId);
    if (activeCall) {
      // SECURITY: Verify user is the actual receiver and callerId matches
      if (activeCall.receiverId !== user.id || activeCall.callerId !== callerId) {
        emitError(socket, SOCKET_ERROR_CODES.UNAUTHORIZED, 'Not authorized to reject this call');
        callback?.({ success: false, message: 'Unauthorized' });
        return;
      }
    }

    // Atomically claim cleanup responsibility
    const cleanedCall = clearActiveCall(callRecordId);
    if (cleanedCall) {
      // Update call record to rejected
      await videoCallService.markRejected(callRecordId);

      // Notify actual caller of rejection (already validated)
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
    } else {
      logCleanupAlreadyCompleted('reject-call', callRecordId);
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
    // Find and complete active call (idempotent cleanup)
    const callRecordId = userToActiveCall.get(user.id);
    if (!callRecordId) {
      // No active call to end
      callback?.({ success: true, message: 'No active call to end' });
      return;
    }

    let duration: number | undefined;

    const activeCall = activeCalls.get(callRecordId);
    if (activeCall) {
      // SECURITY: Verify user is part of the call and otherUserId is the peer
      const isAuthorized = (
        (activeCall.callerId === user.id && activeCall.receiverId === otherUserId) ||
        (activeCall.receiverId === user.id && activeCall.callerId === otherUserId)
      );
      
      if (!isAuthorized) {
        emitError(socket, SOCKET_ERROR_CODES.UNAUTHORIZED, 'Not authorized to end this call');
        callback?.({ success: false, message: 'Unauthorized' });
        return;
      }
    }

    // Atomically claim cleanup responsibility
    const cleanedCall = clearActiveCall(callRecordId);
    if (cleanedCall) {
      const callRecord = await videoCallService.markCompleted(callRecordId);
      duration = callRecord?.duration ?? undefined;

      // Notify actual peer (already validated)
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
    } else {
      logCleanupAlreadyCompleted('end-call', callRecordId);
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
 * Handle call recovery request (explicit recovery)
 */
const handleRecoverCall = async (
  io: TypedServer,
  socket: TypedSocket,
  payload: RecoverCallPayload,
  callback?: (response: { success: boolean; message?: string; callState?: CallStatePayload }) => void
) => {
  const user = getSocketUser(socket);
  
  // Validate payload
  const validation = validateSocketPayload(schemas.recoverCall, payload);
  if (!validation.valid) {
    logValidationError(socket.id, CLIENT_EVENTS.RECOVER_CALL, validation.errors!, user.id);
    emitError(socket, SOCKET_ERROR_CODES.INVALID_PAYLOAD, validation.errors!.join(', '));
    callback?.({ success: false, message: validation.errors!.join(', ') });
    return;
  }
  
  try {
    const { callRecordId } = validation.value as RecoverCallPayload;
    
    // Check if there's an active call with this ID
    const activeCall = activeCalls.get(callRecordId);
    if (!activeCall) {
      callback?.({ success: false, message: 'No active call found' });
      return;
    }
    
    // Verify user is part of this call
    if (activeCall.callerId !== user.id && activeCall.receiverId !== user.id) {
      callback?.({ success: false, message: 'Not authorized for this call' });
      return;
    }

    // Guard: prevent duplicate concurrent recovery attempts
    if (activeCall.recoveryInProgress) {
      logRecoveryAlreadyInProgress(user.id, callRecordId);
      callback?.({ success: false, message: 'Recovery already in progress' });
      return;
    }
    activeCall.recoveryInProgress = true;
    
    // Cancel the recovery deadline — user is recovering now
    cancelRecoveryDeadline(activeCall, user.id);
    
    logCallRecoveryStarted(user.id, callRecordId);
    
    // Restore user mapping
    userToActiveCall.set(user.id, callRecordId);
    
    // Build call state
    const callState: CallStatePayload = {
      callRecordId,
      callerId: activeCall.callerId,
      receiverId: activeCall.receiverId,
      status: activeCall.answered ? 'ANSWERED' : 'PENDING',
      offer: activeCall.lastOffer,
      answer: activeCall.lastAnswer,
    };
    
    // Send call state to reconnected user (consistent with automatic recovery)
    socket.emit(SERVER_EVENTS.CALL_STATE, callState);
    
    // Notify peer about recovery
    const peerId = activeCall.callerId === user.id 
      ? activeCall.receiverId 
      : activeCall.callerId;
    
    const peerSocketId = presenceService.getSocketByUserId(peerId);
    if (peerSocketId) {
      const peerSocket = getSocketById(io, peerSocketId);
      if (peerSocket) {
        const recoveryPayload: CallRecoveredPayload = {
          callRecordId,
          peerId: user.id,
          peerName: user.name,
          isReconnecting: true,
        };
        peerSocket.emit(SERVER_EVENTS.CALL_RECOVERED, recoveryPayload);
        logPeerNotifiedOfReconnect(user.id, peerId, callRecordId);
      }
    }
    
    logCallRecoveryCompleted(user.id, callRecordId);
    
    activeCall.recoveryInProgress = false;
    callback?.({ success: true, message: 'Call recovered', callState });
    
  } catch (error: any) {
    // Reset recovery flag if call still exists
    const activeCall = activeCalls.get(payload.callRecordId);
    if (activeCall) {
      activeCall.recoveryInProgress = false;
    }
    
    logCallRecoveryFailed(user.id, payload.callRecordId, error.message);
    callback?.({ success: false, message: 'Failed to recover call' });
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

  // Check if this socket still belongs to the user
  // If not, this is a stale disconnect from a replaced socket
  const isOwnedByUser = presenceService.isSocketOwnedByUser(user.id, socket.id);
  
  if (!isOwnedByUser) {
    // This socket was already replaced during reconnection
    logStaleDisconnectIgnored(user.id, socket.id);
    return;
  }

  // Proceed with normal disconnect handling
  const isStaleDisconnect = false; // Remove the old logic

  if (!isStaleDisconnect) {
    // Check if user had an active call
    const callRecordId = userToActiveCall.get(user.id);
    if (callRecordId) {
      const activeCall = activeCalls.get(callRecordId);
      if (activeCall) {
        // Clear any existing recovery deadline (other participant may have already disconnected)
        if (activeCall.recoveryDeadlineId) {
          clearTimeout(activeCall.recoveryDeadlineId);
        }

        // Set the single recovery deadline — call stays alive for the full window
        // If user reconnects within RECOVERY_WINDOW_MS, the deadline is cancelled
        const recoveryDeadlineId = setTimeout(async () => {
          // Idempotency guard: call may have been cleaned up by end/reject/timeout
          if (!activeCalls.has(callRecordId)) {
            logCleanupAlreadyCompleted('recovery-deadline', callRecordId);
            return;
          }

          // Re-check if user reconnected during recovery window
          const reconnectedSocketId = presenceService.getSocketByUserId(user.id);
          if (reconnectedSocketId) {
            logDisconnectGraceCancelled(user.id, callRecordId);
            activeCall.recoveryDeadlineId = undefined;
            activeCall.recoveryStartedAt = undefined;
            activeCall.disconnectedUserId = undefined;
            return;
          }

          logDisconnectGraceExpired(user.id, callRecordId);

          // Atomically claim cleanup responsibility
          const cleanedCall = clearActiveCall(callRecordId);
          if (!cleanedCall) return;

          // User did not reconnect — clean up the call
          const otherUserId = cleanedCall.callerId === user.id 
            ? cleanedCall.receiverId 
            : cleanedCall.callerId;

          // markCompleted is now conditional (ANSWERED → COMPLETED only)
          // If still MISSED, this is a no-op — correct behavior
          await videoCallService.markCompleted(callRecordId);

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

          // Broadcast user offline (deferred)
          io.emit(SERVER_EVENTS.USER_OFFLINE, {
            userId: user.id,
            userName: user.name,
          });
        }, CALL_CONFIG.RECOVERY_WINDOW_MS);

        activeCall.recoveryDeadlineId = recoveryDeadlineId;
        activeCall.recoveryStartedAt = new Date();
        activeCall.disconnectedUserId = user.id;
        
        logRecoveryDeadlineStarted(user.id, callRecordId, CALL_CONFIG.RECOVERY_WINDOW_MS);
        
        // Notify peer about reconnect grace period
        const otherUserId = activeCall.callerId === user.id 
          ? activeCall.receiverId 
          : activeCall.callerId;
        const otherSocketId = presenceService.getSocketByUserId(otherUserId);
        if (otherSocketId) {
          const otherSocket = getSocketById(io, otherSocketId);
          if (otherSocket) {
            otherSocket.emit(SERVER_EVENTS.PEER_RECONNECTING, {
              userId: user.id,
            });
          }
        }

        // Remove stale socket from presence but keep call state alive
        presenceService.removeBySocketId(socket.id);

        logDisconnect(user.id, socket.id, `${reason} (recovery window started: ${CALL_CONFIG.RECOVERY_WINDOW_MS}ms)`);
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
// Stale Call Cleanup
// ============================================

/**
 * Periodic cleanup of stale calls
 * Removes calls that have been in recovery state too long or are otherwise stuck
 */
const cleanupStaleCalls = async (io: TypedServer): Promise<void> => {
  const now = new Date();
  const staleCalls: string[] = [];

  for (const [callRecordId, activeCall] of activeCalls.entries()) {
    let isStale = false;
    let reason = '';

    // Check if call has been in recovery state for too long
    if (activeCall.recoveryInProgress && activeCall.recoveryStartedAt) {
      const recoveryAge = now.getTime() - activeCall.recoveryStartedAt.getTime();
      if (recoveryAge > CALL_CONFIG.MAX_RECOVERY_AGE_MS) {
        isStale = true;
        reason = `recovery state exceeded ${CALL_CONFIG.MAX_RECOVERY_AGE_MS}ms`;
        logStaleCallDetected(callRecordId, recoveryAge);
      }
    }

    // Check if unanswered call has been active too long
    // (should have been handled by call timeout, but safety net)
    if (!activeCall.answered && !activeCall.timeoutId) {
      const callAge = now.getTime() - activeCall.startedAt.getTime();
      if (callAge > CALL_CONFIG.CALL_TIMEOUT_MS * 2) {
        isStale = true;
        reason = `unanswered call exceeded ${CALL_CONFIG.CALL_TIMEOUT_MS * 2}ms without timeout`;
        logStaleCallDetected(callRecordId, callAge);
      }
    }

    if (isStale) {
      staleCalls.push(callRecordId);
      
      // Atomically claim cleanup responsibility
      const cleanedCall = clearActiveCall(callRecordId);
      if (cleanedCall) {
        // Mark call appropriately in database
        if (cleanedCall.answered) {
          await videoCallService.markCompleted(callRecordId);
        } else {
          await videoCallService.markMissed(callRecordId);
        }

        // Notify both participants
        for (const participantId of [cleanedCall.callerId, cleanedCall.receiverId]) {
          const socketId = presenceService.getSocketByUserId(participantId);
          if (socketId) {
            const socket = getSocketById(io, socketId);
            if (socket) {
              socket.emit(SERVER_EVENTS.CALL_ENDED, {
                endedBy: 'system',
                reason: `Stale call cleanup: ${reason}`,
              });
            }
          }
        }
      }
    }
  }

  if (staleCalls.length > 0 || activeCalls.size > 0) {
    logStaleCleanupRun(activeCalls.size + staleCalls.length, staleCalls.length);
  }
};

// ============================================
// Main Initialization
// ============================================

// Store cleanup interval reference for proper shutdown
let staleCleanupInterval: NodeJS.Timeout | null = null;

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
    
    socket.on(CLIENT_EVENTS.RECOVER_CALL, (payload, callback) => {
      handleRecoverCall(io, socket, payload, callback);
    });

    socket.on('disconnect', (reason) => {
      handleDisconnect(io, socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      logSocketError(socket.id, 'socket_error', error.message, user?.id);
    });
  });

  // Start periodic stale call cleanup
  // Clear any existing interval first (in case of reinitialization)
  if (staleCleanupInterval) {
    clearInterval(staleCleanupInterval);
  }
  
  staleCleanupInterval = setInterval(() => {
    cleanupStaleCalls(io).catch(error => {
      logSocketError('system', 'stale-cleanup', error.message);
    });
  }, CALL_CONFIG.STALE_CLEANUP_INTERVAL_MS);

  return io;
};

/**
 * Cleanup function to stop stale call cleanup interval
 * Should be called when shutting down the server
 */
export const shutdownVideoCallSocket = (): void => {
  if (staleCleanupInterval) {
    clearInterval(staleCleanupInterval);
    staleCleanupInterval = null;
  }
};

export default initializeVideoCallSocket;
