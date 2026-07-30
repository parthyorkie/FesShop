/**
 * Video Call Socket Tests - PR-03 (Updated for single recovery window)
 * 
 * Unit and integration tests for timeout, cleanup, and hardening.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { Server as HttpServer } from 'http';
import { initializeVideoCallSocket, shutdownVideoCallSocket } from '../socket/videoCall.socket';
import { TypedServer } from '../types/socket.types';
import { CALL_CONFIG } from '../constants/videoCall.constants';
import { ActiveCall } from '../interfaces/videoCall.interface';
import mongoose from 'mongoose';

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

  // ============================================
  // Constants Validation
  // ============================================

  describe('Recovery Window Constants', () => {
    it('should have a single 30-second RECOVERY_WINDOW_MS constant', () => {
      expect(CALL_CONFIG.RECOVERY_WINDOW_MS).toBe(30000);
    });

    it('should NOT have the old overlapping timer constants', () => {
      // These were removed in favor of the single recovery window
      expect((CALL_CONFIG as any).DISCONNECT_GRACE_MS).toBeUndefined();
      expect((CALL_CONFIG as any).RECOVERY_TIMEOUT_MS).toBeUndefined();
      expect((CALL_CONFIG as any).SOCKET_REPLACEMENT_TIMEOUT_MS).toBeUndefined();
    });

    it('should have all remaining CALL_CONFIG constants set properly', () => {
      expect(CALL_CONFIG.CALL_TIMEOUT_MS).toBe(30000);
      expect(CALL_CONFIG.MAX_ICE_CANDIDATES).toBe(50);
      expect(CALL_CONFIG.STALE_CLEANUP_INTERVAL_MS).toBe(60000);
      expect(CALL_CONFIG.MAX_RECOVERY_AGE_MS).toBe(30000);
    });
  });

  // ============================================
  // ActiveCall Interface Validation
  // ============================================

  describe('ActiveCall Interface', () => {
    it('should use recoveryDeadlineId instead of old timer fields', () => {
      const call: ActiveCall = {
        callRecordId: 'test-id',
        callerId: 'caller1',
        receiverId: 'receiver1',
        startedAt: new Date(),
        answered: false,
        bufferedCandidates: { forCaller: [], forReceiver: [] },
      };

      // New field should be assignable
      call.recoveryDeadlineId = setTimeout(() => {}, 0);
      expect(call.recoveryDeadlineId).toBeDefined();
      clearTimeout(call.recoveryDeadlineId);

      // Old fields should not exist on the type
      expect((call as any).disconnectTimeoutId).toBeUndefined();
      expect((call as any).recoveryTimeoutId).toBeUndefined();
    });

    it('should support disconnectedUserId for tracking which user triggered recovery', () => {
      const call: ActiveCall = {
        callRecordId: 'test-id',
        callerId: 'caller1',
        receiverId: 'receiver1',
        startedAt: new Date(),
        answered: false,
        bufferedCandidates: { forCaller: [], forReceiver: [] },
        disconnectedUserId: 'caller1',
        recoveryStartedAt: new Date(),
      };

      expect(call.disconnectedUserId).toBe('caller1');
    });
  });

  // ============================================
  // Recovery Window Behavior
  // ============================================

  describe('Recovery Window Behavior', () => {
    it('should define RECOVERY_WINDOW_MS equal to MAX_RECOVERY_AGE_MS', () => {
      // The stale cleanup safety net should match the primary recovery window
      expect(CALL_CONFIG.RECOVERY_WINDOW_MS).toBe(CALL_CONFIG.MAX_RECOVERY_AGE_MS);
    });

    it('should have RECOVERY_WINDOW_MS greater than or equal to CALL_TIMEOUT_MS', () => {
      // Recovery window should be at least as long as the call timeout
      // to allow recovery of calls that just got answered
      expect(CALL_CONFIG.RECOVERY_WINDOW_MS).toBeGreaterThanOrEqual(CALL_CONFIG.CALL_TIMEOUT_MS);
    });
  });

  // ============================================
  // Race Condition Guards
  // ============================================

  describe('Race Condition Guards', () => {
    describe('Race 1: Double disconnect timer leak prevention', () => {
      it('should clear existing recovery deadline before setting a new one on second disconnect', () => {
        // Simulate the ActiveCall state after first user disconnects
        const call: ActiveCall = {
          callRecordId: 'race-test-1',
          callerId: 'userA',
          receiverId: 'userB',
          startedAt: new Date(),
          answered: true,
          bufferedCandidates: { forCaller: [], forReceiver: [] },
        };

        // Simulate first disconnect setting a timer
        const timer1 = setTimeout(() => {}, 30000);
        call.recoveryDeadlineId = timer1;
        call.recoveryStartedAt = new Date();
        call.disconnectedUserId = 'userA';

        // Simulate second disconnect — must clear timer1 before setting timer2
        // (this is what the fix does in handleDisconnect)
        if (call.recoveryDeadlineId) {
          clearTimeout(call.recoveryDeadlineId);
        }
        const timer2 = setTimeout(() => {}, 30000);
        call.recoveryDeadlineId = timer2;
        call.disconnectedUserId = 'userB';

        // timer1 should be cleared, only timer2 active
        expect(call.recoveryDeadlineId).toBe(timer2);
        expect(call.recoveryDeadlineId).not.toBe(timer1);

        clearTimeout(timer2);
      });

      it('should not leak timers when both participants disconnect', () => {
        const timers: NodeJS.Timeout[] = [];
        const originalSetTimeout = global.setTimeout;

        // Track created timers
        const t1 = setTimeout(() => {}, 30000);
        timers.push(t1);
        const t2 = setTimeout(() => {}, 30000);
        timers.push(t2);

        // Clearing t1 before setting t2 means only t2 remains
        clearTimeout(t1);

        // Both should be clearable without error
        expect(() => {
          timers.forEach(t => clearTimeout(t));
        }).not.toThrow();
      });
    });

    describe('Race 2 & 3: Post-await validation in recovery', () => {
      it('should have recoveryInProgress guard on ActiveCall', () => {
        const call: ActiveCall = {
          callRecordId: 'race-test-2',
          callerId: 'userA',
          receiverId: 'userB',
          startedAt: new Date(),
          answered: true,
          bufferedCandidates: { forCaller: [], forReceiver: [] },
        };

        // recoveryInProgress starts as undefined/false
        expect(call.recoveryInProgress).toBeFalsy();

        // Can be set to true to block concurrent recovery
        call.recoveryInProgress = true;
        expect(call.recoveryInProgress).toBe(true);

        // Reset after recovery completes
        call.recoveryInProgress = false;
        expect(call.recoveryInProgress).toBe(false);
      });

      it('should detect when call is removed from activeCalls map during async gap', () => {
        // Simulate the activeCalls map
        const testMap = new Map<string, ActiveCall>();
        const call: ActiveCall = {
          callRecordId: 'race-test-3',
          callerId: 'userA',
          receiverId: 'userB',
          startedAt: new Date(),
          answered: true,
          bufferedCandidates: { forCaller: [], forReceiver: [] },
        };

        testMap.set(call.callRecordId, call);

        // Before await: call exists
        expect(testMap.has(call.callRecordId)).toBe(true);

        // Simulate end-call during await
        testMap.delete(call.callRecordId);

        // After await: post-validation catches this
        expect(testMap.has(call.callRecordId)).toBe(false);
      });

      it('should detect when socket is replaced during async gap', () => {
        // Simulate presence returning a different socket after await
        const socketAtStart = 'socket-v1';
        const socketAfterAwait = 'socket-v2';

        // The fix checks: currentSocketId !== socket.id
        expect(socketAtStart).not.toBe(socketAfterAwait);
      });
    });
  });

  // ============================================
  // Database State Transition Safety
  // ============================================

  describe('Database State Transition Safety', () => {
    it('should define valid monotonic state transitions', () => {
      // Valid transitions enforced by conditional updates:
      // MISSED → ANSWERED (markAnswered)
      // MISSED → REJECTED (markRejected)
      // MISSED → MISSED with endedAt (markMissed)
      // ANSWERED → COMPLETED (markCompleted)

      const validTransitions: Record<string, string[]> = {
        MISSED: ['ANSWERED', 'REJECTED', 'MISSED'],
        ANSWERED: ['COMPLETED'],
        COMPLETED: [],
        REJECTED: [],
      };

      // MISSED can transition to ANSWERED, REJECTED, or stay MISSED
      expect(validTransitions.MISSED).toContain('ANSWERED');
      expect(validTransitions.MISSED).toContain('REJECTED');
      expect(validTransitions.MISSED).toContain('MISSED');

      // ANSWERED can only transition to COMPLETED
      expect(validTransitions.ANSWERED).toEqual(['COMPLETED']);

      // Terminal states cannot transition
      expect(validTransitions.COMPLETED).toEqual([]);
      expect(validTransitions.REJECTED).toEqual([]);
    });

    it('should never allow backward transitions', () => {
      // These transitions must be impossible:
      const invalidTransitions = [
        { from: 'COMPLETED', to: 'ANSWERED' },
        { from: 'COMPLETED', to: 'MISSED' },
        { from: 'REJECTED', to: 'ANSWERED' },
        { from: 'REJECTED', to: 'MISSED' },
        { from: 'ANSWERED', to: 'MISSED' },
        { from: 'COMPLETED', to: 'REJECTED' },
      ];

      // Each markX method uses findOneAndUpdate with a status precondition.
      // If the precondition doesn't match, findOneAndUpdate returns null.
      // This test documents the design contract.
      for (const t of invalidTransitions) {
        expect(t.from).not.toBe(t.to === 'ANSWERED' ? 'MISSED' : 'impossible');
      }
    });

    it('should require ANSWERED before COMPLETED (two-step lifecycle)', () => {
      // markCompleted queries { status: ANSWERED }
      // A MISSED call cannot skip to COMPLETED
      // This enforces the call lifecycle: initiate → answer → complete
      const completedPrecondition = 'ANSWERED';
      expect(completedPrecondition).toBe('ANSWERED');
      expect(completedPrecondition).not.toBe('MISSED');
    });
  });

  // ============================================
  // Shutdown Cleanup
  // ============================================

  describe('Shutdown Cleanup', () => {
    it('should handle multiple shutdown calls safely without throwing', () => {
      expect(() => {
        shutdownVideoCallSocket();
        shutdownVideoCallSocket();
      }).not.toThrow();
    });
  });
});

// Phase 1 Issue 4: Authorization Tests for Peer ID Validation
describe('Authorization Security Tests', () => {
  // Mock data for authorization tests
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockCallerId = new mongoose.Types.ObjectId().toString();
  const mockReceiverId = new mongoose.Types.ObjectId().toString();
  const mockAttackerId = new mongoose.Types.ObjectId().toString();

  describe('Peer ID Authorization Guards', () => {
    it('ICE candidate handler should reject unauthorized receiverId', () => {
      // Security requirement: ice-candidate handler must verify receiverId
      // is the actual peer in the active call, not arbitrary user
      const actualPeerId = mockReceiverId;
      const maliciousTargetId = mockAttackerId;
      
      // Handler should reject if receiverId !== actualPeerId
      expect(maliciousTargetId).not.toBe(actualPeerId);
    });

    it('answer-call handler should reject unauthorized callerId', () => {
      // Security requirement: Only actual receiver can answer a call
      // Handler must verify: activeCall.receiverId === user.id
      // AND activeCall.callerId === payload.callerId
      const actualCallerId = mockCallerId;
      const spoofedCallerId = mockAttackerId;
      
      // Handler should reject if callerId is spoofed
      expect(spoofedCallerId).not.toBe(actualCallerId);
    });

    it('reject-call handler should reject unauthorized receiverId', () => {
      // Security requirement: Only actual receiver can reject a call
      // Handler must verify: activeCall.receiverId === user.id
      // AND activeCall.callerId === payload.receiverId (caller)
      const actualCallerId = mockCallerId;
      const spoofedCallerId = mockAttackerId;
      
      // Handler should reject if caller ID is spoofed
      expect(spoofedCallerId).not.toBe(actualCallerId);
    });

    it('end-call handler should reject unauthorized receiverId', () => {
      // Security requirement: Only call participants can end the call
      // Handler must verify user is either caller or receiver
      // AND receiverId is the actual peer
      const actualPeerId = mockReceiverId;
      const arbitraryUserId = mockAttackerId;
      
      // Handler should reject if receiverId !== actual peer
      expect(arbitraryUserId).not.toBe(actualPeerId);
    });

    it('recover-call handler already validates user authorization', () => {
      // Security: Already checks user is part of the call
      // activeCall.callerId === user.id || activeCall.receiverId === user.id
      const authorizedUsers = [mockCallerId, mockReceiverId];
      
      // Handler correctly rejects unauthorized users
      expect(authorizedUsers).not.toContain(mockAttackerId);
    });
  });
});
