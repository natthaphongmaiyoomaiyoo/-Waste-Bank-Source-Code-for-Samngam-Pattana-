import type { Request, Response } from 'express';
import * as historyService from '../services/historyService.js';
import { ApiError } from '../utils/ApiError.js';
import { memberHistoryQuerySchema } from '../validators/sellRequestValidators.js';

export async function listSales(req: Request, res: Response) {
  const { page, ...query } = memberHistoryQuerySchema.parse(req.query);
  const memberId = req.auth!.memberId!;
  res.json(
    page
      ? await historyService.listSalesPage(memberId, { page, ...query })
      : await historyService.listSales(memberId),
  );
}

export async function getSale(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.notFound('Sale not found');
  const sale = await historyService.getSale(req.auth!.memberId!, id);
  res.json(sale);
}
