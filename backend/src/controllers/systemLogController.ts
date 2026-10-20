import { Request, Response } from 'express';
import { z } from 'zod';
import { getSystemLogs, listSystemLogs } from '../services/systemLogService.js';

// Opt-in paging: without `page` the latest 500 rows come back as before.
const systemLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().trim().min(1).max(100).optional(),
  actionType: z.string().trim().min(1).max(50).optional(),
  descending: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const getLogs = async (req: Request, res: Response) => {
  const { page, ...query } = systemLogQuerySchema.parse(req.query);
  try {
    res.json(page ? await listSystemLogs({ page, ...query }) : await getSystemLogs());
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
};
