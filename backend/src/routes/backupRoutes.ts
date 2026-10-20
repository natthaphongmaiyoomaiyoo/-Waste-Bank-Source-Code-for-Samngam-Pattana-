import { Router } from 'express';
import { backupUnavailable } from '../controllers/backupController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.all('*', backupUnavailable);
export default router;
