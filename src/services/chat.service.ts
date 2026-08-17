import { createApiError } from '../utils/ApiError';
import {
  findOneToOneConversation,
  createConversation as createConversationRepo,
  getUserConversations as getUserConversationsRepo,
  countUserConversations,
  getConversationById,
  getMessages,
  createMessage,
  updateConversationLastMessage,
  findMessageByClientMessageId
} from '../repositories/chat.repository';
import { findUserById } from '../repositories/user.repository';
import { IConversation } from '../models/conversation.model';
import { IMessage } from '../models/message.model';
import { logger } from '../utils/logger';
import {
  getMessageById,
  updateMessageStatusIfChanged,
  addOrUpdateReaction,
  removeReaction,
} from '../repositories/chat.repository';

export const createConversation = async (userId: string, participantId: string): Promise<IConversation> => {
  if (userId === participantId) {
    throw createApiError(400, 'Cannot create a conversation with yourself');
  }

  const participant = await findUserById(participantId);
  if (!participant) {
    throw createApiError(404, 'Participant not found');
  }

  const existingConversation = await findOneToOneConversation(userId, participantId);
  if (existingConversation) {
    return existingConversation;
  }

  return createConversationRepo(userId, participantId);
};

export const getUserConversations = async (userId: string, limit: number, page: number) => {
  const conversations = await getUserConversationsRepo(userId, limit, page);
  const total = await countUserConversations(userId);
  return { conversations, total };
};

export const validateConversationMembership = async (conversationId: string, userId: string): Promise<IConversation> => {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    throw createApiError(404, 'Conversation not found');
  }

  const isParticipant = conversation.participants.some((p: any) => {
    const pId = typeof p === 'string' ? p : p?._id ? p._id.toString() : p?.toString();
    return pId === userId;
  });

  if (!isParticipant) {
    throw createApiError(403, 'You are not a participant in this conversation');
  }

  return conversation;
};

export const getConversation = async (conversationId: string, userId: string): Promise<IConversation> => {
  return validateConversationMembership(conversationId, userId);
};

export const getMessageHistory = async (conversationId: string, userId: string, limit: number, cursor?: string): Promise<IMessage[]> => {
  await validateConversationMembership(conversationId, userId);
  return getMessages(conversationId, limit, cursor);
};

export const sendTextMessage = async (
  conversationId: string,
  senderId: string,
  clientMessageId: string,
  text: string
): Promise<IMessage> => {
  if (!text || text.trim() === '') {
    throw createApiError(400, 'Message text cannot be empty');
  }
  if (text.length > 2000) {
    throw createApiError(400, 'Message text exceeds 2000 characters limit');
  }

  await validateConversationMembership(conversationId, senderId);

  try {
    const existingMessage = await findMessageByClientMessageId(clientMessageId, senderId);
    if (existingMessage) {
      return existingMessage;
    }

    const message = await createMessage({
      conversationId: conversationId as any,
      senderId: senderId as any,
      clientMessageId,
      type: 'text',
      text,
      status: 'sent',
    });

    await updateConversationLastMessage(conversationId, (message as any)._id.toString(), message.createdAt);

    return message;
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key error from MongoDB, highly concurrent requests
      const existingMessage = await findMessageByClientMessageId(clientMessageId, senderId);
      if (existingMessage) {
        return existingMessage;
      }
    }
    throw error;
  }
};

export const markMessageDelivered = async (conversationId: string, messageId: string, userId: string) => {
  // Validate membership
  await validateConversationMembership(conversationId, userId);

  const message = await getMessageById(messageId);
  if (!message) throw createApiError(404, 'Message not found');

  if (message.conversationId.toString() !== conversationId) {
    throw createApiError(400, 'Message does not belong to the conversation');
  }

  // Only recipients (not the sender) can mark delivered
  if (message.senderId.toString() === userId) {
    throw createApiError(403, 'Sender cannot mark their own message as delivered');
  }

  const changed = await updateMessageStatusIfChanged(messageId, conversationId, 'delivered');
  return { changed, message };
};

export const markMessageRead = async (conversationId: string, messageId: string, userId: string) => {
  await validateConversationMembership(conversationId, userId);

  const message = await getMessageById(messageId);
  if (!message) throw createApiError(404, 'Message not found');

  if (message.conversationId.toString() !== conversationId) {
    throw createApiError(400, 'Message does not belong to the conversation');
  }

  if (message.senderId.toString() === userId) {
    throw createApiError(403, 'Sender cannot mark their own message as read');
  }

  const changed = await updateMessageStatusIfChanged(messageId, conversationId, 'read');
  return { changed, message };
};

export const addReaction = async (conversationId: string, messageId: string, userId: string, emoji: string) => {
  await validateConversationMembership(conversationId, userId);

  const message = await getMessageById(messageId);
  if (!message) throw createApiError(404, 'Message not found');
  if (message.conversationId.toString() !== conversationId) {
    throw createApiError(400, 'Message does not belong to the conversation');
  }

  // Add or update reaction
  const res = await addOrUpdateReaction(messageId, userId, emoji);
  if (!res) throw createApiError(500, 'Failed to add reaction');
  return res;
};

export const removeReactionService = async (conversationId: string, messageId: string, userId: string) => {
  await validateConversationMembership(conversationId, userId);

  const message = await getMessageById(messageId);
  if (!message) throw createApiError(404, 'Message not found');
  if (message.conversationId.toString() !== conversationId) {
    throw createApiError(400, 'Message does not belong to the conversation');
  }

  const removed = await removeReaction(messageId, userId);
  return { removed };
};
