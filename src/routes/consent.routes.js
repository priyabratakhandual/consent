import { Router } from 'express';
import * as consentController from '../controllers/consent.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

router.get('/', consentController.list);
router.post('/', consentController.create);

export default router;
