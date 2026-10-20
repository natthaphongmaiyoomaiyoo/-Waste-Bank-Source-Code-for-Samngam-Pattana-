import type { Request, Response } from 'express';
import * as adminCommitteeService from '../services/adminCommitteeService.js';
import { logAction } from '../services/systemLogService.js';
import {
  adminCommitteeCreateSchema,
  adminCommitteeIdParamSchema,
  adminCommitteeListQuerySchema,
  adminCommitteeUpdateSchema,
} from '../validators/adminCommitteeValidators.js';

const MODULE = 'CommitteeManagement';

function auditMeta(req: Request) {
  return { userId: req.auth?.userId, ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export async function listCommittees(req: Request, res: Response) {
  const query = adminCommitteeListQuerySchema.parse(req.query);
  res.json(await adminCommitteeService.listCommittees(query));
}

export async function getCommitteeSummary(_req: Request, res: Response) {
  res.json(await adminCommitteeService.getCommitteeSummary());
}

export async function getCommittee(req: Request, res: Response) {
  const { id } = adminCommitteeIdParamSchema.parse(req.params);
  res.json(await adminCommitteeService.getCommittee(id));
}

export async function createCommittee(req: Request, res: Response) {
  const input = adminCommitteeCreateSchema.parse(req.body);
  const committee = await adminCommitteeService.createCommittee(input);
  await logAction({
    ...auditMeta(req),
    actionType: 'CREATE',
    module: MODULE,
    action: 'Create village committee account',
    detail: `${committee.username} -> ${committee.villageArea?.villageName ?? '-'}`,
    targetId: String(committee.id),
  });
  res.status(201).json(committee);
}

export async function updateCommittee(req: Request, res: Response) {
  const { id } = adminCommitteeIdParamSchema.parse(req.params);
  const input = adminCommitteeUpdateSchema.parse(req.body);
  const committee = await adminCommitteeService.updateCommittee(id, input);
  await logAction({
    ...auditMeta(req),
    actionType: 'UPDATE',
    module: MODULE,
    action: 'Update village committee account',
    detail: `${committee.username} -> ${committee.villageArea?.villageName ?? '-'}`,
    targetId: String(id),
  });
  res.json(committee);
}

export async function toggleCommitteeStatus(req: Request, res: Response) {
  const { id } = adminCommitteeIdParamSchema.parse(req.params);
  const committee = await adminCommitteeService.toggleCommitteeStatus(id);
  await logAction({
    ...auditMeta(req),
    actionType: 'UPDATE',
    module: MODULE,
    action: 'Toggle village committee status',
    detail: `${committee.username} -> ${committee.status}`,
    targetId: String(id),
  });
  res.json(committee);
}

export async function deleteCommittee(req: Request, res: Response) {
  const { id } = adminCommitteeIdParamSchema.parse(req.params);
  await adminCommitteeService.deleteCommittee(id);
  await logAction({
    ...auditMeta(req),
    actionType: 'DELETE',
    module: MODULE,
    action: 'Delete village committee account',
    targetId: String(id),
  });
  res.status(204).send();
}
