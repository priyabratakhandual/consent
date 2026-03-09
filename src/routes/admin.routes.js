import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';

const router = Router();
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/stats', adminController.getStats);
router.get('/tenants', adminController.listTenants);
router.patch('/tenants/:tenantId', adminController.updateTenantStatus);
router.get('/tenants/:tenantId/users', adminController.listTenantUsers);
router.get('/tenants/:tenantId/consents', adminController.listTenantConsents);

export default router;
