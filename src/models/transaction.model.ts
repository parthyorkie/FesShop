import { Document, Schema, Types, model } from "mongoose";

export type TransactionType = "SALE" | "PURCHASE" | "EXPENSE" | "REFUND";
export type PaymentMethod = "CASH" | "UPI" | "CARD";

export interface ITransaction extends Document {
  // 🔗 References
  order?: Types.ObjectId;
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

    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD"],
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