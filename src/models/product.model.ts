// import { Schema, model, Document, Types } from 'mongoose';

// export interface IProduct extends Document {
//   name: string;
//   category: Types.ObjectId[];
//   isDeleted: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const ProductSchema = new Schema<IProduct>(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     category: [
//       {
//         type: Schema.Types.ObjectId,
//         ref: 'Category',
//         required: true,
//       },
//     ],
//     isDeleted: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Indexes
// ProductSchema.index({ name: 1 });
// ProductSchema.index({ category: 1 });
// ProductSchema.index({ createdAt: -1 });
// ProductSchema.index({ isDeleted: 1 });

// export const Product = model<IProduct>('Product', ProductSchema);



import { Document, Schema, Types, model } from "mongoose";

export interface IProduct extends Document {
  name: string;
  categories: Types.ObjectId[];
  festivals: Types.ObjectId[];
  company: Types.ObjectId;
  price: number;
  stock: number;
  attributes: Map<string, string>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },

    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    festivals: [{ type: Schema.Types.ObjectId, ref: "Festival" }],

    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    price: Number,
    stock: Number,

    attributes: {
      type: Map,
      of: String,
    },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// ✅ Indexes (Query Driven)
ProductSchema.index({ name: 1 });
ProductSchema.index({ company: 1 });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ festivals: 1 });
ProductSchema.index({ isDeleted: 1 });


export const Product = model<IProduct>("Product", ProductSchema);