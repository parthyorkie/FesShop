import mongoose from "mongoose";
import { SectionSchema } from "./section.schema";

import { registerBannerDiscriminator } from "./discriminators/banner.schema";
import { registerGridDiscriminator } from "./discriminators/grid.schema";
import { registerHorizontalDiscriminator } from "./discriminators/horizontal.schema";

export const SectionModel =
  mongoose.models.Section ||
  mongoose.model("Section", SectionSchema);

// ✅ Register ALL discriminators AFTER model creation
registerBannerDiscriminator(SectionModel);
registerGridDiscriminator(SectionModel);
registerHorizontalDiscriminator(SectionModel);