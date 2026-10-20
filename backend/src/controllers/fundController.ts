import type { Request, Response } from 'express';
import * as fundService from '../services/fundService.js';
import { memberHistoryQuerySchema } from '../validators/sellRequestValidators.js';

export async function getBalance(req: Request, res: Response) {
  const balance = await fundService.getBalance(req.auth!.memberId!);
  res.json(balance);
}

export async function listTransactions(req: Request, res: Response) {
  const { page, ...query } = memberHistoryQuerySchema.parse(req.query);
  const memberId = req.auth!.memberId!;
  res.json(
    page
      ? await fundService.listTransactionsPage(memberId, { page, ...query })
      : await fundService.listTransactions(memberId),
  );
}

