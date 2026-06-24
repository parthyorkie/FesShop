/**
 * Video Call Service
 * 
 * Handles call history persistence and call state management.
 * Provides CRUD operations for call records.
 */

import { Types } from 'mongoose';
import CallHistory from '../models/callHistory.model';
import { ICallHistory, ICallHistoryCreate } from '../interfaces/videoCall.interface';
import { CALL_STATUS, CallStatus } from '../constants/videoCall.constants';
import { createApiError } from '../utils/ApiError';
import { 
  logCallRecordCreated, 
  logCallRecordUpdated, 
  logDbError 
} from '../utils/videoCall.logger';
import { getPaginationOptions, formatPaginationData } from '../utils/pagination';

// ============================================
// Call Record CRUD Operations
// ============================================

/**
 * Create a new call record when call is initiated
 * Initial status is MISSED (updated when answered/rejected/completed)
 */
export const createCallRecord = async (
  data: ICallHistoryCreate
): Promise<ICallHistory> => {
  try {
    const callRecord = new CallHistory({
      callerId: new Types.ObjectId(data.callerId),
      receiverId: new Types.ObjectId(data.receiverId),
      status: CALL_STATUS.MISSED,
      startedAt: new Date(),
    });

    await callRecord.save();
    
    logCallRecordCreated(callRecord._id.toString());
    
    return callRecord;
  } catch (error: any) {
    logDbError('createCallRecord', error.message, {
      userId: data.callerId,
      targetUserId: data.receiverId,
    });
    throw createApiError(500, 'Failed to create call record');
  }
};

/**
 * Mark call as answered
 * Sets answeredAt timestamp and status
 */
export const markAnswered = async (callId: string): Promise<ICallHistory | null> => {
  try {
    const callRecord = await CallHistory.findByIdAndUpdate(
      callId,
      {
        status: CALL_STATUS.ANSWERED,
        answeredAt: new Date(),
      },
      { returnDocument: 'after' }
    );

    if (callRecord) {
      logCallRecordUpdated(callId, CALL_STATUS.ANSWERED);
    }

    return callRecord;
  } catch (error: any) {
    logDbError('markAnswered', error.message, { callRecordId: callId });
    throw createApiError(500, 'Failed to update call record');
  }
};

/**
 * Mark call as rejected
 */
export const markRejected = async (callId: string): Promise<ICallHistory | null> => {
  try {
    const callRecord = await CallHistory.findByIdAndUpdate(
      callId,
      {
        status: CALL_STATUS.REJECTED,
        endedAt: new Date(),
      },
      { returnDocument: 'after' }
    );

    if (callRecord) {
      logCallRecordUpdated(callId, CALL_STATUS.REJECTED);
    }

    return callRecord;
  } catch (error: any) {
    logDbError('markRejected', error.message, { callRecordId: callId });
    throw createApiError(500, 'Failed to update call record');
  }
};

/**
 * Mark call as missed (timeout without answer)
 * This is the default status, so mainly used for explicit confirmation
 */
export const markMissed = async (callId: string): Promise<ICallHistory | null> => {
  try {
    const callRecord = await CallHistory.findByIdAndUpdate(
      callId,
      {
        status: CALL_STATUS.MISSED,
        endedAt: new Date(),
      },
      { returnDocument: 'after' }
    );

    if (callRecord) {
      logCallRecordUpdated(callId, CALL_STATUS.MISSED);
    }

    return callRecord;
  } catch (error: any) {
    logDbError('markMissed', error.message, { callRecordId: callId });
    throw createApiError(500, 'Failed to update call record');
  }
};

/**
 * Mark call as completed
 * Calculates duration based on answeredAt and endedAt
 */
export const markCompleted = async (callId: string): Promise<ICallHistory | null> => {
  try {
    const now = new Date();
    
    // First fetch to get answeredAt for duration calculation
    const existingRecord = await CallHistory.findById(callId);
    
    if (!existingRecord) {
      return null;
    }

    let duration: number | undefined;
    
    if (existingRecord.answeredAt) {
      duration = Math.floor(
        (now.getTime() - existingRecord.answeredAt.getTime()) / 1000
      );
    }

    const callRecord = await CallHistory.findByIdAndUpdate(
      callId,
      {
        status: CALL_STATUS.COMPLETED,
        endedAt: now,
        ...(duration !== undefined && { duration }),
      },
      { returnDocument: 'after' }
    );

    if (callRecord) {
      logCallRecordUpdated(callId, CALL_STATUS.COMPLETED);
    }

    return callRecord;
  } catch (error: any) {
    logDbError('markCompleted', error.message, { callRecordId: callId });
    throw createApiError(500, 'Failed to update call record');
  }
};

// ============================================
// Query Operations
// ============================================

/**
 * Get call history for a user (as caller or receiver)
 * Sorted by most recent first
 */
export const getCallHistory = async (
  userId: string,
  query: Record<string, any> = {}
): Promise<{ data: ICallHistory[]; pagination: any }> => {
  try {
    const { page, limit, skip } = getPaginationOptions(query);
    
    const userObjectId = new Types.ObjectId(userId);
    
    // Build filter - user as either caller or receiver
    const filter: Record<string, any> = {
      $or: [
        { callerId: userObjectId },
        { receiverId: userObjectId },
      ],
    };

    // Optional status filter
    if (query.status && Object.values(CALL_STATUS).includes(query.status)) {
      filter.status = query.status;
    }

    // Get total count
    const total = await CallHistory.countDocuments(filter);

    // Get paginated results
    const data = await CallHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('callerId', 'name email profilePicture')
      .populate('receiverId', 'name email profilePicture')
      .lean();

    const pagination = formatPaginationData(total, page, limit);

    return { data: data as ICallHistory[], pagination };
  } catch (error: any) {
    logDbError('getCallHistory', error.message, { userId });
    throw createApiError(500, 'Failed to retrieve call history');
  }
};

/**
 * Get a single call record by ID
 */
export const getCallById = async (callId: string): Promise<ICallHistory | null> => {
  try {
    return await CallHistory.findById(callId)
      .populate('callerId', 'name email profilePicture')
      .populate('receiverId', 'name email profilePicture');
  } catch (error: any) {
    logDbError('getCallById', error.message, { callRecordId: callId });
    throw createApiError(500, 'Failed to retrieve call record');
  }
};

/**
 * Get call history between two specific users
 */
export const getCallHistoryBetweenUsers = async (
  userId1: string,
  userId2: string,
  query: Record<string, any> = {}
): Promise<{ data: ICallHistory[]; pagination: any }> => {
  try {
    const { page, limit, skip } = getPaginationOptions(query);
    
    const user1ObjectId = new Types.ObjectId(userId1);
    const user2ObjectId = new Types.ObjectId(userId2);

    const filter = {
      $or: [
        { callerId: user1ObjectId, receiverId: user2ObjectId },
        { callerId: user2ObjectId, receiverId: user1ObjectId },
      ],
    };

    const total = await CallHistory.countDocuments(filter);

    const data = await CallHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const pagination = formatPaginationData(total, page, limit);

    return { data: data as ICallHistory[], pagination };
  } catch (error: any) {
    logDbError('getCallHistoryBetweenUsers', error.message, { 
      userId: userId1, 
      targetUserId: userId2 
    });
    throw createApiError(500, 'Failed to retrieve call history');
  }
};

/**
 * Get count of missed calls for a user
 */
export const getMissedCallCount = async (userId: string): Promise<number> => {
  try {
    return await CallHistory.countDocuments({
      receiverId: new Types.ObjectId(userId),
      status: CALL_STATUS.MISSED,
    });
  } catch (error: any) {
    logDbError('getMissedCallCount', error.message, { userId });
    return 0;
  }
};

/**
 * Delete old call records (for data cleanup)
 * @param olderThanDays - Delete records older than this many days
 */
export const deleteOldCallRecords = async (olderThanDays: number = 90): Promise<number> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await CallHistory.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount;
  } catch (error: any) {
    logDbError('deleteOldCallRecords', error.message);
    return 0;
  }
};

// Export as namespace
export const videoCallService = {
  createCallRecord,
  markAnswered,
  markRejected,
  markMissed,
  markCompleted,
  getCallHistory,
  getCallById,
  getCallHistoryBetweenUsers,
  getMissedCallCount,
  deleteOldCallRecords,
};
