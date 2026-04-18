import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fesshop';
    const connectionInstance = await mongoose.connect(uri);
    logger.info(`MongoDB connected! DB Host: ${connectionInstance.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection FAILED: ', error);
    process.exit(1);
  }
};