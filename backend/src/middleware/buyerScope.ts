import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Shop-level data isolation for the buyer role, mirroring villageScope for the
// committee role: a 'buyer' login is bound to exactly one `buyer` row
// (user_account.buyer_id) and only ever sees the pickup route plans addressed to
// that shop.
//
// `null` scope = unrestricted (admin), which is why consumers take
// `BuyerScope | null` rather than an optional argument - forgetting to pass it
// is a type error, not a silent security hole.

export interface BuyerScope {
  buyerId: number;
  buyerName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by requireBuyerScope: null means "no restriction" (admin).
      buyerScope?: BuyerScope | null;
    }
  }
}

export const NO_BUYER_ASSIGNED_MESSAGE =
  'บัญชีผู้รับซื้อนี้ยังไม่ได้ผูกกับร้านรับซื้อ กรุณาติดต่อผู้ดูแลระบบ';
export const BUYER_INACTIVE_MESSAGE = 'ร้านรับซื้อที่ผูกกับบัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';

// Must run after requireAuth. The shop is re-read from the DB on every request
// (not cached in the JWT) so an admin re-assigning or deactivating a shop takes
// effect immediately rather than at the next login - same reasoning as
// requireVillageScope.
export const requireBuyerScope = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw ApiError.unauthorized('Missing bearer token');
    }

    if (req.auth.roleName !== 'buyer') {
      req.buyerScope = null;
      next();
      return;
    }

    const account = await prisma.userAccount.findUnique({
      where: { id: req.auth.userId },
      select: { buyer: { select: { id: true, buyerName: true, status: true } } },
    });

    const buyer = account?.buyer;
    if (!buyer) {
      throw ApiError.forbidden(NO_BUYER_ASSIGNED_MESSAGE);
    }
    if (buyer.status !== 'active') {
      throw ApiError.forbidden(BUYER_INACTIVE_MESSAGE);
    }

    req.buyerScope = { buyerId: buyer.id, buyerName: buyer.buyerName };
    next();
  },
);

// Reads the scope requireBuyerScope stored. Throws rather than silently widening
// access if the middleware was not wired up on the route.
export function buyerScopeOf(req: Request): BuyerScope | null {
  if (req.buyerScope === undefined) {
    throw ApiError.forbidden('Buyer scope is not resolved for this request');
  }
  return req.buyerScope;
}
