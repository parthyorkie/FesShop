import { TypedServer, TypedSocket } from '../types/socket.types';
import { getSocketUser } from '../middlewares/socketAuth.middleware';
import * as chatService from '../services/chat.service';
import { socketMessageSchema, socketMessageStatusSchema, socketReactionSchema } from '../validations/chat.validation';
import { logger } from '../utils/logger';

/**
 * Helper to emit chat errors strictly to the requesting socket.
 * Exposes only safe error messages without internal stack traces.
 */
const emitChatError = (
  socket: TypedSocket,
  code: string | number,
  message: string,
  details?: Record<string, unknown>
): void => {
  socket.emit('chat:error', {
    code,
    message,
    ...(details && { details }),
  });
};

/**
 * Validate standard MongoDB ObjectId string format.
 */
const isValidObjectId = (id: string): boolean => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Register Chat socket handlers for an authenticated socket connection.
 */
export const registerChatSocket = (io: TypedServer, socket: TypedSocket): void => {
  let user: { id: string; name: string };
  try {
    user = getSocketUser(socket);
  } catch (err: any) {
    logger.warn(`[Chat Socket] Unauthenticated socket event attempt - socketId: ${socket.id}`);
    return;
  }

  // --------------------------------------------------------------------------
  // Event: chat:join
  // --------------------------------------------------------------------------
  socket.on('chat:join', async (payload: { conversationId: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      if (!payload || !payload.conversationId || !isValidObjectId(payload.conversationId)) {
        emitChatError(socket, 400, 'Invalid conversation ID format');
        if (callback) callback({ success: false, message: 'Invalid conversation ID format' });
        return;
      }

      // Verify conversation membership
      await chatService.validateConversationMembership(payload.conversationId, user.id);

      // Join room
      socket.join(payload.conversationId);
      logger.info(`[Chat Socket] User ${user.id} joined conversation room ${payload.conversationId}`);

      if (callback) {
        callback({ success: true, message: 'Joined conversation room successfully' });
      }
    } catch (error: any) {
      logger.warn(`[Chat Socket] chat:join failed for user ${user.id}: ${error.message}`);
      emitChatError(socket, error.statusCode || 403, error.message || 'Failed to join conversation');
      if (callback) {
        callback({ success: false, message: error.message || 'Failed to join conversation' });
      }
    }
  });

  // --------------------------------------------------------------------------
  // Event: chat:leave
  // --------------------------------------------------------------------------
  socket.on('chat:leave', async (payload: { conversationId: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      if (!payload || !payload.conversationId || !isValidObjectId(payload.conversationId)) {
        emitChatError(socket, 400, 'Invalid conversation ID format');
        if (callback) callback({ success: false, message: 'Invalid conversation ID format' });
        return;
      }

      socket.leave(payload.conversationId);
      logger.info(`[Chat Socket] User ${user.id} left conversation room ${payload.conversationId}`);

      if (callback) {
        callback({ success: true, message: 'Left conversation room successfully' });
      }
    } catch (error: any) {
      logger.warn(`[Chat Socket] chat:leave failed for user ${user.id}: ${error.message}`);
      if (callback) {
        callback({ success: false, message: error.message || 'Failed to leave conversation' });
      }
    }
  });

  // --------------------------------------------------------------------------
  // Event: message:send
  // --------------------------------------------------------------------------
  socket.on('message:send', async (payload: { conversationId: string; clientMessageId: string; type: string; text: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      // Validate payload schema using Joi
      const { error, value } = socketMessageSchema.validate(payload);
      if (error) {
        const errorMsg = error.details[0]?.message || 'Invalid message payload';
        emitChatError(socket, 400, errorMsg);
        if (callback) callback({ success: false, message: errorMsg });
        return;
      }

      const { conversationId, clientMessageId, text } = value;

      // STRICT REQUIREMENT: Save message to DB & update conversation before emitting message:new
      const message = await chatService.sendTextMessage(
        conversationId,
        user.id,
        clientMessageId,
        text
      );

      const messagePayload = {
        messageId: (message as any)._id.toString(),
        conversationId: message.conversationId.toString(),
        senderId: message.senderId.toString(),
        clientMessageId: message.clientMessageId,
        type: message.type,
        text: message.text,
        status: message.status,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      // Emit to all sockets in the conversation room
      io.to(conversationId).emit('message:new', messagePayload);

      logger.info(`[Chat Socket] Message ${messagePayload.messageId} sent by ${user.id} to conversation ${conversationId}`);

      if (callback) {
        callback({ success: true });
      }
    } catch (error: any) {
      logger.warn(`[Chat Socket] message:send failed for user ${user.id}: ${error.message}`);
      emitChatError(socket, error.statusCode || 400, error.message || 'Failed to send message');
      if (callback) {
        callback({ success: false, message: error.message || 'Failed to send message' });
      }
    }
  });

  // --------------------------------------------------------------------------
  // Event: message:delivered
  // --------------------------------------------------------------------------
  socket.on('message:delivered', async (payload: { conversationId: string; messageId: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      const { error, value } = socketMessageStatusSchema.validate(payload);
      if (error) {
        const msg = error.details[0]?.message || 'Invalid payload';
        emitChatError(socket, 400, msg);
        if (callback) callback({ success: false, message: msg });
        return;
      }

      const { conversationId, messageId } = value;
      const res = await chatService.markMessageDelivered(conversationId, messageId, user.id);
      if (res.changed) {
        io.to((res.message as any).senderId.toString()).emit('message:delivered', {
          conversationId,
          messageId,
          readerId: user.id,
          deliveredAt: new Date(),
        });
      }

      if (callback) callback({ success: true });
    } catch (err: any) {
      logger.warn(`[Chat Socket] message:delivered failed for user ${user.id}: ${err.message}`);
      emitChatError(socket, err.statusCode || 400, err.message || 'Failed to mark delivered');
      if (callback) callback({ success: false, message: err.message || 'Failed to mark delivered' });
    }
  });

  // --------------------------------------------------------------------------
  // Event: message:read
  // --------------------------------------------------------------------------
  socket.on('message:read', async (payload: { conversationId: string; messageId: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      const { error, value } = socketMessageStatusSchema.validate(payload);
      if (error) {
        const msg = error.details[0]?.message || 'Invalid payload';
        emitChatError(socket, 400, msg);
        if (callback) callback({ success: false, message: msg });
        return;
      }

      const { conversationId, messageId } = value;
      const res = await chatService.markMessageRead(conversationId, messageId, user.id);
      if (res.changed) {
        io.to((res.message as any).senderId.toString()).emit('message:read', {
          conversationId,
          messageId,
          readerId: user.id,
          readAt: new Date(),
        });
      }

      if (callback) callback({ success: true });
    } catch (err: any) {
      logger.warn(`[Chat Socket] message:read failed for user ${user.id}: ${err.message}`);
      emitChatError(socket, err.statusCode || 400, err.message || 'Failed to mark read');
      if (callback) callback({ success: false, message: err.message || 'Failed to mark read' });
    }
  });

  // --------------------------------------------------------------------------
  // Event: reaction:add
  // --------------------------------------------------------------------------
  socket.on('reaction:add', async (payload: { conversationId: string; messageId: string; emoji: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      const { error, value } = socketReactionSchema.validate(payload);
      if (error) {
        const msg = error.details[0]?.message || 'Invalid payload';
        emitChatError(socket, 400, msg);
        if (callback) callback({ success: false, message: msg });
        return;
      }

      const { conversationId, messageId, emoji } = value;
      const res = await chatService.addReaction(conversationId, messageId, user.id, emoji);
      if (res && res.reaction) {
        io.to(conversationId).emit('reaction:added', {
          conversationId,
          messageId,
          reaction: {
            userId: res.reaction.userId.toString(),
            emoji: res.reaction.emoji,
            createdAt: res.reaction.createdAt,
          }
        });
      }

      if (callback) callback({ success: true });
    } catch (err: any) {
      logger.warn(`[Chat Socket] reaction:add failed for user ${user.id}: ${err.message}`);
      emitChatError(socket, err.statusCode || 400, err.message || 'Failed to add reaction');
      if (callback) callback({ success: false, message: err.message || 'Failed to add reaction' });
    }
  });

  // --------------------------------------------------------------------------
  // Event: reaction:remove
  // --------------------------------------------------------------------------
  socket.on('reaction:remove', async (payload: { conversationId: string; messageId: string }, callback?: (response: { success: boolean; message?: string }) => void) => {
    try {
      const { error, value } = socketMessageStatusSchema.validate(payload);
      if (error) {
        const msg = error.details[0]?.message || 'Invalid payload';
        emitChatError(socket, 400, msg);
        if (callback) callback({ success: false, message: msg });
        return;
      }

      const { conversationId, messageId } = value;
      const res = await chatService.removeReactionService(conversationId, messageId, user.id);
      if (res && res.removed) {
        io.to(conversationId).emit('reaction:removed', {
          conversationId,
          messageId,
          userId: user.id,
        });
      }

      if (callback) callback({ success: true });
    } catch (err: any) {
      logger.warn(`[Chat Socket] reaction:remove failed for user ${user.id}: ${err.message}`);
      emitChatError(socket, err.statusCode || 400, err.message || 'Failed to remove reaction');
      if (callback) callback({ success: false, message: err.message || 'Failed to remove reaction' });
    }
  });
};
