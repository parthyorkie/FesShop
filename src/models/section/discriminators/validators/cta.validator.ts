import mongoose, { Types } from "mongoose";

const MODEL_MAP: Record<string, string> = {
  product: "Product",
  category: "Category",
};

export const validateCTAValue = async function (
  this: any, 
  value: Types.ObjectId
): Promise<boolean> {
  try {
    console.log("this:", this);
console.log("parent:", this.parent?.());
console.log("value:", value);
    // 🔥 Always resolve correct parent
    const parent = typeof this.parent === "function" ? this.parent() : this;

    // 🔥 Resolve type
    let type: "product" | "category" | undefined;

    console.log("Parent for CTA validation:", parent);

    if (this?.cta?.type) {
      type = this.cta.type;
    } else if (this?.product) {
      type = "product";
    }

    if (!type) return false;

    const modelName = MODEL_MAP[type];
    if (!modelName) return false;

    // 🔥 Ensure model exists
    if (!mongoose.models[modelName]) {
      console.error(`Model not registered: ${modelName}`);
      return false;
    }

    const exists = await mongoose.models[modelName].exists({
      _id: value,
    });

    return !!exists;
  } catch (err) {
    console.error("CTA validation error:", err);
    return false;
  }
};