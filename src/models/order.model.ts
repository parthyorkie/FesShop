import { Document, Schema, Types, model } from "mongoose";

interface IOrderItem {
  product: Types.ObjectId;
  name: string;       // 🔥 Snapshot
  quantity: number;
  price: number;
  total: number;
}

interface ICustomerSnapshot {
  name?: string;
  phone: string;
}

export interface IOrder extends Document {
  customer?: Types.ObjectId;
  customerSnapshot: ICustomerSnapshot;

  items: IOrderItem[];

  subTotal: number;
  discount: number;
  totalAmount: number;

  festival?: Types.ObjectId;

  paymentMethod: "CASH" | "UPI" | "CARD";
  paymentStatus: "PENDING" | "PAID";

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true, // 🔥 snapshot
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const CustomerSnapshotSchema = new Schema<ICustomerSnapshot>(
  {
    name: { type: String, trim: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    // 🔗 Reference (optional for walk-in)
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },

    // 🔥 Snapshot (always required)
    customerSnapshot: {
      type: CustomerSnapshotSchema,
      required: true,
    },

    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, "Order must have items"],
    },

    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    festival: {
      type: Schema.Types.ObjectId,
      ref: "Festival",
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD"],
      default: "CASH",
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PAID",
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


// ✅ Indexes (Highly Optimized)
OrderSchema.index({ customer: 1 });
OrderSchema.index({ "customerSnapshot.phone": 1 });
OrderSchema.index({ festival: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ isDeleted: 1 });

// 🔥 Compound indexes (analytics)
OrderSchema.index({ festival: 1, createdAt: -1 });
OrderSchema.index({ customer: 1, createdAt: -1 });


// 🔥 Middleware: Auto calculate totals (optional but recommended)
OrderSchema.pre("save", function (this: IOrder) {
  const subTotal = this.items.reduce(
    (sum, item) => sum + item.total,
    0
  );

  this.subTotal = subTotal;
  this.totalAmount = subTotal - (this.discount || 0);
});

export const Order = model<IOrder>("Order", OrderSchema);