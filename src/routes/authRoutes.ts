import { Router } from 'express';
import { forgotPassword, login, logout, register, resetPassword, googleLogin, getMe } from '../controllers/authController';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Google Auth Route
router.post('/google', googleLogin);

// Protected Me Route
router.get('/me', authenticate, getMe);

export default router;
