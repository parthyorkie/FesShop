// import { Document, Schema, model } from "mongoose";

// export interface IFestival extends Document {
//   name: string;
//   code: string;
//   startDate?: Date;
//   endDate?: Date;
//   isActive: boolean;
//   isDeleted: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const FestivalSchema = new Schema<IFestival>(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//     },

//     // 🔥 Unique short code (useful for APIs)
//     code: {
//       type: String,
//       required: true,
//       uppercase: true,
//       unique: true,
//       trim: true,
//     },

//     startDate: Date,
//     endDate: Date,

//     isActive: {
//       type: Boolean,
//       default: true,
//     },

//     isDeleted: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   { timestamps: true }
// );

// // ✅ Indexes (Query-driven)
// FestivalSchema.index({ name: 1 });
// FestivalSchema.index({ code: 1 });
// FestivalSchema.index({ isActive: 1 });
// FestivalSchema.index({ isDeleted: 1 });

// // 🔥 Active festivals query optimization
// FestivalSchema.index({ isActive: 1, isDeleted: 1 });

// export const Festival = model<IFestival>("Festival", FestivalSchema);

import { Document, Schema, model } from "mongoose";

export interface IFestival extends Document {
  name: string;
  code: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FestivalSchema = new Schema<IFestival>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true, // ✅ for prefix search
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
      trim: true,
      maxLength:30
    },

    startDate: Date,
    endDate: Date,

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// 🔥 Index Strategy
// ✅ compound filter (used in almost every query)
FestivalSchema.index({ isActive: 1, isDeleted: 1 });

// ✅ sorting optimization
FestivalSchema.index({ createdAt: -1 });

export const Festival = model<IFestival>("Festival", FestivalSchema);