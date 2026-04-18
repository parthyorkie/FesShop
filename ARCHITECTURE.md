# FesShop - Code Level Architecture

**Last Updated:** April 2026  
**Project Type:** Festival E-commerce Platform  
**Status:** Production-Ready  

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architectural Pattern](#architectural-pattern)
4. [System Architecture](#system-architecture)
5. [Layer Documentation](#layer-documentation)
6. [Module Breakdown](#module-breakdown)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Key Utilities & Patterns](#key-utilities--patterns)
10. [Database Schema](#database-schema)

---

## 🎯 Project Overview

**FesShop** is a festival-focused e-commerce platform built with **Node.js + Express + MongoDB + TypeScript**.

### Core Features
- 🏪 Multi-vendor product marketplace
- 🎪 Festival-based product organization
- 📦 Order management with payments
- 👥 User authentication & authorization
- 💳 Transaction tracking
- 📧 Email notifications
- 🔐 Secure API with JWT tokens
- 📊 Pagination & filtering

### Business Entities
- **Users** - Customers and administrators
- **Companies** - Vendors/sellers
- **Products** - Items for sale
- **Categories** - Product classification
- **Festivals** - Seasonal events
- **Orders** - Customer purchases
- **Transactions** - Payment records

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 6.0.2 |
| **HTTP Framework** | Express.js 5.2.1 |
| **Database** | MongoDB (via Mongoose 9.4.1) |
| **Authentication** | JWT (jsonwebtoken 9.0.3) |
| **Password Hashing** | bcryptjs 3.0.3 |
| **Validation** | Joi 18.1.2 |
| **Email** | Nodemailer 8.0.5 |
| **Security** | Helmet 8.1.0 |
| **Rate Limiting** | express-rate-limit 8.3.2 |
| **Image Storage** | Cloudinary |
| **Logging** | Winston 3.19.0, Pino 10.3.1 |
| **Config Management** | dotenv |
| **Utilities** | uuid, cors, compression |

---

## 🏗️ Architectural Pattern

### **4-Tier Layered Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT LAYER                          │
│              (External API Consumers)                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                         │
│         (Controllers - HTTP Handlers)                   │
│  ↓ Receives requests ↓ Calls services ↓ Returns JSON   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│            BUSINESS LOGIC LAYER                         │
│         (Services - Application Logic)                  │
│  ↓ Validation ↓ Orchestration ↓ Error handling         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│             DATA ACCESS LAYER                           │
│      (Repositories - Database Operations)              │
│  ↓ Query building ↓ CRUD operations ↓ Data mapping    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              PERSISTENCE LAYER                          │
│         (MongoDB with Mongoose Schemas)                |
│  ↓ Data models ↓ Indexes ↓ Relationships              │
└─────────────────────────────────────────────────────────┘
```

### **Design Principles**
- ✅ **Separation of Concerns** - Each layer has a single responsibility
- ✅ **Dependency Injection** - Services depend on repositories
- ✅ **DRY** - Business logic centralized in services
- ✅ **Testability** - Easy to mock repositories for testing
- ✅ **Maintainability** - Clear code organization
- ✅ **Scalability** - New features follow the same pattern

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER.TS - Entry Point                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE STACK                              │
├─────────────────────────────────────────────────────────────────┤
│ • helmet() - Security headers                                   │
│ • express.json() - Body parser                                  │
│ • cors() - Cross-origin requests                               │
│ • requestLogger - Winston logging                              │
│ • rateLimiter - Rate limiting on /api                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ROUTES REGISTRATION                           │
├─────────────────────────────────────────────────────────────────┤
│ • /api/auth - Authentication endpoints                         │
│ • /api/products - Product management                           │
│ • /api/categories - Category management                        │
│ • /api/companies - Company/vendor management                   │
│ • /api/orders - Order management                               │
│ • /api/festivals - Festival management                         │
│ • /api/users - User management                                 │
│ • /api/transactions - Transaction tracking                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 REQUEST MIDDLEWARE CHAIN                        │
├─────────────────────────────────────────────────────────────────┤
│ • validate(schema) - Joi validation middleware                 │
│ • authenticate() - JWT verification middleware                │
│ • authorize(role) - Role-based access control                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 REPOSITORY LAYER                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 MONGOOSE MODELS                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MONGODB DATABASE                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 Layer Documentation

### 1️⃣ **CONTROLLER LAYER** (`src/controllers/`)

**Responsibility:** HTTP request/response handling

**Pattern:**
```typescript
export const createCompany = asyncHandler(async (req: Request, res: Response) => {
  // 1. Extract data from request
  // 2. Call service method
  // 3. Return standardized response
  const company = await companyService.createCompanyService(req.body);
  res.status(201).json(createApiResponse(201, company, "Company created successfully"));
});
```

**Controllers in Project:**
- `authController.ts` - Login, registration, password reset
- `product.controller.ts` - CRUD for products
- `category.controller.ts` - CRUD for categories
- `company.controller.ts` - CRUD for vendors
- `order.controller.ts` - Order management
- `festival.controller.ts` - Festival management
- `user.controller.ts` - User management

**Key Characteristics:**
- ✅ Thin controllers - only HTTP logic
- ✅ Use `asyncHandler()` to catch errors
- ✅ Consistent response format via `createApiResponse()`
- ✅ No business logic here

---

### 2️⃣ **SERVICE LAYER** (`src/services/`)

**Responsibility:** Business logic, validation, orchestration

**Pattern:**
```typescript
export const getCompanyService = async (id: Types.ObjectId) => {
  // 1. Input validation
  const company = await repo.findCompanyById(id);
  
  // 2. Business logic
  if (!company) throw new Error("Company not found");
  
  // 3. Return/transform data
  return company;
};
```

**Services in Project:**
- `user.service.ts` - User registration, profile updates
- `product.service.ts` - Product CRUD, search, filtering
- `category.service.ts` - Category management
- `company.service.ts` - Vendor management
- `order.service.ts` - Order creation, payment tracking
- `festival.service.ts` - Festival management
- `emailService.ts` - Email notifications

**Key Characteristics:**
- ✅ Contains all business rules
- ✅ Calls repositories for data
- ✅ Validates inputs
- ✅ Handles errors with meaningful messages
- ✅ Can be called from multiple controllers or jobs

---

### 3️⃣ **REPOSITORY LAYER** (`src/repositories/`)

**Responsibility:** Data access & database operations

**Pattern:**
```typescript
export const findCompanyById = async (id: Types.ObjectId): Promise<ICompany | null> => {
  return await Company.findOne({
    _id: id,
    isDeleted: false,  // Soft delete check
  });
};

export const findAllCompanies = async (filter: any, skip: number, limit: number, sort: any) => {
  const [data, total] = await Promise.all([
    Company.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Company.countDocuments(query),
  ]);
  return { data, total };
};
```

**Repositories in Project:**
- `user.repository.ts` - User queries
- `product.repository.ts` - Product queries
- `category.repository.ts` - Category queries
- `company.repository.ts` - Company queries
- `order.repository.ts` - Order queries
- `festival.repository.ts` - Festival queries

**Key Characteristics:**
- ✅ Pure data access
- ✅ No business logic
- ✅ Handles `isDeleted` for soft deletes
- ✅ Uses `.lean()` for read-heavy queries
- ✅ Consistent error handling
- ✅ Database-agnostic interface

**Naming Convention:** `<action><Entity>InDb` or `<action><Entity>`
- `createCompanyInDb()` - Insert
- `findCompanyById()` - Select by ID
- `findAllCompanies()` - Select all with filters
- `updateCompanyInDb()` - Update
- `softDeleteCompanyInDb()` - Soft delete

---

### 4️⃣ **MODEL LAYER** (`src/models/`)

**Responsibility:** Database schema definitions

**Pattern:**
```typescript
interface ICompany {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const companySchema = new Schema<ICompany>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

export const Company = model<ICompany>("Company", companySchema);
```

**Models in Project:**
- `User.ts` - User accounts with role-based auth
- `Product.ts` - Products with pricing & inventory
- `Category.ts` - Product categories
- `Company.ts` - Vendor companies
- `Order.ts` - Customer orders
- `Festival.ts` - Seasonal events
- `Transaction.ts` - Payment tracking
- `Customer.ts` - Customer profiles

**Key Characteristics:**
- ✅ TypeScript interfaces for type safety
- ✅ Mongoose schemas with validation
- ✅ `timestamps: true` for createdAt/updatedAt
- ✅ Soft delete pattern with `isDeleted`
- ✅ Indexed fields for performance

---

## 📦 Module Breakdown

### **Authentication Module**
```
Routes: POST /api/auth/register, /api/auth/login, /api/auth/refresh-token
      
Flow:
  1. Register → Controller validates → Service checks duplicate → Repo creates user
  2. Login → Controller validates → Service validates password → Generate JWT token
  3. Password Reset → Service generates OTP → EmailService sends → Update password
```

**Files:**
- [src/controllers/authController.ts](src/controllers/authController.ts)
- [src/services/user.service.ts](src/services/user.service.ts)
- [src/routes/authRoutes.ts](src/routes/authRoutes.ts)
- [src/utils/jwt.ts](src/utils/jwt.ts)

---

### **Product Module**
```
Routes: GET /api/products, POST /api/products, PATCH /api/products/:id

Features:
  - Search by name/sku
  - Filter by category, company, stock
  - Pagination (page, limit)
  - Sorting (price, createdAt)
  - Inventory tracking
```

**Files:**
- [src/controllers/product.controller.ts](src/controllers/product.controller.ts)
- [src/services/product.service.ts](src/services/product.service.ts)
- [src/repositories/product.repository.ts](src/repositories/product.repository.ts)
- [src/models/product.model.ts](src/models/product.model.ts)

---

### **Order Module**
```
Routes: GET /api/orders, POST /api/orders, PATCH /api/orders/:id

Features:
  - Create orders with multiple items
  - Order status tracking (pending, confirmed, shipped, delivered)
  - Payment tracking via transactions
  - Order history for users
```

**Files:**
- [src/controllers/order.controller.ts](src/controllers/order.controller.ts)
- [src/services/order.service.ts](src/services/order.service.ts)
- [src/repositories/order.repository.ts](src/repositories/order.repository.ts)
- [src/models/order.model.ts](src/models/order.model.ts)

---

### **Company (Vendor) Module**
```
Routes: GET /api/companies, POST /api/companies, PATCH /api/companies/:id

Features:
  - Vendor registration & management
  - Product listing per company
  - Soft delete (archiving)
  - Search & pagination
```

**Files:**
- [src/controllers/company.controller.ts](src/controllers/company.controller.ts)
- [src/services/company.service.ts](src/services/company.service.ts)
- [src/repositories/company.repository.ts](src/repositories/company.repository.ts)
- [src/models/company.model.ts](src/models/company.model.ts)

---

### **Festival Module**
```
Routes: GET /api/festivals, POST /api/festivals, PATCH /api/festivals/:id

Features:
  - Festival event management
  - Seasonal product organization
  - Date range tracking
  - Status management
```

**Files:**
- [src/controllers/festival.controller.ts](src/controllers/festival.controller.ts)
- [src/services/festival.service.ts](src/services/festival.service.ts)
- [src/repositories/festival.repository.ts](src/repositories/festival.repository.ts)
- [src/models/festival.model.ts](src/models/festival.model.ts)

---

## 🔄 Data Flow

### **Example: Create Company**

```
1. HTTP Request
   POST /api/companies
   Headers: { Authorization: "Bearer <token>" }
   Body: { name: "Sony Festival", email: "sony@festival.com", ... }

2. Route Maps to Controller
   routes/company.routes.ts → createCompany()

3. Middleware Chain
   ✓ Authentication.middleware - Verify JWT
   ✓ Validation.middleware - Joi validation
   ✓ Authorization - Check ADMIN role

4. Controller: src/controllers/company.controller.ts
   export const createCompany = asyncHandler(async (req, res) => {
     const company = await companyService.createCompanyService(req.body);
     res.status(201).json(createApiResponse(201, company, "..."));
   });

5. Service: src/services/company.service.ts
   export const createCompanyService = async (data: Partial<ICompany>) => {
     if (!data.name) throw new Error("Company name is required");
     return await repo.createCompanyInDb(data);
   };

6. Repository: src/repositories/company.repository.ts
   export const createCompanyInDb = async (data: Partial<ICompany>) => {
     return await Company.create(data);
   };

7. Model: src/models/company.model.ts
   const companySchema = new Schema<ICompany>({
     name: { type: String, required: true },
     email: { type: String, required: true, unique: true },
     ...
   });

8. MongoDB Execution
   db.companies.insertOne({ name, email, createdAt, updatedAt, isDeleted: false })

9. Response JSON
   {
     "statusCode": 201,
     "data": { _id, name, email, createdAt, updatedAt },
     "message": "Company created successfully",
     "success": true
   }
```

---

## 🔐 Security Architecture

### **1. Authentication & Authorization**
```typescript
// JWT Token Generation
const token = jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }
);

// Middleware: Verify Token
export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) throw new Error("Unauthorized");
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};

// Authorization by Role
export const authorize = (roles: string[]) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new Error("Forbidden");
    }
    next();
  };
};
```

**Middleware Stack:**
- [src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts) - JWT verification
- [src/middlewares/validate.middleware.ts](src/middlewares/validate.middleware.ts) - Input validation

---

### **2. Password Security**
```typescript
// bcryptjs - Hashing with salt rounds = 10
const hashedPassword = await bcrypt.hash(plainPassword, 10);
const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
```

---

### **3. Input Validation**
```typescript
// Joi Schema Validation
const createUserSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid("user", "admin"),
});

// Applied via Middleware
app.post("/api/users", validate(createUserSchema), createUser);
```

---

### **4. Rate Limiting**
```typescript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests",
});
app.use("/api", rateLimiter);
```

---

### **5. Security Headers (Helmet)**
```typescript
app.use(helmet()); // Adds:
// - Content-Security-Policy
// - X-Frame-Options (clickjacking prevention)
// - X-Content-Type-Options
// - Strict-Transport-Security
// - etc.
```

---

### **6. Data Protection**
- ✅ **Soft Deletes** - `isDeleted` flag instead of hard delete
- ✅ **CORS** - Whitelist allowed origins
- ✅ **Environment Variables** - Sensitive data in `.env`
- ✅ **SQL Injection Prevention** - Mongoose ORM protects with schema validation
- ✅ **XSS Prevention** - Input sanitization via Joi

---

## 🛠️ Key Utilities & Patterns

### **1. AsyncHandler Wrapper**
```typescript
// src/utils/asyncHandler.ts
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage - catches all async errors automatically
export const createCompany = asyncHandler(async (req, res) => {
  // If error thrown here, caught automatically
  const company = await companyService.createCompanyService(req.body);
  res.status(201).json(createApiResponse(201, company, "..."));
});
```

---

### **2. Error Handling**
```typescript
// src/utils/ApiError.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors: any[] = []
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Global Error Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({
    statusCode: status,
    message,
    data: null,
    success: false,
  });
});
```

---

### **3. Standardized Response Format**
```typescript
// src/utils/ApiResponse.ts
export const createApiResponse = (
  statusCode: number,
  data: any,
  message: string = "Success",
  pagination?: any
) => {
  return {
    statusCode,
    data,
    message,
    success: statusCode < 400,
    ...(pagination && { pagination }),
  };
};

// Response Format
{
  "statusCode": 200,
  "data": [...],
  "message": "Companies fetched successfully",
  "success": true,
  "pagination": { "total": 50, "page": 1, "limit": 10 }
}
```

---

### **4. Pagination Utility**
```typescript
// src/utils/pagination.ts
export const calculatePagination = (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  return { skip, limit };
};

// Usage in Service/Repository
const skip = (Number(page) - 1) * Number(limit);
const data = await Company.find(filter)
  .sort(sort)
  .skip(skip)
  .limit(Number(limit))
  .lean();
const total = await Company.countDocuments(filter);
```

---

### **5. Logging**
```typescript
// src/utils/logger.ts - Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Usage
logger.info("Server started on port 3000");
logger.error("Database connection failed", error);
```

---

### **6. Validation Schema**
```typescript
// src/validations/company.validation.ts
export const createCompanySchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Company name is required",
  }),
  email: Joi.string().email().required(),
  phone: Joi.string().optional(),
});

// Applied to Route
router.post(
  "/",
  validate(createCompanySchema),
  createCompany
);
```

---

## 📋 Database Schema

### **Entity Relationship Diagram**

```
┌─────────────┐         ┌──────────────┐
│    User     │         │   Company    │
├─────────────┤         ├──────────────┤
│ _id         │         │ _id          │
│ name        │         │ name         │
│ email       │◄────┐   │ email        │
│ password    │     │   │ isDeleted    │
│ role        │     │   │ timestamps   │
│ userRefId   │─────┤   └──────────────┘
│ isDeleted   │     │         │
│ timestamps  │     │         │ (1 to many)
└─────────────┘     │         │
       │             │    ┌────────────┐
       │             │    │  Product   │
       │             │    ├────────────┤
       │ (1 to many) │    │ _id        │
       │             │    │ name       │
       │             └────│ companyId  │
       │                  │ categoryId │
       │             ┌────│ price      │
       │             │    │ stock      │
       │             │    │ isDeleted  │
       │             │    │ timestamps │
       │             │    └────────────┘
       │             │          │
       │             │          │ (1 to many)
       │    ┌────────────────────┘
       │    │
       └────┤
            │
         ┌──────────┐      ┌──────────────┐
         │  Order   │      │  Category    │
         ├──────────┤      ├──────────────┤
         │ _id      │      │ _id          │
         │ userId   │◄─────│ name         │
         │ items[]  │      │ description  │
         │ total    │      │ isDeleted    │
         │ status   │      │ timestamps   │
         │ isDeleted│      └──────────────┘
         │ timestamps
         └──────────┘
              │
              │ (1 to many)
              │
         ┌───────────────┐
         │ Transaction   │
         ├───────────────┤
         │ _id           │
         │ orderId       │
         │ amount        │
         │ status        │
         │ paymentMethod │
         │ timestamps    │
         └───────────────┘
              │
              │ (1 to many)
              │
         ┌──────────┐
         │ Festival │
         ├──────────┤
         │ _id      │
         │ name     │
         │ startDate│
         │ endDate  │
         │ isDeleted│
         │ timestamps
         └──────────┘
```

---

### **Key Collections**

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| **users** | User accounts | _id, name, email, password, role, userRefId, isDeleted |
| **companies** | Vendors | _id, name, email, phone, isDeleted |
| **products** | Items for sale | _id, name, sku, price, stock, companyId, categoryId, isDeleted |
| **categories** | Product grouping | _id, name, description, isDeleted |
| **orders** | Customer purchases | _id, userId, items[], total, status, isDeleted |
| **transactions** | Payments | _id, orderId, amount, status, paymentMethod |
| **festivals** | Events | _id, name, startDate, endDate, isDeleted |
| **customers** | Customer profiles | _id, userId, phone, address |

---

## 📁 File Structure Explained

```
src/
│
├── server.ts                          ← Entry point, Express app setup
│
├── config/
│   ├── config.ts                      ← Configuration values
│   └── db.ts                          ← MongoDB connection
│
├── models/                            ← Mongoose schemas & interfaces
│   ├── user.model.ts
│   ├── product.model.ts
│   ├── order.model.ts
│   ├── company.model.ts
│   ├── category.model.ts
│   ├── festival.model.ts
│   ├── transaction.model.ts
│   └── customer.model.ts
│
├── repositories/                      ← Data access layer
│   ├── user.repository.ts
│   ├── product.repository.ts
│   ├── order.repository.ts
│   ├── company.repository.ts
│   ├── category.repository.ts
│   └── festival.repository.ts
│
├── services/                          ← Business logic layer
│   ├── user.service.ts
│   ├── product.service.ts
│   ├── order.service.ts
│   ├── company.service.ts
│   ├── category.service.ts
│   ├── festival.service.ts
│   └── emailService.ts
│
├── controllers/                       ← HTTP handlers
│   ├── authController.ts
│   ├── product.controller.ts
│   ├── order.controller.ts
│   ├── company.controller.ts
│   ├── category.controller.ts
│   ├── festival.controller.ts
│   └── user.controller.ts
│
├── routes/                            ← API endpoints
│   ├── authRoutes.ts
│   ├── product.routes.ts
│   ├── order.routes.ts
│   ├── company.routes.ts
│   ├── category.routes.ts
│   ├── festival.routes.ts
│   └── user.routes.ts
│
├── middlewares/                       ← Express middleware
│   ├── auth.middleware.ts             ← JWT verification
│   ├── validate.middleware.ts         ← Joi validation
│   ├── error.middleware.ts            ← Error handling
│   ├── errorHandler.ts
│   ├── rateLimiter.middleware.ts      ← Rate limiting
│   └── requestLogger.ts               ← Request logging
│
├── validations/                       ← Joi schemas
│   ├── user.validation.ts
│   ├── product.validation.ts
│   ├── order.validation.ts
│   ├── company.validation.ts
│   ├── category.validation.ts
│   └── festival.validation.ts
│
├── utils/                             ← Utility functions
│   ├── asyncHandler.ts                ← Error wrapper
│   ├── ApiError.ts                    ← Custom error class
│   ├── ApiResponse.ts                 ← Standard response format
│   ├── jwt.ts                         ← Token generation/verification
│   ├── logger.ts                      ← Winston logging
│   ├── pagination.ts                  ← Pagination helper
│   └── parseError.ts
│
├── templates/                         ← Email templates
│   └── resetPassword.template.ts
│
└── docs/                              ← Documentation
    ├── AI_RULES.md
    └── SYSTEM_PROMPT.md
```

---

## 🚀 API Endpoints Summary

| Method | Endpoint | Controller | Purpose |
|--------|----------|-----------|---------|
| **Auth** |
| POST | `/api/auth/register` | authController | User registration |
| POST | `/api/auth/login` | authController | User login |
| POST | `/api/auth/refresh-token` | authController | Refresh JWT |
| POST | `/api/auth/forgot-password` | authController | Password reset request |
| **Products** |
| GET | `/api/products` | productController | List products |
| POST | `/api/products` | productController | Create product |
| GET | `/api/products/:id` | productController | Get product |
| PATCH | `/api/products/:id` | productController | Update product |
| DELETE | `/api/products/:id` | productController | Delete product |
| **Orders** |
| GET | `/api/orders` | orderController | List orders |
| POST | `/api/orders` | orderController | Create order |
| GET | `/api/orders/:id` | orderController | Get order |
| PATCH | `/api/orders/:id` | orderController | Update order |
| **Companies** |
| GET | `/api/companies` | companyController | List companies |
| POST | `/api/companies` | companyController | Create company |
| PATCH | `/api/companies/:id` | companyController | Update company |
| DELETE | `/api/companies/:id` | companyController | Delete company |
| **Categories** |
| GET | `/api/categories` | categoryController | List categories |
| POST | `/api/categories` | categoryController | Create category |
| **Festivals** |
| GET | `/api/festivals` | festivalController | List festivals |
| POST | `/api/festivals` | festivalController | Create festival |

---

## ✅ Code Quality Practices

1. **Type Safety** - Full TypeScript coverage
2. **Error Handling** - Try-catch + asyncHandler + global middleware
3. **Input Validation** - Joi schemas on all endpoints
4. **Logging** - Winston logger for debugging
5. **CORS** - Cross-origin requests restricted
6. **Rate Limiting** - Prevent abuse on `/api` routes
7. **Security** - Helmet headers + bcrypt passwords + JWT tokens
8. **Soft Deletes** - Preserve data with `isDeleted` flag
9. **Pagination** - Efficient data retrieval
10. **Consistent Responses** - ApiResponse standardization

---

## 🔧 Development Workflow

1. **Create Model** → Define Mongoose schema + TypeScript interface
2. **Create Repository** → CRUD operations for the model
3. **Create Service** → Business logic + validation
4. **Create Controller** → HTTP handler + response formatting
5. **Create Routes** → Map endpoints to controllers
6. **Create Validation** → Joi schema for inputs
7. **Create Middleware** → Auth/authorization if needed
8. **Test Endpoint** → Use `api-guide.http` or Postman

---

## 📞 Support & Maintenance

- **Logs Location** - Check `error.log` and `combined.log`
- **Environment** - All config in `.env` file
- **Database** - Connect to MongoDB via Mongoose
- **Security** - Update dependencies regularly
- **Monitoring** - Use Winston logs for debugging

---

**Document Version:** 1.0  
**Last Updated:** April 17, 2026  
**Maintainer:** Development Team
