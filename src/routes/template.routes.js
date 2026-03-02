import { Router } from 'express';
import * as templateController from '../controllers/template.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', templateController.list);

export default router;
