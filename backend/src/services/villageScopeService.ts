import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { OUT_OF_VILLAGE_MESSAGE, type VillageScope } from '../middleware/villageScope.js';

// Backend enforcement of "a village committee only touches its own village".
// Every committee endpoint either filters its list query through
// memberScopeWhere() or checks the single target row through one of the
// assert*InScope() helpers, so a hand-crafted URL / API call for another
// village's member is rejected even though the UI never offers it.
//
// The key is household.village_area_id - a real foreign key, not the `moo`
// string. `moo` is address text an admin can rename or reuse across villages;
// tying permissions to it meant a typo could silently hand one committee
// another village's members, or strand a village with none.

// Member-list filter: `{}` for admin, household FK match for a committee.
export function memberScopeWhere(scope: VillageScope | null): Prisma.MemberWhereInput {
  return scope ? { household: { villageAreaId: scope.villageAreaId } } : {};
}

// Household-list filter (same rule, one level up the relation).
export function householdScopeWhere(scope: VillageScope | null): Prisma.HouseholdWhereInput {
  return scope ? { villageAreaId: scope.villageAreaId } : {};
}

// Collection-round filter: a committee sees its own village's rounds plus the
// municipality-wide ones (village_area_id NULL), which any village may book;
// an admin (null scope) sees everything. Editing is stricter - see
// committeeRoundService.findEditableRound.
export function roundScopeWhere(scope: VillageScope | null): Prisma.CollectionRoundWhereInput {
  return scope ? { OR: [{ villageAreaId: scope.villageAreaId }, { villageAreaId: null }] } : {};
}

export async function assertMemberInScope(memberId: number, scope: VillageScope | null) {
  if (!scope) return;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, household: { select: { villageAreaId: true } } },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }
  if (member.household?.villageAreaId !== scope.villageAreaId) {
    throw ApiError.forbidden(OUT_OF_VILLAGE_MESSAGE);
  }
}

export async function assertHouseholdInScope(householdId: number, scope: VillageScope | null) {
  if (!scope) return;

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { villageAreaId: true },
  });
  if (!household) {
    throw ApiError.notFound('Household not found');
  }
  if (household.villageAreaId !== scope.villageAreaId) {
    throw ApiError.forbidden(OUT_OF_VILLAGE_MESSAGE);
  }
}

export async function assertSellRequestInScope(requestId: number, scope: VillageScope | null) {
  if (!scope) return;

  const request = await prisma.saleRequest.findUnique({
    where: { id: requestId },
    select: { member: { select: { household: { select: { villageAreaId: true } } } } },
  });
  if (!request) {
    throw ApiError.notFound('Sell request not found');
  }
  if (request.member.household?.villageAreaId !== scope.villageAreaId) {
    throw ApiError.forbidden(OUT_OF_VILLAGE_MESSAGE);
  }
}

export interface ResolvedAddressVillage {
  moo: string | undefined;
  villageAreaId: number | null;
}

// Works out which village a new/edited household address belongs to.
//
// Committee: always their own village - a blank moo is filled in from it, a
// foreign moo is refused outright, and the FK is stamped so the household stays
// theirs even if the moo text is edited later.
// Admin (no scope): the village is derived from the moo, but only when exactly
// one active village carries it. An ambiguous or unknown moo leaves the
// household unlinked rather than guessing an owner.
export async function resolveAddressVillage(
  moo: string | null | undefined,
  scope: VillageScope | null,
): Promise<ResolvedAddressVillage> {
  const trimmed = (moo ?? '').trim();

  if (scope) {
    if (trimmed && trimmed !== scope.moo) {
      throw ApiError.forbidden(
        `กรรมการหมู่บ้านเพิ่ม/แก้ไขที่อยู่ได้เฉพาะหมู่ ${scope.moo} (${scope.villageName}) เท่านั้น`,
      );
    }
    // A village with no moo recorded leaves the address text untouched - the
    // household is still bound to the village through the FK below.
    return { moo: scope.moo || undefined, villageAreaId: scope.villageAreaId };
  }

  if (!trimmed) {
    return { moo: undefined, villageAreaId: null };
  }

  const matches = await prisma.villageArea.findMany({
    where: { moo: trimmed, status: 'active' },
    select: { id: true },
    take: 2,
  });
  return { moo: trimmed, villageAreaId: matches.length === 1 ? matches[0]!.id : null };
}
