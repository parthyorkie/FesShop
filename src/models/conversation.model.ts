import { Document, Schema, model } from "mongoose";

export interface IConversation extends Document {
  type: '1-to-1';
  participants: Schema.Types.ObjectId[];
  lastMessage?: Schema.Types.ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['1-to-1'],
      default: '1-to-1',
      required: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes for fast retrieval
conversationSchema.index({ participants: 1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export default model<IConversation>("Conversation", conversationSchema);
