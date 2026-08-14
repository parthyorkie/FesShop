import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import chatRoutes from '../routes/chat.routes';
import { initializeSocket } from '../services/socket.service';
import { errorHandler } from '../middlewares/error.middleware';
import { generateAccessToken } from '../utils/jwt';
import * as chatRepository from '../repositories/chat.repository';
import * as userRepository from '../repositories/user.repository';
import User from '../models/User';

// Set env secret for testing
process.env.JWT_ACCESS_SECRET = 'testsecret';
process.env.JWT_REFRESH_SECRET = 'testsecret';

// Mock IDs
const USER_A_ID = '60c72b2f9b1d8b2b9c8b4567';
const USER_B_ID = '60c72b2f9b1d8b2b9c8b4568';
const USER_C_ID = '60c72b2f9b1d8b2b9c8b4569';
const CONVERSATION_1_ID = '60c72b2f9b1d8b2b9c8b4570';
const CONVERSATION_2_ID = '60c72b2f9b1d8b2b9c8b4571';
const MESSAGE_1_ID = '60c72b2f9b1d8b2b9c8b4580';
const MESSAGE_2_ID = '60c72b2f9b1d8b2b9c8b4581';

// Tokens
const tokenUserA = generateAccessToken(USER_A_ID);
const tokenUserB = generateAccessToken(USER_B_ID);
const tokenUserC = generateAccessToken(USER_C_ID);

describe('Chat Module Day 1 Integration Tests', () => {
  let app: express.Application;
  let httpServer: HttpServer;
  let serverAddress: string;
  let port: number;

  // In-memory data store for mocks
  let conversations: any[] = [];
  let messages: any[] = [];
  const users: Record<string, any> = {
    [USER_A_ID]: { _id: USER_A_ID, name: 'User A', email: 'usera@test.com', isDeleted: false },
    [USER_B_ID]: { _id: USER_B_ID, name: 'User B', email: 'userb@test.com', isDeleted: false },
    [USER_C_ID]: { _id: USER_C_ID, name: 'User C', email: 'userc@test.com', isDeleted: false },
  };

  beforeAll((done) => {
    // Setup Express app & Server
    app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
    app.use(errorHandler);

    httpServer = createServer(app);
    initializeSocket(httpServer, '*');

    httpServer.listen(0, () => {
      const addr = httpServer.address() as any;
      port = addr.port;
      serverAddress = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(() => done());
  });

  beforeEach(() => {
    conversations = [
      {
        _id: CONVERSATION_1_ID,
        type: '1-to-1',
        participants: [USER_A_ID, USER_B_ID],
        lastMessage: MESSAGE_1_ID,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    messages = [
      {
        _id: MESSAGE_1_ID,
        conversationId: CONVERSATION_1_ID,
        senderId: USER_A_ID,
        clientMessageId: 'client-msg-1',
        type: 'text',
        text: 'Hello User B',
        status: 'sent',
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(Date.now() - 1000),
      },
    ];

    // Mock Repository Functions
    jest.spyOn(userRepository, 'findUserById').mockImplementation(async (id: string) => {
      return users[id] || null;
    });

    jest.spyOn(User, 'findById').mockImplementation((id: any) => {
      const u = users[id.toString()];
      return {
        select: (jest.fn() as any).mockResolvedValue(u || null),
      } as any;
    });

    jest.spyOn(chatRepository, 'findOneToOneConversation').mockImplementation(async (u1: string, u2: string) => {
      return conversations.find(
        (c) =>
          c.type === '1-to-1' &&
          c.participants.includes(u1) &&
          c.participants.includes(u2)
      ) || null;
    });

    jest.spyOn(chatRepository, 'createConversation').mockImplementation(async (u1: string, u2: string) => {
      const newConv = {
        _id: CONVERSATION_2_ID,
        type: '1-to-1',
        participants: [u1, u2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.push(newConv);
      return newConv as any;
    });

    jest.spyOn(chatRepository, 'getUserConversations').mockImplementation(async (userId: string, limit: number, page: number) => {
      return conversations.filter((c) => c.participants.includes(userId));
    });

    jest.spyOn(chatRepository, 'countUserConversations').mockImplementation(async (userId: string) => {
      return conversations.filter((c) => c.participants.includes(userId)).length;
    });

    jest.spyOn(chatRepository, 'getConversationById').mockImplementation(async (id: string) => {
      return conversations.find((c) => c._id.toString() === id.toString()) || null;
    });

    jest.spyOn(chatRepository, 'getMessages').mockImplementation(async (convId: string, limit: number, cursor?: string) => {
      let filtered = messages.filter((m) => m.conversationId.toString() === convId.toString());
      if (cursor) {
        filtered = filtered.filter((m) => m._id.toString() < cursor);
      }
      return filtered.slice(0, limit);
    });

    jest.spyOn(chatRepository, 'findMessageByClientMessageId').mockImplementation(async (clientMsgId: string, senderId: string) => {
      return messages.find((m) => m.clientMessageId === clientMsgId && m.senderId === senderId) || null;
    });

    jest.spyOn(chatRepository, 'createMessage').mockImplementation(async (msgData: any) => {
      const newMsg = {
        _id: MESSAGE_2_ID,
        ...msgData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      messages.push(newMsg);
      return newMsg as any;
    });

    jest.spyOn(chatRepository, 'updateConversationLastMessage').mockImplementation(async (convId: string, msgId: string, lastMessageAt: Date) => {
      const conv = conversations.find((c) => c._id.toString() === convId.toString());
      if (conv) {
        conv.lastMessage = msgId;
        conv.lastMessageAt = lastMessageAt;
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================================================
  // REST API TESTS
  // ==========================================================================
  describe('REST APIs', () => {
    it('POST /api/chat/conversations - Create new conversation successfully', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ participantId: USER_C_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.participants).toContain(USER_A_ID);
      expect(res.body.data.participants).toContain(USER_C_ID);
    });

    it('POST /api/chat/conversations - Return existing duplicate conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ participantId: USER_B_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(CONVERSATION_1_ID);
    });

    it('POST /api/chat/conversations - Reject self-conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ participantId: USER_A_ID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cannot create a conversation with yourself');
    });

    it('POST /api/chat/conversations - Reject invalid participantId format', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ participantId: 'invalid-id' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/chat/conversations - Get user conversations', async () => {
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/chat/conversations/:conversationId - Get conversation details for participant', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_1_ID}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(CONVERSATION_1_ID);
    });

    it('GET /api/chat/conversations/:conversationId - Reject unauthorized non-participant', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_1_ID}`)
        .set('Authorization', `Bearer ${tokenUserC}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('You are not a participant');
    });

    it('GET /api/chat/conversations/:conversationId/messages - Get message history', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_1_ID}/messages`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].text).toBe('Hello User B');
    });

    it('GET /api/chat/conversations/:conversationId/messages - Cursor pagination', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_1_ID}/messages?cursor=${MESSAGE_2_ID}&limit=10`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // SOCKET.IO TESTS
  // ==========================================================================
  describe('Socket.IO Events', () => {
    let clientSocketA: ClientSocket;
    let clientSocketB: ClientSocket;

    afterEach((done) => {
      if (clientSocketA && clientSocketA.connected) {
        clientSocketA.disconnect();
      }
      if (clientSocketB && clientSocketB.connected) {
        clientSocketB.disconnect();
      }
      done();
    });

    it('Socket Connection - Valid JWT connection succeeds', (done) => {
      clientSocketA = Client(serverAddress, {
        auth: { token: tokenUserA },
        transports: ['websocket'],
      });

      clientSocketA.on('connect', () => {
        expect(clientSocketA.connected).toBe(true);
        done();
      });
    });

    it('Socket Connection - Missing JWT rejected', (done) => {
      const client = Client(serverAddress, {
        transports: ['websocket'],
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication required');
        client.disconnect();
        done();
      });
    });

    it('Socket Connection - Invalid JWT rejected', (done) => {
      const client = Client(serverAddress, {
        auth: { token: 'invalid-jwt-token' },
        transports: ['websocket'],
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication failed');
        client.disconnect();
        done();
      });
    });

    it('chat:join - Join authorized conversation room', (done) => {
      clientSocketA = Client(serverAddress, {
        auth: { token: tokenUserA },
        transports: ['websocket'],
      });

      clientSocketA.on('connect', () => {
        clientSocketA.emit('chat:join', { conversationId: CONVERSATION_1_ID }, (response: any) => {
          expect(response.success).toBe(true);
          done();
        });
      });
    });

    it('chat:join - Reject unauthorized room join', (done) => {
      const clientC = Client(serverAddress, {
        auth: { token: tokenUserC },
        transports: ['websocket'],
      });

      clientC.on('connect', () => {
        clientC.on('chat:error', (error: any) => {
          expect(error.message).toContain('You are not a participant');
          clientC.disconnect();
          done();
        });

        clientC.emit('chat:join', { conversationId: CONVERSATION_1_ID });
      });
    });

    it('chat:leave - Leave conversation room successfully', (done) => {
      clientSocketA = Client(serverAddress, {
        auth: { token: tokenUserA },
        transports: ['websocket'],
      });

      clientSocketA.on('connect', () => {
        clientSocketA.emit('chat:join', { conversationId: CONVERSATION_1_ID }, () => {
          clientSocketA.emit('chat:leave', { conversationId: CONVERSATION_1_ID }, (response: any) => {
            expect(response.success).toBe(true);
            done();
          });
        });
      });
    });

    it('message:send & message:new - Send message & broadcast to room participant', (done) => {
      clientSocketA = Client(serverAddress, {
        auth: { token: tokenUserA },
        transports: ['websocket'],
      });

      clientSocketB = Client(serverAddress, {
        auth: { token: tokenUserB },
        transports: ['websocket'],
      });

      let connectedCount = 0;
      const onConnect = () => {
        connectedCount++;
        if (connectedCount === 2) {
          // User B joins room first to listen
          clientSocketB.emit('chat:join', { conversationId: CONVERSATION_1_ID }, () => {
            clientSocketB.on('message:new', (msgPayload: any) => {
              expect(msgPayload.conversationId).toBe(CONVERSATION_1_ID);
              expect(msgPayload.senderId).toBe(USER_A_ID);
              expect(msgPayload.text).toBe('Hey User B from Socket');
              expect(msgPayload.status).toBe('sent');
              expect(msgPayload.messageId).toBeDefined();
              done();
            });

            // User A joins room and sends message
            clientSocketA.emit('chat:join', { conversationId: CONVERSATION_1_ID }, () => {
              clientSocketA.emit('message:send', {
                conversationId: CONVERSATION_1_ID,
                clientMessageId: 'socket-client-msg-1',
                type: 'text',
                text: 'Hey User B from Socket',
              });
            });
          });
        }
      };

      clientSocketA.on('connect', onConnect);
      clientSocketB.on('connect', onConnect);
    });

    it('message:send - Reject invalid payload (empty text)', (done) => {
      clientSocketA = Client(serverAddress, {
        auth: { token: tokenUserA },
        transports: ['websocket'],
      });

      clientSocketA.on('connect', () => {
        clientSocketA.on('chat:error', (error: any) => {
          expect(error.code).toBe(400);
          done();
        });

        clientSocketA.emit('message:send', {
          conversationId: CONVERSATION_1_ID,
          clientMessageId: 'socket-client-msg-invalid',
          type: 'text',
          text: '',
        });
      });
    });

    it('message:send - Reject unauthorized message sending', (done) => {
      const clientC = Client(serverAddress, {
        auth: { token: tokenUserC },
        transports: ['websocket'],
      });

      clientC.on('connect', () => {
        clientC.on('chat:error', (error: any) => {
          expect(error.message).toContain('You are not a participant');
          clientC.disconnect();
          done();
        });

        clientC.emit('message:send', {
          conversationId: CONVERSATION_1_ID,
          clientMessageId: 'socket-client-msg-unauth',
          type: 'text',
          text: 'Unauthorized text message',
        });
      });
    });

    it('message:send - Duplicate clientMessageId handling', (done) => {
      clientSocketA = Client(serverAddress, {
        auth: { token: tokenUserA },
        transports: ['websocket'],
      });

      clientSocketA.on('connect', () => {
        clientSocketA.emit('chat:join', { conversationId: CONVERSATION_1_ID }, () => {
          // First send
          clientSocketA.emit('message:send', {
            conversationId: CONVERSATION_1_ID,
            clientMessageId: 'client-msg-1', // Pre-existing in mock
            type: 'text',
            text: 'Duplicate text attempt',
          }, (res: any) => {
            expect(res.success).toBe(true);
            done();
          });
        });
      });
    });
  });
});
