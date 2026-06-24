/**
 * Call History Model
 * 
 * Stores records of video call attempts with status tracking.
 * Supports call analytics, history display, and audit logging.
 */

import { Schema, model, Types } from 'mongoose';
import { ICallHistory } from '../interfaces/videoCall.interface';
import { CALL_STATUS, CallStatus } from '../constants/videoCall.constants';

const callHistorySchema = new Schema<ICallHistory>(
  {
    callerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CALL_STATUS),
      default: CALL_STATUS.MISSED,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // in seconds
      default: null,
      min: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Compound indexes for common queries
callHistorySchema.index({ callerId: 1, createdAt: -1 }); // Caller's history
callHistorySchema.index({ receiverId: 1, createdAt: -1 }); // Receiver's history
callHistorySchema.index({ callerId: 1, receiverId: 1, createdAt: -1 }); // Between two users
callHistorySchema.index({ status: 1, createdAt: -1 }); // By status

// Virtual for formatted duration
callHistorySchema.virtual('formattedDuration').get(function () {
  if (this.duration === null || this.duration === undefined) {
    return null;
  }
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Pre-save hook to calculate duration if endedAt is set
callHistorySchema.pre('save', function () {
  if (this.endedAt && this.answeredAt && !this.duration) {
    this.duration = Math.floor(
      (this.endedAt.getTime() - this.answeredAt.getTime()) / 1000
    );
  }
});

// Static method to calculate duration
callHistorySchema.statics.calculateDuration = function (
  answeredAt: Date,
  endedAt: Date
): number {
  return Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000);
};

export const CallHistory = model<ICallHistory>('CallHistory', callHistorySchema);

export default CallHistory;
