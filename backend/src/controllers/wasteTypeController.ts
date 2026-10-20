import type { Request, Response } from 'express';
import * as wasteTypeService from '../services/wasteTypeService.js';
import {
  createWasteTypeSchema,
  proposalListQuerySchema,
  proposeWasteTypeSchema,
  rejectWasteTypeSchema,
  reviewWasteTypeSchema,
  updateWasteTypeSchema,
  wasteTypeIdParamSchema,
} from '../validators/wasteTypeValidators.js';

export async function list(_req: Request, res: Response) {
  res.json(await wasteTypeService.listActive());
}

export async function create(req: Request, res: Response) {
  const input = createWasteTypeSchema.parse(req.body);
  res.status(201).json(await wasteTypeService.create(input));
}

export async function update(req: Request, res: Response) {
  const { id } = wasteTypeIdParamSchema.parse(req.params);
  const input = updateWasteTypeSchema.parse(req.body);
  res.json(await wasteTypeService.update(id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = wasteTypeIdParamSchema.parse(req.params);
  await wasteTypeService.deactivate(id);
  res.status(204).send();
}

// --- Buyer proposals ---

export async function propose(req: Request, res: Response) {
  const input = proposeWasteTypeSchema.parse(req.body);
  res.status(201).json(await wasteTypeService.propose(req.auth!.userId, input));
}

export async function listOwnProposals(req: Request, res: Response) {
  res.json(await wasteTypeService.listOwnProposals(req.auth!.userId));
}

// --- Admin review ---

export async function listProposals(req: Request, res: Response) {
  const { status } = proposalListQuerySchema.parse(req.query);
  res.json(await wasteTypeService.listProposals(status));
}

export async function approveProposal(req: Request, res: Response) {
  const { id } = wasteTypeIdParamSchema.parse(req.params);
  const input = reviewWasteTypeSchema.parse(req.body ?? {});
  res.json(await wasteTypeService.approveProposal(id, req.auth!.userId, input));
}

export async function rejectProposal(req: Request, res: Response) {
  const { id } = wasteTypeIdParamSchema.parse(req.params);
  const input = rejectWasteTypeSchema.parse(req.body);
  res.json(await wasteTypeService.rejectProposal(id, req.auth!.userId, input));
}
