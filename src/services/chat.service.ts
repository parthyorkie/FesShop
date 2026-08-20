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
import { v4 as uuidv4 } from 'uuid';
import { s3Client, S3_BUCKET } from '../config/s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

export const sendVoiceMessage = async (
  conversationId: string,
  senderId: string,
  clientMessageId: string,
  voiceMeta: { url: string; duration: number; mimeType: string; size: number }
): Promise<IMessage> => {
  await validateConversationMembership(conversationId, senderId);

  try {

    console.log("voiceMeta : ", voiceMeta);
    const existingMessage = await findMessageByClientMessageId(clientMessageId, senderId);
    if (existingMessage) {
      return existingMessage;
    }

    const message = await createMessage({
      conversationId: conversationId as any,
      senderId: senderId as any,
      clientMessageId,
      type: 'voice',
      voice: {
        url: voiceMeta.url,
        mimeType: voiceMeta.mimeType,
        duration: voiceMeta.duration,
        size: voiceMeta.size,
      },
    });

    await updateConversationLastMessage(conversationId, (message as any)._id.toString(), message.createdAt);
    return message;
  } catch (error: any) {
    if (error.code === 11000) {
      const existingMessage = await findMessageByClientMessageId(clientMessageId, senderId);
      if (existingMessage) {
        return existingMessage;
      }
    }
    throw error;
  }
};

// export const generatePresignedUrl = async (
//   conversationId: string,
//   userId: string,
//   mimeType: string,
//   size: number,
//   keyPrefix?: string
// ): Promise<{ uploadUrl: string; key: string }> => {
//   // Use a stable auth-derived prefix for object keys when supplied so the media path
//   // does not expose the raw database user id while still validating with the real ID.
//   const ext = mimeType.split('/').pop();
//   const prefix = keyPrefix || userId;
//   const key = `chat/voice/${prefix}/${conversationId}/${uuidv4()}.${ext}`;
//   const uploadUrl = `https://dummy.s3.amazonaws.com/${key}`;
//   return { uploadUrl, key };
// };

export const generatePresignedUrl = async (
  conversationId: string,
  userId: string,
  mimeType: string,
  size: number,
  keyPrefix?: string
): Promise<{ uploadUrl: string; key: string }> => {
  const ext = mimeType.split('/').pop();

  const prefix = keyPrefix || userId;

  const key = `chat/voice/${prefix}/${conversationId}/${uuidv4()}.${ext}`;

  console.log(`Generating presigned URL for key: ${key}`);
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET!,
    Key: key,
    ContentType: mimeType,
    // ContentLength: size,
  });

  console.log(`Command for presigned URL: ${JSON.stringify(command)}`);

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 900, // 15 minutes
  });

  getPlaybackUrl(key).then((res) => {
    console.log(`Playback URL for key ${key}: ${res.playbackUrl}`);
  }).catch((err) => {
    console.error(`Error generating playback URL for key ${key}:`, err);
  });
  return {
    uploadUrl,
    key,
  };
};


export const getPlaybackUrl = async (
  keyPrefix?: string
): Promise<{ playbackUrl: string }> => {

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET!,
    Key: keyPrefix,

  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 7200, // 2 hours
  });

  console.log(`Playback presigned URL: ${uploadUrl}`);

  return {
    playbackUrl: uploadUrl,
  };
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
