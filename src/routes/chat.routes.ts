import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createConversationSchema,
  getConversationsSchema,
  getConversationSchema,
  getMessagesSchema,
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

export default router;
