import { Router } from 'express';
import * as publicShareController from '../controllers/publicShare.controller.js';

const router = Router();

router.get('/share/:token', publicShareController.getByToken);
router.post('/share/:token/accept', publicShareController.acceptByToken);
router.post('/share/:token/revoke', publicShareController.revokeByToken);
router.post('/consentee/login', publicShareController.consenteeLogin);

export default router;
