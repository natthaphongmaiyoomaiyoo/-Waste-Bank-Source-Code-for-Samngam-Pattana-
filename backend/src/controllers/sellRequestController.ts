import type { Request, Response } from 'express';
import * as sellRequestService from '../services/sellRequestService.js';
import {
  createSellRequestSchema,
  sellRequestListQuerySchema,
} from '../validators/sellRequestValidators.js';

export async function create(req: Request, res: Response) {
  const input = createSellRequestSchema.parse(req.body);
  const request = await sellRequestService.create(req.auth!.memberId!, input);
  res.status(201).json(request);
}

export async function list(req: Request, res: Response) {
  const { page, ...query } = sellRequestListQuerySchema.parse(req.query);
  const memberId = req.auth!.memberId!;
  res.json(
    page
      ? await sellRequestService.listPage(memberId, { page, ...query })
      : await sellRequestService.list(memberId),
  );
}

export async function summary(req: Request, res: Response) {
  res.json(await sellRequestService.summary(req.auth!.memberId!));
}

export async function cancel(req: Request, res: Response) {
  const id = Number(req.params.id);
  const request = await sellRequestService.cancel(req.auth!.memberId!, id);
  res.json(request);
}
