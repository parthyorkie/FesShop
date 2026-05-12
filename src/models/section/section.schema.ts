// src/models/section/section.schema.ts

import { Schema } from "mongoose";
import { SECTION_TYPES } from "./section.constants";
import { ConditionsSchema } from "./subSchemas/conditions.schema";
import { DataSourceSchema } from "./subSchemas/datasource.schema";

const TitleConfigSchema = new Schema(
  {
    fontSize: { type: Number, default: 18 },
    fontWeight: {
      type: String,
      enum: ["400", "500", "600", "700", "800"],
      default: "700",
    },
    color: { type: String, default: "#121212" },
    align: {
      type: String,
      enum: ["left", "center", "right"],
      default: "left",
    },
    marginBottom: { type: Number, default: 12 },
    marginHorizontal: { type: Number, default: 16 },
    textTransform: {
      type: String,
      enum: ["none", "uppercase", "capitalize"],
      default: "none",
    },

    // ✅ Advanced styling
    backgroundColor: { type: String },
    padding: { type: Number },
    borderRadius: { type: Number },
    letterSpacing: { type: Number },
  },
  { _id: false }
);

const LayoutConfigSchema = new Schema(
  {
     // ✅ Grid
    columns: { type: Number, min: 1, max: 6 },
    itemSpacing: { type: Number, default: 8 },

    // ✅ Layout behavior
    scrollDirection: {
      type: String,
      enum: ["horizontal", "vertical"],
    },

    // ✅ Banner
    aspectRatio: { type: Number },
    height: { type: Number },
    autoScroll: { type: Boolean, default: false },
    fullWidth: { type: Boolean, default: false }, // 🔥 NEW

    // ✅ Horizontal list
    visibleItems: { type: Number },

    // ✅ Core logic
    threshold: { type: Number },

    // ✅ Title styling
    title: { type: TitleConfigSchema },
    
  },
  { _id: false }
);

export const SectionSchema = new Schema(
  {
    type: {
      type: String,
      enum: SECTION_TYPES,
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    // 🔥 UI control
    layoutConfig: LayoutConfigSchema, 

    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    priority: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // 🔥 Festival reference (IMPORTANT CHANGE)
    festival: {
      type: Schema.Types.ObjectId,
      ref: "Festival",
      required: false,
      index: true,
    },

    // 🔥 Context conditions (time, platform, userType)
    conditions: {
      type: ConditionsSchema,
      required: false,
    },

    // 🔥 Data source (static / dynamic)
    dataSource: {
      type: DataSourceSchema,
      required: true,
    },

    // 🔥 Version control / rollout safety
    visibilityRules: {
      minAppVersion: String,
      maxAppVersion: String,
      platforms: [String],
    },

    // 🔥 Analytics support
    analyticsMeta: {
      eventName: String,
      trackingId: String,
    },

    // 🔥 Auto-expiry
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    discriminatorKey: "type",
  }
);

// 🔥 Compound indexes (VERY IMPORTANT)
SectionSchema.index({ status: 1, isActive: 1 });
SectionSchema.index({ displayOrder: 1, priority: -1 });
SectionSchema.index({ festival: 1, status: 1 });
SectionSchema.index({ "conditions.timeOfDay": 1 });