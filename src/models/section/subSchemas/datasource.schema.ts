import { Schema } from "mongoose";
import { DATA_SOURCE_TYPES } from "../section.constants";

export const DataSourceSchema = new Schema(
  {
    type: {
      type: String,
      enum: DATA_SOURCE_TYPES,
      required: true,
    },
    ref: String,
  },
  { _id: false, strict: "throw" }
);