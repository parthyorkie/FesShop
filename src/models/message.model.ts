import { Document, Schema, model } from "mongoose";

export interface IMessage extends Document {
  conversationId: Schema.Types.ObjectId;
  senderId: Schema.Types.ObjectId;
  clientMessageId: string;
  type: 'text' | 'voice' | 'media';
  text?: string;
  media?: string;
  // Optional voice metadata if type is voice
  voice?: {
    url?: string; // S3 key reference
    mimeType?: string;
    duration?: number;
    size?: number;
  };
  reactions?: Array<{
    userId: Schema.Types.ObjectId;
    emoji: string;
    createdAt: Date;
  }>;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientMessageId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'voice', 'media'],
      default: 'text',
      required: true,
    },
    text: {
      type: String,
    },
    media: {
      type: String,
    },
    voice: {
      type: new Schema(
        {
          url: { type: String },
          mimeType: { type: String },
          duration: { type: Number },
          size: { type: Number },
        },
        { _id: false }
      ),
      default: undefined,
    },
    reactions: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          emoji: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        }
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
  messageSchema.index({ conversationId: 1, createdAt: -1 });
  messageSchema.index({ clientMessageId: 1, senderId: 1 }, { unique: true });
  messageSchema.index({ 'reactions.userId': 1 });

export default model<IMessage>("Message", messageSchema);
