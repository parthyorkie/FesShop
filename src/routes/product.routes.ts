import { Router } from 'express';
import { createProduct, getProduct, listProducts, updateProduct, deleteProduct } from '../controllers/product.controller';
import { validate } from '../middlewares/validate.middleware';
import { createProductSchema, getProductSchema, listProductsSchema, updateProductSchema } from '../validations/product.validation';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticate, authorizeRole('ADMIN'), validate(createProductSchema), createProduct);
router.get('/', validate(listProductsSchema), listProducts);
router.get('/:id', validate(getProductSchema), getProduct);
router.put('/:id', authenticate, authorizeRole('ADMIN'), validate(updateProductSchema), updateProduct);
router.delete('/:id', authenticate, authorizeRole('ADMIN'), validate(getProductSchema), deleteProduct);

export default router;
