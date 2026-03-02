import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import tenantRoutes from './tenant.routes.js';
import consentRoutes from './consent.routes.js';
import templateRoutes from './template.routes.js';
import publicShareRoutes from './publicShare.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/tenants', tenantRoutes);
router.use('/consents', consentRoutes);
router.use('/templates', templateRoutes);
router.use('/public', publicShareRoutes);

export default router;
