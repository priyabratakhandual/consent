import { Router } from 'express';
import * as consentController from '../controllers/consent.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';
import { validateCreateConsent } from '../middleware/validateConsent.js';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

router.get('/', consentController.list);
router.get('/:id', consentController.getById);
router.post('/', validateCreateConsent, consentController.create);

export default router;
