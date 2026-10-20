import { Router } from 'express';
import * as controller from '../controllers/adminMasterDataController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminMasterDataRoutes = Router();

adminMasterDataRoutes.use(requireAuth, requireRole('admin'));

adminMasterDataRoutes.get('/buyers', asyncHandler(controller.listBuyers));
adminMasterDataRoutes.post('/buyers', asyncHandler(controller.createBuyer));
adminMasterDataRoutes.put('/buyers/:id', asyncHandler(controller.updateBuyer));
adminMasterDataRoutes.delete('/buyers/:id', asyncHandler(controller.deactivateBuyer));

adminMasterDataRoutes.get('/village-areas', asyncHandler(controller.listVillageAreas));
adminMasterDataRoutes.post('/village-areas', asyncHandler(controller.createVillageArea));
adminMasterDataRoutes.put('/village-areas/:id', asyncHandler(controller.updateVillageArea));
adminMasterDataRoutes.delete('/village-areas/:id', asyncHandler(controller.deactivateVillageArea));

adminMasterDataRoutes.get('/fund-accounts', asyncHandler(controller.listFundAccounts));
adminMasterDataRoutes.post('/fund-accounts', asyncHandler(controller.createFundAccount));
adminMasterDataRoutes.put('/fund-accounts/:id', asyncHandler(controller.updateFundAccount));

adminMasterDataRoutes.get('/roles', asyncHandler(controller.listRoles));
adminMasterDataRoutes.post('/roles', asyncHandler(controller.createRole));
adminMasterDataRoutes.put('/roles/:id', asyncHandler(controller.updateRole));
adminMasterDataRoutes.delete('/roles/:id', asyncHandler(controller.deleteRole));

adminMasterDataRoutes.get('/settings', asyncHandler(controller.listSystemSettings));
adminMasterDataRoutes.post('/settings', asyncHandler(controller.upsertSystemSetting));
adminMasterDataRoutes.delete('/settings/:id', asyncHandler(controller.deleteSystemSetting));

adminMasterDataRoutes.get('/waste-price-history', asyncHandler(controller.listWastePriceHistories));
adminMasterDataRoutes.post('/waste-price-history', asyncHandler(controller.createWastePriceHistory));

adminMasterDataRoutes.get('/member-types', asyncHandler(controller.listMemberTypes));
adminMasterDataRoutes.post('/member-types', asyncHandler(controller.createMemberType));
adminMasterDataRoutes.put('/member-types/:id', asyncHandler(controller.updateMemberType));
adminMasterDataRoutes.delete('/member-types/:id', asyncHandler(controller.deleteMemberType));
