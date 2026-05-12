import mongoose from "mongoose";
import { validateCTAValue } from "./validators/cta.validator";

export const registerGridDiscriminator = (
  SectionModel: mongoose.Model<any>,
) => {
  const GridSchema = new mongoose.Schema({
    columns: { type: Number, default: 2 },

    items: [
      {
        title: { type: String },
        image: { type: String, required: true },
        cta: {
          type: {
            type: String,
            enum: ["product", "category"],
          },
          value: {
            type: mongoose.Schema.Types.ObjectId,
            validate: {
              validator: validateCTAValue,
              message: "Invalid CTA reference",
            },
          },
        },
      },
    ],
  });

  SectionModel.discriminator("grid", GridSchema);
};
