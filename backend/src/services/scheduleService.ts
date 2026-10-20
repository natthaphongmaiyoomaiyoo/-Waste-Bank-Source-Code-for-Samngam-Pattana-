import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import {
  COLLECTION_ROUND_STATUS,
  SELL_REQUEST_ADVANCE_DAYS,
} from "../config/constants.js";
export function roundVisibilityWhere(
  villageAreaId: number | null,
): Prisma.CollectionRoundWhereInput {
  return villageAreaId
    ? { OR: [{ villageAreaId }, { villageAreaId: null }] }
    : { villageAreaId: null };
}

// The village a member's household belongs to (null for non-member accounts or
// households not linked to a village yet).
export async function villageAreaIdOfMember(
  memberId: number | null,
): Promise<number | null> {
  if (!memberId) return null;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { household: { select: { villageAreaId: true } } },
  });
  return member?.household?.villageAreaId ?? null;
}

// A round only accepts sell requests once it is within SELL_REQUEST_ADVANCE_DAYS.
// The schedule list (openForRequest below) and the booking step
// (sellRequestService.create) both read the window from here so the list can
// never offer a round the booking step would reject.
export function sellRequestWindow() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const until = new Date(from);
  until.setDate(until.getDate() + SELL_REQUEST_ADVANCE_DAYS);
  until.setHours(23, 59, 59, 999);

  return { from, until };
}

// First day a member can book this round - the round's date minus the window.
export function requestOpensOn(roundDate: Date): Date {
  const opens = new Date(roundDate);
  opens.setDate(opens.getDate() - SELL_REQUEST_ADVANCE_DAYS);
  return opens;
}

// A round also stops taking requests when its own time window closes: one dated
// today running 09:00-17:00 is over at 17:00, even though nothing flips its
// status until the committee marks it completed.
export function roundWindowEnded(
  round: { roundDate: Date; endTime: string },
  now = new Date(),
): boolean {
  const [hours, minutes] = round.endTime.split(':').map(Number);
  const end = new Date(round.roundDate);
  end.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return end < now;
}

export async function listUpcoming(viewer: {
  memberId: number | null;
  roleName: string;
}) {
  const { from: startOfToday, until } = sellRequestWindow();

  // Admin / municipality oversee every village; a committee sees its own
  // village's schedule through /committee/rounds, so here they are treated like
  // the member view of whatever village they belong to.
  const seesEverything =
    viewer.roleName === "admin" || viewer.roleName === "municipality";
  const villageAreaId = seesEverything
    ? null
    : await villageAreaIdOfMember(viewer.memberId);

  const rounds = await prisma.collectionRound.findMany({
    where: {
      status: {
        in: [
          COLLECTION_ROUND_STATUS.PLANNED,
          COLLECTION_ROUND_STATUS.CANCELLED,
        ],
      },
      roundDate: { gte: startOfToday },
      ...(seesEverything ? {} : roundVisibilityWhere(villageAreaId)),
    },
    include: {
      buyer: { select: { buyerName: true } },
      villageArea: { select: { id: true, villageName: true, moo: true } },
    },
    orderBy: { roundDate: "asc" },
  });

  // Rounds further out than the window stay on the schedule so members can plan,
  // but are flagged as not yet bookable (with the date they open).
  return rounds.map((round) => ({
    ...round,
    openForRequest:
      round.status === COLLECTION_ROUND_STATUS.PLANNED &&
      round.roundDate <= until &&
      !roundWindowEnded(round),
    requestOpensOn: requestOpensOn(round.roundDate),
  }));
}
