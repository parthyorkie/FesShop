import { Router } from "express";
import {
    createSection,
    deleteSection,
    getSection,
    listSections,
    updateSection,
} from "../controllers/section.controller";

import { authenticate, authorizeRole } from "../middlewares/auth.middleware";

const router = Router();

/**
 * ✅ Create Section (Admin only)
 */
router.post(
  "/",
  authenticate,
  authorizeRole("ADMIN"),
  createSection
);

/**
 * ✅ List Sections (Public / can be filtered via query)
 */
router.get("/", listSections);

/**
 * ✅ Get Section by ID
 */
router.get("/:id", getSection);

/**
 * ✅ Update Section (Admin only)
 */
router.put(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  updateSection
);

/**
 * ✅ Delete Section (Admin only)
 */
router.delete(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  deleteSection
);

export default router;