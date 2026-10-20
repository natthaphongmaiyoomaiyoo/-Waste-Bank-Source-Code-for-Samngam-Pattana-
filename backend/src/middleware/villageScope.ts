import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

// Village-level data isolation for the committee role.
//
// Structure this enforces: one municipality -> many villages (village_area,
// admin-maintained master data) -> one committee per village. A committee
// account is bound to exactly one village_area row (user_account.village_area_id),
// and may only see/act on members whose household sits in that village.
//
// Members are matched to a village by household.moo, the field the member
// address form already fills from the village master data (see
// frontend villageAreaStore.villageMooOptions) - no duplicate member->village
// column is introduced.
//
// `null` scope = unrestricted (admin), which is why every consumer takes
// `VillageScope | null` rather than an optional argument: forgetting to pass it
// is a type error, not a silent security hole.

export interface VillageScope {
  villageAreaId: number;
  villageName: string;
  moo: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by requireVillageScope: null means "no restriction" (admin).
      villageScope?: VillageScope | null;
    }
  }
}

export const NO_VILLAGE_ASSIGNED_MESSAGE =
  'บัญชีกรรมการนี้ยังไม่ได้กำหนดหมู่บ้านที่รับผิดชอบ กรุณาติดต่อผู้ดูแลระบบ';
export const VILLAGE_INACTIVE_MESSAGE =
  'หมู่บ้านที่รับผิดชอบถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
export const OUT_OF_VILLAGE_MESSAGE = 'ไม่มีสิทธิ์เข้าถึงข้อมูลของหมู่บ้านอื่น';

// Must run after requireAuth. Admins keep full access; committee accounts are
// pinned to their own village and are blocked outright when the admin has not
// assigned one, or has since deactivated the village they were assigned to
// (village status is re-read from the DB on every request, so revoking access
// is immediate rather than at the next login).
export function requireVillageScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    throw ApiError.unauthorized('Missing bearer token');
  }

  if (req.auth.roleName !== 'committee') {
    req.villageScope = null;
    next();
    return;
  }

  const village = req.authVillageArea;
  if (!village) {
    throw ApiError.forbidden(NO_VILLAGE_ASSIGNED_MESSAGE);
  }
  if (village.status !== 'active') {
    throw ApiError.forbidden(VILLAGE_INACTIVE_MESSAGE);
  }

  req.villageScope = {
    villageAreaId: village.id,
    villageName: village.villageName,
    // Address text only (used to pre-fill / validate the member address form).
    // Permissions key off villageAreaId - see villageScopeService.
    moo: village.moo?.trim() ?? '',
  };
  next();
}

// Reads the scope requireVillageScope stored. Throws rather than silently
// widening access if the middleware was not wired up on the route.
export function villageScopeOf(req: Request): VillageScope | null {
  if (req.villageScope === undefined) {
    throw ApiError.forbidden('Village scope is not resolved for this request');
  }
  return req.villageScope;
}
