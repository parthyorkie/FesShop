import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import helmet from "helmet";
import { connectDB } from "./config/db";
import { errorHandler } from "./middlewares/error.middleware";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import { createApiError } from "./utils/ApiError";
import { initializeVideoCallSocket } from "./socket/videoCall.socket";
import { logger } from "./utils/logger";

// Route imports
import authRoutes from "./routes/authRoutes";
import categoryRoutes from "./routes/category.routes";
import companyRoutes from "./routes/company.routes";
import festivalRoutes from "./routes/festival.routes";
import orderRoutes from "./routes/order.routes";
import productRoutes from "./routes/product.routes";
import sectionRoutes from "./routes/section.routes";
import userRoutes from "./routes/user.routes";
import console from "console";

const app = express();
const httpServer = createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || '*';

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use('/api', apiLimiter);

// Body parser
app.use(express.json());

// Routes
if (authRoutes) {
  app.use('/api/auth', authRoutes);
}

app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use("/api/festivals", festivalRoutes);
app.use("/api/companies", companyRoutes);
app.use('/api/users', userRoutes);
app.use("/api/sections", sectionRoutes); 
app.use("/api/orders", orderRoutes); // Importing order routes here to avoid circular dependency with order.model.ts

// Global 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createApiError(404, 'Not Found'));
});

// Global Error Handler
app.use(errorHandler);

logger.info('Starting server...');

// Connect DB and Start Server
connectDB().then(() => {
  // Initialize Socket.IO for WebRTC signaling
  const io = initializeVideoCallSocket(httpServer, CORS_ORIGINS);
  logger.info('[Socket.IO] Video call signaling initialized');

  // Start HTTP server (includes both Express and Socket.IO)
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
    logger.info(`[Socket.IO] WebSocket server ready`);
  });
});
