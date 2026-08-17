/**
 * Socket.IO Type Definitions
 * 
 * Extends Socket.IO types with authenticated user context
 * and typed event maps for type-safe socket communication.
 */

import { Socket, Server } from 'socket.io';
import {
  RegisterUserPayload,
  CallUserPayload,
  AnswerCallPayload,
  IceCandidatePayload,
  RejectCallPayload,
  EndCallPayload,
  IncomingCallPayload,
  CallAnsweredPayload,
  IceCandidateReceivedPayload,
  CallRejectedPayload,
  CallEndedPayload,
  UserPresencePayload,
  OnlineUsersPayload,
  SocketErrorPayload,
  CallStatePayload,
  RecoverCallPayload,
  CallRecoveredPayload,
  PeerReconnectingPayload,
} from '../interfaces/videoCall.interface';

// ============================================
// Authenticated Socket User
// ============================================

export interface SocketUser {
  id: string;
  name: string;
  email?: string;
  role?: 'ADMIN' | 'USER';
}

// ============================================
// Socket.IO Event Maps (for type safety)
// ============================================

// Events sent from client to server
export interface ClientToServerEvents {
  'register-user': (payload: RegisterUserPayload, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'call-user': (payload: CallUserPayload, callback?: (response: { success: boolean; message?: string; callRecordId?: string }) => void) => void;
  'answer-call': (payload: AnswerCallPayload, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'ice-candidate': (payload: IceCandidatePayload) => void;
  'reject-call': (payload: RejectCallPayload, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'end-call': (payload: EndCallPayload, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'get-online-users': () => void;
  'recover-call': (payload: RecoverCallPayload, callback?: (response: { success: boolean; message?: string; callState?: CallStatePayload }) => void) => void;
  'chat:join': (payload: { conversationId: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'chat:leave': (payload: { conversationId: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'message:send': (payload: { conversationId: string; clientMessageId: string; type: string; text: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'message:delivered': (payload: { conversationId: string; messageId: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'message:read': (payload: { conversationId: string; messageId: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'reaction:add': (payload: { conversationId: string; messageId: string; emoji: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
  'reaction:remove': (payload: { conversationId: string; messageId: string }, callback?: (response: { success: boolean; message?: string }) => void) => void;
}

// Events sent from server to client
export interface ServerToClientEvents {
  'incoming-call': (payload: IncomingCallPayload) => void;
  'call-answered': (payload: CallAnsweredPayload) => void;
  'ice-candidate': (payload: IceCandidateReceivedPayload) => void;
  'call-rejected': (payload: CallRejectedPayload) => void;
  'call-ended': (payload: CallEndedPayload) => void;
  'user-online': (payload: UserPresencePayload) => void;
  'user-offline': (payload: UserPresencePayload) => void;
  'online-users': (payload: OnlineUsersPayload) => void;
  'error': (payload: SocketErrorPayload) => void;
  'registered': (payload: { userId: string; message: string }) => void;
  'call-state': (payload: CallStatePayload) => void;
  'call-recovered': (payload: CallRecoveredPayload) => void;
  'peer-reconnecting': (payload: PeerReconnectingPayload) => void;
  'message:new': (payload: {
    messageId: string;
    conversationId: string;
    senderId: string;
    clientMessageId: string;
    type: string;
    text?: string;
    status: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }) => void;
  'message:delivered': (payload: { conversationId: string; messageId: string; readerId: string; deliveredAt: Date | string }) => void;
  'message:read': (payload: { conversationId: string; messageId: string; readerId: string; readAt: Date | string }) => void;
  'reaction:added': (payload: { conversationId: string; messageId: string; reaction: { userId: string; emoji: string; createdAt: Date | string } }) => void;
  'reaction:removed': (payload: { conversationId: string; messageId: string; userId: string }) => void;
  'chat:error': (payload: { code: string | number; message: string; details?: Record<string, unknown> }) => void;
}

// Inter-server events (for Redis adapter scalability)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data (attached to socket instance)
export interface SocketData {
  user: SocketUser;
}

// ============================================
// Typed Socket and Server
// ============================================

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ============================================
// Socket Authentication Result
// ============================================

export interface SocketAuthResult {
  success: boolean;
  user?: SocketUser;
  error?: string;
}

// ============================================
// Callback Response Types
// ============================================

export interface SocketCallbackResponse {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}
