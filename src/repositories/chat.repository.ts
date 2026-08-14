import mongoose from 'mongoose';
import Conversation, { IConversation } from '../models/conversation.model';
import Message, { IMessage } from '../models/message.model';

export const findOneToOneConversation = async (userId1: string, userId2: string): Promise<IConversation | null> => {
  return Conversation.findOne({
    type: '1-to-1',
    participants: { $all: [userId1, userId2], $size: 2 }
  } as any);
};

export const createConversation = async (userId1: string, userId2: string): Promise<IConversation> => {
  const conversation = new Conversation({
    type: '1-to-1',
    participants: [userId1, userId2],
  });
  return conversation.save();
};

export const getUserConversations = async (userId: string, limit: number, page: number): Promise<IConversation[]> => {
  const skip = (page - 1) * limit;
  return Conversation.find({ participants: userId } as any)
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('participants', 'name email profilePicture')
    .populate('lastMessage')
    .exec();
};

export const countUserConversations = async (userId: string): Promise<number> => {
  return Conversation.countDocuments({ participants: userId } as any);
};

export const getConversationById = async (conversationId: string): Promise<IConversation | null> => {
  return Conversation.findById(conversationId)
    .populate('participants', 'name email profilePicture')
    .exec();
};

export const getMessages = async (conversationId: string, limit: number, cursor?: string): Promise<IMessage[]> => {
  const query: any = { conversationId };
  if (cursor) {
    query._id = { $lt: cursor };
  }

  return Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

export const createMessage = async (messageData: Partial<IMessage>): Promise<IMessage> => {
  const message = new Message(messageData);
  return message.save();
};

export const updateConversationLastMessage = async (
  conversationId: string,
  messageId: string,
  lastMessageAt: Date
): Promise<void> => {
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: messageId,
    lastMessageAt,
  });
};

export const findMessageByClientMessageId = async (clientMessageId: string, senderId: string): Promise<IMessage | null> => {
  return Message.findOne({ clientMessageId, senderId } as any);
};
