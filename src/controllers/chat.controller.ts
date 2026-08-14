import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createApiResponse } from '../utils/ApiResponse';
import * as chatService from '../services/chat.service';
import { createApiError } from '../utils/ApiError';

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw createApiError(401, 'Unauthorized');
  }
  const { participantId } = req.body;
  const conversation = await chatService.createConversation(userId, participantId);

  res.status(201).json(createApiResponse(201, conversation, 'Conversation created successfully'));
});

export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw createApiError(401, 'Unauthorized');
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;

  const { conversations, total } = await chatService.getUserConversations(userId, limit, page);

  res.status(200).json(
    createApiResponse(200, conversations, 'Conversations retrieved successfully', {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  );
});

export const getConversationById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw createApiError(401, 'Unauthorized');
  }
  const conversationId = req.params.conversationId as string;

  const conversation = await chatService.getConversation(conversationId, userId);

  res.status(200).json(createApiResponse(200, conversation, 'Conversation retrieved successfully'));
});

export const getMessageHistory = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw createApiError(401, 'Unauthorized');
  }
  const conversationId = req.params.conversationId as string;
  const limit = parseInt(req.query.limit as string, 10) || 30;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const messages = await chatService.getMessageHistory(conversationId, userId, limit, cursor);

  res.status(200).json(
    createApiResponse(200, messages, 'Message history retrieved successfully', {
      limit,
      cursor,
    })
  );
});
