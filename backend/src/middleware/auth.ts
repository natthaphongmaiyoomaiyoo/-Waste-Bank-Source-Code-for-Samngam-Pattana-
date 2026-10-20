import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { MEMBER_STATUS, USER_ACCOUNT_STATUS } from '../config/constants.js';
import { verifyAuthToken, type AuthTokenPayload } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// The village a committee account is responsible for, read fresh from the DB on
// every request (not from the JWT) so an admin re-assigning a committee takes
// effect immediately instead of at the next login.
export interface AuthVillageArea {
  id: number;
  villageName: string;
  moo: string | null;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
      // Current member.status from the DB (null for non-member roles).
      // Populated by requireAuth so requireActiveMember can gate features.
      memberStatus?: string | null;
      mustChangePassword?: boolean;
      // Populated by requireAuth; null for accounts with no village assigned.
      authVillageArea?: AuthVillageArea | null;
    }
  }
}

// Verifies the JWT AND re-checks user_account.status in the DB on every
// request, so cancelling a member or disabling an account revokes access immediately
// instead of only at the next login (tokens live for days).
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing bearer token');
  }

  const token = header.slice('Bearer '.length);

  let payload: AuthTokenPayload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const account = await prisma.userAccount.findUnique({
    where: { id: payload.userId },
    select: {
      status: true,
      mustChangePassword: true,
      member: { select: { status: true } },
      villageArea: { select: { id: true, villageName: true, moo: true, status: true } },
    },
  });
  if (!account || account.status !== USER_ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.unauthorized('Account is disabled');
  }
  if (account.member && account.member.status !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.unauthorized('Membership approval is required');
  }

  const passwordChangeAllowed =
    req.originalUrl === '/api/auth/me' || req.originalUrl === '/api/auth/password';
  if (account.mustChangePassword && !passwordChangeAllowed) {
    throw ApiError.forbidden('Password change is required before continuing');
  }

  req.auth = payload;
  req.memberStatus = account.member?.status ?? null;
  req.mustChangePassword = account.mustChangePassword;
  req.authVillageArea = account.villageArea ?? null;
  next();
});

// Must run after requireAuth. Gates member-only features for any non-active
// member status, including accounts issued before the login guard was added.
export function requireActiveMember(req: Request, _res: Response, next: NextFunction) {
  if (req.memberStatus !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Membership is not active yet');
  }
  next();
}
