import { Schema } from "mongoose";
import { PLATFORM_TYPES, TIME_OF_DAY, USER_TYPES } from "../section.constants";

export const ConditionsSchema = new Schema(
  {
    userType: [{ type: String, enum: USER_TYPES }],
    timeOfDay: [{ type: String, enum: TIME_OF_DAY }],
    platform: [{ type: String, enum: PLATFORM_TYPES }],
  },
  { _id: false, strict: "throw" }
);