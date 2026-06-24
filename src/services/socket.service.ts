import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { logger } from "../utils/logger";

/**
 * Socket.IO Service
 *
 * Manages WebSocket connections and real-time event broadcasting.
 * Provides a centralized interface for emitting events to connected clients.
 *
 * **Design Pattern:**
 * - Singleton pattern: Single Socket.IO instance shared across the application
 * - Late initialization: Socket instance is created after HTTP server is ready
 * - Loosely coupled: Services can broadcast without direct Socket.IO dependencies
 */

let io: SocketIOServer | null = null;

/**
 * Initializes the Socket.IO server instance.
 *
 * **Integration Point:**
 * Called once during server startup after HTTP server creation.
 *
 * @param {HTTPServer} httpServer - The HTTP server instance to attach Socket.IO to
 * @returns {SocketIOServer} The initialized Socket.IO server instance
 */
export const initializeSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`[Socket.IO] Client connected - socketId: ${socket.id}`);

    socket.on("disconnect", () => {
      logger.info(`[Socket.IO] Client disconnected - socketId: ${socket.id}`);
    });
  });

  logger.info("[Socket.IO] Socket.IO server initialized successfully");

  return io;
};

/**
 * Retrieves the Socket.IO server instance.
 *
 * **Usage:**
 * Services call this to get the Socket.IO instance for broadcasting events.
 *
 * @returns {SocketIOServer | null} The Socket.IO instance, or null if not initialized
 */
export const getSocketInstance = (): SocketIOServer | null => {
  return io;
};

/**
 * Broadcasts a Social Proof event to all connected clients.
 *
 * **Event Contract:**
 * - Event Name: `social-proof:new`
 * - Payload: { id, message, createdAt }
 *
 * **Duplicate Prevention:**
 * Events are deduplicated at the service layer using a Set-based cache.
 * This function does NOT perform duplicate checking - it assumes the caller
 * has already verified the event is unique.
 *
 * **Error Handling:**
 * - Broadcast failures are logged but do NOT throw exceptions
 * - Missing Socket.IO instance is handled gracefully (logs warning)
 * - Non-blocking: Caller's execution continues even if broadcast fails
 *
 * @param {object} payload - The social proof event data to broadcast
 * @param {string} payload.id - Unique event identifier
 * @param {string} payload.message - User-facing message
 * @param {Date} payload.createdAt - Event creation timestamp
 */
export const broadcastSocialProofEvent = (payload: {
  id: string;
  message: string;
  createdAt: Date;
}): void => {
  try {
    // Check if Socket.IO is initialized
    if (!io) {
      logger.warn(
        `[Socket.IO] Broadcast skipped - Socket.IO not initialized - eventId: ${payload.id}`
      );
      return;
    }

    // Log broadcast attempt
    logger.info(
      `[Socket.IO] Broadcasting social proof event - eventId: ${payload.id}, message: "${payload.message}"`
    );

    // Emit to all connected clients
    io.emit("social-proof:new", payload);

    // Log broadcast success
    logger.info(
      `[Socket.IO] Social proof event broadcast completed - eventId: ${payload.id}`
    );
  } catch (error: any) {
    // Error handling: Broadcast failure must NOT break event creation
    logger.error(
      `[Socket.IO] Broadcast failed - eventId: ${payload.id}, error: ${error.message}`,
      { stack: error.stack }
    );
  }
};
