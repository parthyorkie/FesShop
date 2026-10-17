import { Server as HttpServer } from 'http';
import { TypedServer, TypedSocket } from '../types/socket.types';
import { initializeVideoCallSocket } from '../socket/videoCall.socket';
import { registerChatSocket } from '../handlers/chat.socket';

let ioInstance: TypedServer | null = null;

/**
 * Initialize Socket.IO server instance.
 * Reuses the HTTP server and wraps all socket handlers (Video Call, Counter, Chat).
 * Enforces a single Socket.IO server instance.
 */
export const initializeSocket = (
  httpServer: HttpServer,
  corsOrigins: string | string[] = '*'
): TypedServer => {
  // Initialize base Socket.IO server with Auth middleware and VideoCall / Counter handlers
  const io = initializeVideoCallSocket(httpServer, corsOrigins);
  ioInstance = io;

  // Register Chat socket event listeners on connection
  io.on('connection', (socket: TypedSocket) => {
    registerChatSocket(io, socket);
  });

  return io;
};

/**
 * Get the single initialized Socket.IO server instance.
 */
export const getIO = (): TypedServer => {
  if (!ioInstance) {
    throw new Error('Socket.IO server has not been initialized');
  }
  return ioInstance;
};
  // New socket service for payment success
export const socketService = {
  emitPaymentSuccess: (userId: string, payload: {
    orderId: string;
    transactionId: string;
    paymentStatus: 'PAID';
  }): void => {
    try {
      getIO().to(`user:${userId}`).emit('payment:success', payload);
    } catch {}
  },
  emitPaymentFailed: (userId: string, payload: { orderId: string; reason: string }): void => {
    try {
      getIO().to(`user:${userId}`).emit('payment:failed', payload);
    } catch {}
  },
};
