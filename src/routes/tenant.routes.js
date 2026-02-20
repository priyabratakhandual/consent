import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateCreateTenant } from '../middleware/validateTenant.js';

const router = Router();

router.use(authenticate);

router.post('/', validateCreateTenant, tenantController.create);
router.get('/', tenantController.list);
router.post('/switch', tenantController.switchTenant);

export default router;
