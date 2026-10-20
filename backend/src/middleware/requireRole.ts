import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

// Must run after requireAuth (needs req.auth populated).
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.roleName)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
    next();
  };
}
