import { Router } from 'express';
import * as adminMasterDataService from '../services/adminMasterDataService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { masterListQuerySchema } from '../validators/adminMasterDataValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const masterDataRoutes = Router();

masterDataRoutes.use(requireAuth, requireRole('admin', 'committee', 'municipality'));

masterDataRoutes.get(
  '/village-areas',
  asyncHandler(async (req, res) => {
    const query = masterListQuerySchema.parse(req.query);
    res.json(
      await adminMasterDataService.listVillageAreas({
        ...query,
        status: 'active',
      }),
    );
  }),
);
