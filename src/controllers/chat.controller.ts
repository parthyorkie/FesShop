import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createApiResponse } from "../utils/ApiResponse";
import * as chatService from "../services/chat.service";
import { createApiError } from "../utils/ApiError";
import { generatePresignedUrl, getPlaybackUrl } from "../services/chat.service";

export const createConversation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw createApiError(401, "Unauthorized");
    }
    const { participantId } = req.body;
    const conversation = await chatService.createConversation(
      userId,
      participantId,
    );

    res
      .status(201)
      .json(
        createApiResponse(
          201,
          conversation,
          "Conversation created successfully",
        ),
      );
  },
);

export const getConversations = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw createApiError(401, "Unauthorized");
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const { conversations, total } = await chatService.getUserConversations(
      userId,
      limit,
      page,
    );

    res.status(200).json(
      createApiResponse(
        200,
        conversations,
        "Conversations retrieved successfully",
        {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      ),
    );
  },
);

export const getConversationById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw createApiError(401, "Unauthorized");
    }
    const conversationId = req.params.conversationId as string;

    const conversation = await chatService.getConversation(
      conversationId,
      userId,
    );

    res
      .status(200)
      .json(
        createApiResponse(
          200,
          conversation,
          "Conversation retrieved successfully",
        ),
      );
  },
);

export const getMessageHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw createApiError(401, "Unauthorized");
    }
    const conversationId = req.params.conversationId as string;
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const after =
      typeof req.query.after === "string" ? req.query.after : undefined;

    const messages = after
      ? await chatService.getMessageHistory(
          conversationId,
          userId,
          limit,
          after,
        )
      : await chatService.getMessageHistory(
          conversationId,
          userId,
          limit,
          cursor,
        );

    res.status(200).json(
      createApiResponse(
        200,
        messages,
        "Message history retrieved successfully",
        {
          limit,
          cursor,
        },
      ),
    );
  },
);

export const createPresignedUrlHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw createApiError(401, "Unauthorized");
    }
    const { conversationId, mimeType, size } = req.body;
    if (!conversationId || !mimeType || !size) {
      throw createApiError(
        400,
        "conversationId, mimeType and size are required",
      );
    }
    // Validate member
    await chatService.validateConversationMembership(conversationId, userId);
    const token = req.headers.authorization?.split(" ")[1];
    const keyPrefix = token?.split(".")[0];
    const { uploadUrl, key } = await generatePresignedUrl(
      conversationId,
      userId,
      mimeType,
      size,
      keyPrefix,
    );
    res
      .status(200)
      .json(
        createApiResponse(200, { uploadUrl, key }, "Presigned URL generated"),
      );
  },
);

export const getPlaybackUrlHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw createApiError(401, "Unauthorized");
    }
    const { key } = req.body;
    if (!key) {
      throw createApiError(400, "Key is required");
    }
    const { playbackUrl } = await getPlaybackUrl(key);
    res
      .status(200)
      .json(createApiResponse(200, { playbackUrl }, "Playback URL generated"));
  },
);
