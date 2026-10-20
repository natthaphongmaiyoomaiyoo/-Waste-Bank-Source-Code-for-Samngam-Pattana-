import type { Request, Response } from 'express';

export function backupUnavailable(_req: Request, res: Response) {
  res.status(501).json({
    error: 'Backup and restore are temporarily unavailable for PostgreSQL. Use managed Supabase backups instead.',
  });
}
