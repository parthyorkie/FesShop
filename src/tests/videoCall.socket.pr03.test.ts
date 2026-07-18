/**
 * Video Call Socket Tests - PR-03
 * 
 * Unit and integration tests for timeout, cleanup, and hardening.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { Server as HttpServer } from 'http';
import { initializeVideoCallSocket, shutdownVideoCallSocket } from '../socket/videoCall.socket';
import { TypedServer } from '../types/socket.types';
import { CALL_CONFIG } from '../constants/videoCall.constants';

// Mock dependencies
jest.mock('../middlewares/socketAuth.middleware', () => ({
  socketAuthMiddleware: jest.fn<any>((socket: any, next: any) => next()),
  getSocketUser: jest.fn<any>(() => ({ id: 'user1', name: 'User One', email: 'u1@test.com' }))
}));
jest.mock('../services/presence.service');
jest.mock('../services/videoCall.service');
jest.mock('../services/oneSignal.service');
jest.mock('../models/User', () => ({
  findById: jest.fn<any>().mockResolvedValue({ _id: 'user2', name: 'User Two', email: 'u2@test.com', isDeleted: false } as any)
}));
jest.mock('../utils/videoCall.logger');

describe('Video Call Socket - PR-03: Timeout, Cleanup, Hardening', () => {
  let httpServer: HttpServer;
  let io: TypedServer;

  beforeAll((done) => {
    httpServer = new HttpServer();
    io = initializeVideoCallSocket(httpServer, '*');
    httpServer.listen(() => done());
  });

  afterAll((done) => {
    shutdownVideoCallSocket();
    io.close();
    httpServer.close(() => done());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Hardening', () => {
    it('should have CALL_CONFIG constants set properly', () => {
      expect(CALL_CONFIG.RECOVERY_TIMEOUT_MS).toBeDefined();
      expect(CALL_CONFIG.CALL_TIMEOUT_MS).toBeDefined();
      expect(CALL_CONFIG.MAX_ICE_CANDIDATES).toBeDefined();
      expect(CALL_CONFIG.DISCONNECT_GRACE_MS).toBeDefined();
      expect(CALL_CONFIG.STALE_CLEANUP_INTERVAL_MS).toBeDefined();
    });
  });

  describe('Shutdown Cleanup', () => {
    it('should handle multiple shutdown calls safely without throwing', () => {
      expect(() => {
        shutdownVideoCallSocket();
        shutdownVideoCallSocket();
      }).not.toThrow();
    });
  });
});
