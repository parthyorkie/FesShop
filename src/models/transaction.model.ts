import { Document, Schema, Types, model } from "mongoose";

export type TransactionType = "SALE" | "PURCHASE" | "EXPENSE" | "REFUND";
export type PaymentMethod = "CASH" | "UPI" | "CARD" | "RAZORPAY";

export interface ITransaction extends Document {
  // 🔗 References
  order?: Types.ObjectId;
  orderId?: Types.ObjectId;
  userId?: Types.ObjectId;
//   product?: Types.ObjectId;
  customer?: Types.ObjectId;

  // 🔥 Snapshot (avoid populate)
  productSnapshot?: {
    name: string;
  };

  customerSnapshot?: {
    name?: string;
    phone?: string;
  };

  // 🔥 Core fields
  type: TransactionType;
  amount: number;

  currency?: string;
  paymentGateway?: "RAZORPAY";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status?: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

  paymentMethod: PaymentMethod;

  festival?: Types.ObjectId;

  // 🔥 Extra info
  notes?: string;

  // 🔥 Soft delete
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const SnapshotProductSchema = new Schema(
  {
    name: { type: String, required: true },
  },
  { _id: false }
);

const SnapshotCustomerSchema = new Schema(
  {
    name: String,
    phone: String,
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    // 🔗 Relations
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // product: {
    //   type: Schema.Types.ObjectId,
    //   ref: "Product",
    // },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },

    // 🔥 Snapshots
    productSnapshot: SnapshotProductSchema,
    customerSnapshot: SnapshotCustomerSchema,

    // 🔥 Transaction details
    type: {
      type: String,
      enum: ["SALE", "PURCHASE", "EXPENSE", "REFUND"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      uppercase: true,
      trim: true,
    },

    paymentGateway: {
      type: String,
      enum: ["RAZORPAY"],
    },

    razorpayOrderId: { type: String, trim: true },
    razorpayPaymentId: { type: String, trim: true },
    razorpaySignature: { type: String, trim: true },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "RAZORPAY"],
      default: "CASH",
    },

    festival: {
      type: Schema.Types.ObjectId,
      ref: "Festival",
    },

    notes: {
      type: String,
      trim: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


// ✅ INDEXES (Query-driven)

// 🔍 Basic filters
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ festival: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ isDeleted: 1 });

// 🔍 Relations
TransactionSchema.index({ order: 1 });
TransactionSchema.index({ orderId: 1, paymentGateway: 1 }, {
  unique: true,
  partialFilterExpression: { paymentGateway: "RAZORPAY" },
});
TransactionSchema.index({ razorpayOrderId: 1 }, { sparse: true });
TransactionSchema.index({ product: 1 });
TransactionSchema.index({ customer: 1 });

// 🔥 Analytics indexes
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ festival: 1, type: 1 });
TransactionSchema.index({ customer: 1, createdAt: -1 });

// 🔥 Payment tracking
TransactionSchema.index({ paymentMethod: 1, createdAt: -1 });


// 🔥 Middleware: Validate based on type (optional advanced)
TransactionSchema.pre("save", function (this: ITransaction) {
  if (this.type === "SALE" && !this.order) {
    throw new Error("SALE transaction must have order reference");
  }

//   if (this.type === "PURCHASE" && !this.product) {
//     throw new Error("PURCHASE transaction must have product reference");
//   }
});


export const Transaction = model<ITransaction>(
  "Transaction",
  TransactionSchema
);