import { Router } from 'express';
import * as consentController from '../controllers/consent.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireTenant } from '../middleware/tenant.js';
import { validateCreateConsent } from '../middleware/validateConsent.js';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

router.get('/', consentController.list);
router.get('/:id/versions', consentController.getVersions);
router.get('/:id/links', consentController.listLinks);
router.get('/:id', consentController.getById);
router.post('/', validateCreateConsent, consentController.create);
router.patch('/:id', consentController.update);
router.delete('/:id', consentController.softDelete);
router.post('/:id/links', consentController.createLink);
router.patch('/:id/links/:linkId', consentController.updateLink);
router.post('/:id/links/:linkId/api-keys', consentController.createApiKey);
router.patch('/:id/links/:linkId/api-keys/:keyId', consentController.updateApiKey);

export default router;
