import { Router } from "express";
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from "../controllers/company.controller";

import { validate } from "../middlewares/validate.middleware";
import {
  createCompanySchema,
  getCompanySchema,
  listCompaniesSchema,
  updateCompanySchema,
} from "../validations/company.validation";

import { authenticate, authorizeRole } from "../middlewares/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  authorizeRole("ADMIN"),
  validate(createCompanySchema),
  createCompany
);

router.get("/", validate(listCompaniesSchema), listCompanies);

router.get("/:id", validate(getCompanySchema), getCompany);

router.put(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(updateCompanySchema),
  updateCompany
);

router.delete(
  "/:id",
  authenticate,
  authorizeRole("ADMIN"),
  validate(getCompanySchema),
  deleteCompany
);

export default router;