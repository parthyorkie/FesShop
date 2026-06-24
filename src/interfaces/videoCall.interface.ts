/**
 * Video Call Interfaces
 * 
 * TypeScript interfaces for WebRTC signaling payloads,
 * call history records, and socket communication.
 */

import { Document, Types } from 'mongoose';
import { CallStatus } from '../constants/videoCall.constants';

// ============================================
// WebRTC Types (matching browser/RN WebRTC API)
// ============================================

export interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp?: string;
}

export type RTCSdpType = 'offer' | 'answer' | 'pranswer' | 'rollback';

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

// ============================================
// Client → Server Event Payloads
// ============================================

export interface RegisterUserPayload {
  userId: string;
}

export interface CallUserPayload {
  callerId: string;
  receiverId: string;
  offer: RTCSessionDescriptionInit;
}

export interface AnswerCallPayload {
  callerId: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  receiverId: string;
  candidate: RTCIceCandidateInit;
}

export interface RejectCallPayload {
  receiverId: string;
}

export interface EndCallPayload {
  receiverId: string;
}

// ============================================
// Server → Client Event Payloads
// ============================================

export interface IncomingCallPayload {
  callerId: string;
  callerName: string;
  offer: RTCSessionDescriptionInit;
  callRecordId?: string;
}

export interface CallAnsweredPayload {
  receiverId: string;
  receiverName: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidateReceivedPayload {
  senderId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallRejectedPayload {
  receiverId: string;
  reason?: string;
}

export interface CallEndedPayload {
  endedBy: string;
  reason?: string;
}

export interface UserPresencePayload {
  userId: string;
  userName?: string;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Call History Model Interface
// ============================================

export interface ICallHistory extends Document {
  callerId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: CallStatus;
  startedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

export interface ICallHistoryCreate {
  callerId: string;
  receiverId: string;
}

export interface ICallHistoryUpdate {
  status?: CallStatus;
  answeredAt?: Date;
  endedAt?: Date;
  duration?: number;
}

// ============================================
// Presence Types
// ============================================

export interface PresenceUser {
  userId: string;
  socketId: string;
  connectedAt: Date;
}

// ============================================
// Active Call Tracking (in-memory)
// ============================================

export interface BufferedIceCandidate {
  senderId: string;
  candidate: RTCIceCandidateInit;
}

export interface ActiveCall {
  callRecordId: string;
  callerId: string;
  receiverId: string;
  startedAt: Date;
  timeoutId?: NodeJS.Timeout;
  disconnectTimeoutId?: NodeJS.Timeout;
  answered: boolean;
  /** ICE candidates buffered before call is answered */
  bufferedCandidates: {
    forCaller: BufferedIceCandidate[];
    forReceiver: BufferedIceCandidate[];
  };
}
