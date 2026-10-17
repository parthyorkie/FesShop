import { Router } from "express";
import {
  createRazorpayOrder,
  razorpayWebhook,
  verifyPayment,
} from "../controllers/payment.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createRazorpayOrderSchema,
  verifyPaymentSignatureSchema,
} from "../validations/payment.validation";

const router = Router();

router.post("/create-order", authenticate, validate(createRazorpayOrderSchema), createRazorpayOrder);
router.post("/verify", authenticate, validate(verifyPaymentSignatureSchema), verifyPayment);
router.post("/webhook", razorpayWebhook);

export default router;