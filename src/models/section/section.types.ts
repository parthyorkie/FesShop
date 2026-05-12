// src/models/section/section.types.ts
import { Schema } from "mongoose";

export interface SectionConditions {
  timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
  userType?: ("new" | "active")[];
  platform?: ("android" | "ios")[];
}

export interface DataSource {
  type: "static" | "dynamic";
  ref?: string;
}

export type LayoutConfig = {
  columns?: number;          // grid
  itemSpacing?: number;
  scrollDirection?: "horizontal" | "vertical";
  aspectRatio?: number;      // banner
  height?: number;           // banner
  autoScroll?: boolean;      // banner
  visibleItems?: number;     // horizontal list
  threshold?: number;  
  // Title styling
   title?: {
    fontSize?: number;
    fontWeight?: "400" | "500" | "600" | "700" | "800";
    color?: string;
    align?: "left" | "center" | "right";
    marginBottom?: number;
    marginHorizontal?: number;
    textTransform?: "none" | "uppercase" | "capitalize";
  };// your use-case
};

export interface SectionDocument {
  _id: string;
  type: string;
  layoutConfig?: LayoutConfig;
  title?: string;
  displayOrder: number;
  priority: number;
  status: "draft" | "published" | "archived";
  isActive: boolean;
  // festival?: any;
  festival: {
      type: Schema.Types.ObjectId,
      ref: "Festival",
      required: false,
      index: true,
    },
  conditions?: SectionConditions;
  dataSource: DataSource;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}