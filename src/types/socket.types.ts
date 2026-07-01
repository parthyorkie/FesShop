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
