import { Router } from 'express';
import { createCategory, getCategory, listCategories, updateCategory, deleteCategory } from '../controllers/category.controller';
import { validate } from '../middlewares/validate.middleware';
import { createCategorySchema, getCategorySchema, listCategoriesSchema, updateCategorySchema } from '../validations/category.validation';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticate, authorizeRole('ADMIN'), validate(createCategorySchema), createCategory);
router.get('/', validate(listCategoriesSchema), listCategories);
router.get('/:id', validate(getCategorySchema), getCategory);
router.put('/:id', authenticate, authorizeRole('ADMIN'), validate(updateCategorySchema), updateCategory);
router.delete('/:id', authenticate, authorizeRole('ADMIN'), validate(getCategorySchema), deleteCategory);

export default router;
