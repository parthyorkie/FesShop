import { Router } from "express";
import {
    createFestival,
    deleteFestival,
    getFestival,
    listFestivals,
    updateFestival,
} from "../controllers/festival.controller";

import { validate } from "../middlewares/validate.middleware";
import {
    createFestivalSchema,
    getFestivalSchema,
    listFestivalsSchema,
    updateFestivalSchema,
} from "../validations/festival.validation";

import { authenticate, authorizeRole } from "../middlewares/auth.middleware";

const router = Router();

// 🔹 Create Festival
router.post(
  "/",
  authenticate,
  authorizeRole("ADMIN"),
  validate(createFestivalSchema),
  createFestival
);

// 🔹 List Festivals
router.get(
  "/",
  validate(listFestivalsSchema),
  listFestivals
);

// 🔹 Get Festival by ID
router.get(
  "/:id",
  validate(getFestivalSchema),
  getFestival
);

// 🔹 Update Festival
router.put(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(updateFestivalSchema),
  updateFestival
);

// 🔹 Delete Festival (Soft Delete)
router.delete(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(getFestivalSchema),
  deleteFestival
);

export default router;