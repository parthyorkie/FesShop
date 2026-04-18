import { Router } from "express";
import {
    createOrder,
    deleteOrder,
    getOrder,
    listOrders,
    updateOrder,
} from "../controllers/order.controller";

import { validate } from "../middlewares/validate.middleware";
import {
    createOrderSchema,
    deleteOrderSchema,
    getOrderSchema,
    listOrdersSchema,
    updateOrderSchema,
} from "../validations/order.validation";

import { authenticate, authorizeRole } from "../middlewares/auth.middleware";

const router = Router();


// ✅ CREATE ORDER
router.post(
  "/",
  authenticate,
  authorizeRole("ADMIN"), // 🔥 or remove if cashier/user can create
  validate(createOrderSchema),
  createOrder
);


// ✅ LIST ORDERS
router.get(
  "/",
  validate(listOrdersSchema),
  listOrders
);


// ✅ GET SINGLE ORDER
router.get(
  "/:id",
  validate(getOrderSchema),
  getOrder
);


// ✅ UPDATE ORDER
router.put(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(updateOrderSchema),
  updateOrder
);


// ✅ DELETE ORDER (SOFT DELETE)
router.delete(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(deleteOrderSchema),
  deleteOrder
);


export default router;