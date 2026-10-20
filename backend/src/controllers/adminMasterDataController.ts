import type { Request, Response } from 'express';
import * as service from '../services/adminMasterDataService.js';
import { logAction } from '../services/systemLogService.js';
import {
  buyerSchema,
  fundAccountSchema,
  idParamSchema,
  masterListQuerySchema,
  systemSettingSchema,
  villageAreaSchema,
  wastePriceHistorySchema,
} from '../validators/adminMasterDataValidators.js';
import { z } from 'zod';

const priceHistoryQuerySchema = masterListQuerySchema.extend({
  wasteTypeId: z.coerce.number().int().positive().optional(),
  buyerId: z.coerce.number().int().positive().optional(),
});

export async function listBuyers(req: Request, res: Response) {
  res.json(await service.listBuyers(masterListQuerySchema.parse(req.query)));
}

export async function createBuyer(req: Request, res: Response) {
  const buyer = await service.createBuyer(buyerSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'CREATE', module: 'AdminMasterData', action: 'Create Buyer', targetId: String(buyer.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(buyer);
}

export async function updateBuyer(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const buyer = await service.updateBuyer(id, buyerSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Update Buyer', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(buyer);
}

export async function deactivateBuyer(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deactivateBuyer(id);
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Deactivate Buyer', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(204).send();
}

export async function listVillageAreas(req: Request, res: Response) {
  res.json(await service.listVillageAreas(masterListQuerySchema.parse(req.query)));
}

export async function createVillageArea(req: Request, res: Response) {
  const area = await service.createVillageArea(villageAreaSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'CREATE', module: 'AdminMasterData', action: 'Create Village Area', targetId: String(area.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(area);
}

export async function updateVillageArea(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const area = await service.updateVillageArea(id, villageAreaSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Update Village Area', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(area);
}

export async function deactivateVillageArea(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deactivateVillageArea(id);
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Deactivate Village Area', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(204).send();
}

export async function listFundAccounts(req: Request, res: Response) {
  res.json(await service.listFundAccounts(masterListQuerySchema.parse(req.query)));
}

export async function createFundAccount(req: Request, res: Response) {
  const account = await service.createFundAccount(fundAccountSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'CREATE', module: 'AdminMasterData', action: 'Create Fund Account', targetId: String(account.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(account);
}

export async function updateFundAccount(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const account = await service.updateFundAccount(id, fundAccountSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Update Fund Account', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(account);
}

const roleSchema = z.object({
  roleName: z.string().min(1),
  description: z.string().optional(),
});

export async function listRoles(_req: Request, res: Response) {
  res.json(await service.listRoles());
}

export async function createRole(req: Request, res: Response) {
  const role = await service.createRole(roleSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'CREATE', module: 'AdminMasterData', action: 'Create Role', targetId: String(role.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(role);
}

export async function updateRole(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const role = await service.updateRole(id, roleSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Update Role', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(role);
}

export async function deleteRole(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deleteRole(id);
  await logAction({ userId: req.auth?.userId, actionType: 'DELETE', module: 'AdminMasterData', action: 'Delete Role', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(204).send();
}

export async function listSystemSettings(req: Request, res: Response) {
  res.json(await service.listSystemSettings(masterListQuerySchema.parse(req.query)));
}

export async function upsertSystemSetting(req: Request, res: Response) {
  const setting = await service.upsertSystemSetting(systemSettingSchema.parse(req.body), req.auth!.userId);
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Upsert System Setting', targetId: String(setting.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(setting);
}

export async function deleteSystemSetting(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deleteSystemSetting(id);
  await logAction({ userId: req.auth?.userId, actionType: 'DELETE', module: 'AdminMasterData', action: 'Delete System Setting', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(204).send();
}

export async function listWastePriceHistories(req: Request, res: Response) {
  res.json(await service.listWastePriceHistories(priceHistoryQuerySchema.parse(req.query)));
}

export async function createWastePriceHistory(req: Request, res: Response) {
  const history = await service.createWastePriceHistory(wastePriceHistorySchema.parse(req.body), req.auth!.userId);
  await logAction({ userId: req.auth?.userId, actionType: 'CREATE', module: 'AdminMasterData', action: 'Create Waste Price History', targetId: String(history.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(history);
}

const memberTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function listMemberTypes(_req: Request, res: Response) {
  res.json(await service.listMemberTypes());
}

export async function createMemberType(req: Request, res: Response) {
  const memberType = await service.createMemberType(memberTypeSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'CREATE', module: 'AdminMasterData', action: 'Create Member Type', targetId: String(memberType.id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(memberType);
}

export async function updateMemberType(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const memberType = await service.updateMemberType(id, memberTypeSchema.parse(req.body));
  await logAction({ userId: req.auth?.userId, actionType: 'UPDATE', module: 'AdminMasterData', action: 'Update Member Type', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(memberType);
}

export async function deleteMemberType(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deleteMemberType(id);
  await logAction({ userId: req.auth?.userId, actionType: 'DELETE', module: 'AdminMasterData', action: 'Delete Member Type', targetId: String(id), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(204).send();
}
