import mongoose from "mongoose";
const MODEL_MAP: Record<string, string> = {
  product: "Product",
  category: "Category",
};

export const registerBannerDiscriminator = (SectionModel: mongoose.Model<any>) => {
  const BannerSchema = new mongoose.Schema({
    items: [
      {
        image: { type: String, required: true },
        cta: {
          type: {
            type: String,
            enum: ["product", "category"],
          },
          // value: String,
          value: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,

            validate: {
              validator: async function (value: any) {
                console.log("Validating CTA reference:", this.cta,"gettingValue", value);
                // 🔥 FIX: get parent item
                const parent = this?.parent();
                const ctaType = this?.cta?.type;

                const modelName = MODEL_MAP[ctaType];
                console.log("Resolved model name for CTA validation:", ctaType);
                if (!modelName) return false;

                const exists = await mongoose
                  .model(modelName)
                  .exists({ _id: value });

                  console.log(`CTA validation for ${modelName} with ID ${value}:`, exists);
                return !!exists;
              },
              message: "Invalid CTA reference",
            },
          },
        },
      },
    ],
  });

  SectionModel.discriminator("banner", BannerSchema);
};