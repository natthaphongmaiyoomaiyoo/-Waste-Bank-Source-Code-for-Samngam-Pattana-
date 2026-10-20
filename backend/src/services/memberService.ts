import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { publicFileUrl } from './storageService.js';
import type { UpdateProfileInput } from '../validators/memberValidators.js';

// Relative path under backend/uploads -> absolute URL, same pattern as
// newsService.serialize (imageUrl).
function serializeAvatarUrl(avatarUrl: string | null): string | null {
  return publicFileUrl('avatars', avatarUrl);
}

// Next running member code ("001", "002", ...). Members are never hard-deleted
// (cancel = status change), so count + 1 stays gap-free. Shared by the public
// register flow (authService) and the committee walk-in flow (committeeService).
export async function nextMemberCode(): Promise<string> {
  const count = await prisma.member.count();
  return String(count + 1).padStart(3, '0');
}

function isMemberCodeConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  const fields = (Array.isArray(target) ? target.join(',') : String(target ?? '')).toLowerCase();
  return fields.includes('member_code') || fields.includes('membercode');
}

// Two concurrent registrations can both read the same count and collide on the
// unique member_code. Retry with a freshly computed code instead of surfacing
// the raw Prisma P2002 as a 500.
export async function createWithNextMemberCode<T>(
  create: (memberCode: string) => Promise<T>,
): Promise<T> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    const memberCode = await nextMemberCode();
    try {
      return await create(memberCode);
    } catch (error) {
      if (attempt < MAX_ATTEMPTS && isMemberCodeConflict(error)) {
        continue;
      }
      throw error;
    }
  }
}

// A search term whose shape can only belong to one indexed column is answered
// by an equality lookup on that column alone. Postgres resolves that by walking
// the column's unique B-tree - a binary search, O(log n) - instead of testing
// LIKE '%term%' against every row of five columns.
//
// The lookup has to be exclusive to pay off: leaving one un-indexable LIKE in
// the OR forces a full scan anyway, index or no index. That exclusivity is why
// only the 13-digit citizen ID qualifies. A short numeric term looks exactly
// like both a zero-padded member code ("081") and the start of a phone number
// ("081..."), and the box filters as you type, so every numeric search passes
// through those lengths on its way in - routing them to member_code alone
// blanked the list mid-typing.
//
// Everything else - names, member codes, phone fragments, partial IDs - stays
// on the substring search below, which no B-tree can serve. That would need a
// pg_trgm GIN index instead.
export function memberSearchWhere(search: string): Prisma.MemberWhereInput {
  const term = search.trim();

  // Citizen ID: exactly 13 digits and unique. phone is free-form but never runs
  // that long, so a term of this shape cannot mean anything else.
  if (/^\d{13}$/.test(term)) {
    return { citizenId: term };
  }

  return {
    OR: [
      { firstName: { contains: term } },
      { lastName: { contains: term } },
      { citizenId: { contains: term } },
      { phone: { contains: term } },
      { memberCode: { contains: term } },
    ],
  };
}

export async function getProfile(memberId: number) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      household: true,
      guarantors: true,
      userAccount: {
        select: { username: true, fullName: true, status: true, lastLogin: true, avatarUrl: true },
      },
    },
  });

  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  return { ...member, avatarUrl: serializeAvatarUrl(member.userAccount?.avatarUrl ?? null) };
}

export async function updateProfile(memberId: number, input: UpdateProfileInput) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  const { address, ...memberFields } = input;

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: {
      ...memberFields,
      ...(address ? { household: { update: address } } : {}),
    },
    include: { household: true, guarantors: true },
  });

  return updated;
}
