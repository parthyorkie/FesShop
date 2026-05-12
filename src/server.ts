import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { connectDB } from "./config/db";
import { errorHandler } from "./middlewares/error.middleware";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import { createApiError } from "./utils/ApiError";

// Route imports
import authRoutes from "./routes/authRoutes";
import categoryRoutes from "./routes/category.routes";
import companyRoutes from "./routes/company.routes";
import festivalRoutes from "./routes/festival.routes";
import orderRoutes from "./routes/order.routes";
import productRoutes from "./routes/product.routes";
import sectionRoutes from "./routes/section.routes";
import userRoutes from "./routes/user.routes";

const app = express();
const PORT = process.env.PORT || 3000;

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

// Connect DB and Start Server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
});
