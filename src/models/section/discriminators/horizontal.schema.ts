import mongoose from "mongoose";
import { validateCTAValue } from "./validators/cta.validator";

export const registerHorizontalDiscriminator = (
  SectionModel: mongoose.Model<any>,
) => {
  const HorizontalSchema = new mongoose.Schema({
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

  SectionModel.discriminator("horizontal_list", HorizontalSchema);
};
