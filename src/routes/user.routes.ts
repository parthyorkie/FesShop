import { Router } from 'express';
import {
    changePassword,
    createUser,
    deleteUser,
    getUser,
    listUsers,
    updateUser,
} from '../controllers/user.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    changePasswordSchema,
    createUserSchema,
    deleteUserSchema,
    getUserSchema,
    listUsersSchema,
    updateUserSchema,
} from '../validations/user.validation';

const router = Router();

// 📝 Admin CRUD Operations
router.post(
  '/',
  authenticate,
  authorizeRole('ADMIN'),
  validate(createUserSchema),
  createUser
);

router.get(
  '/',
  authenticate,
  authorizeRole('ADMIN'),
  validate(listUsersSchema),
  listUsers
);

router.get(
  '/:id',
  authenticate,
  authorizeRole('ADMIN'),
  validate(getUserSchema),
  getUser
);

router.put(
  '/:id',
  authenticate,
  authorizeRole('ADMIN'),
  validate(updateUserSchema),
  updateUser
);

router.delete(
  '/:id',
  authenticate,
  authorizeRole('ADMIN'),
  validate(deleteUserSchema),
  deleteUser
);

// 🔐 User Password Management (Authenticated users can change their own password)
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

export default router;
