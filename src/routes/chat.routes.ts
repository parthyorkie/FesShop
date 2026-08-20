import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createConversationSchema,
  getConversationsSchema,
  getConversationSchema,
  getMessagesSchema,
  presignedUrlSchema,
} from '../validations/chat.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/conversations',
  validate(createConversationSchema),
  chatController.createConversation
);

router.get(
  '/conversations',
  validate(getConversationsSchema),
  chatController.getConversations
);

router.get(
  '/conversations/:conversationId',
  validate(getConversationSchema),
  chatController.getConversationById
);

router.get(
  '/conversations/:conversationId/messages',
  validate(getMessagesSchema),
  chatController.getMessageHistory
);

// Generate presigned URL for voice upload
router.post(
  '/media/presigned-url',
  validate(presignedUrlSchema),
  chatController.createPresignedUrlHandler
);

router.post(
  '/media/playback-url',
  chatController.getPlaybackUrlHandler
);

export default router;
