import { Schema } from "mongoose";

export const CTASchema = new Schema(
  {
    type: {
      type: String,
      enum: ["navigate", "deeplink"],
      required: true,
    },
    screen: String,
    url: String,
    params: Schema.Types.Mixed,
  },
  { _id: false, strict: "throw" }
);