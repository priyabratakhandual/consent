import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateRegister, validateLogin, validateRefresh } from '../middleware/validateAuth.js';
import { authRateLimiter } from '../middleware/security.js';

const router = Router();

// Apply stricter rate limit for auth endpoints
router.use(authRateLimiter);

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh', validateRefresh, authController.refresh);

// Protected
router.get('/me', authenticate, authController.me);

export default router;
