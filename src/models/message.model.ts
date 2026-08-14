import { Document, Schema, model } from "mongoose";

export interface IMessage extends Document {
  conversationId: Schema.Types.ObjectId;
  senderId: Schema.Types.ObjectId;
  clientMessageId: string;
  type: 'text' | 'voice' | 'media';
  text?: string;
  media?: string;
  reactions?: any[];
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
    reactions: {
      type: [Schema.Types.Mixed],
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

export default model<IMessage>("Message", messageSchema);
