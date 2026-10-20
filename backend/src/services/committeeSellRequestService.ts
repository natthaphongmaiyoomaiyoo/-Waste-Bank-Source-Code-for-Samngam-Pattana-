import { prisma } from "../database/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { deleteStoredObject, privateFileUrl, storeUpload } from './storageService.js';
import {
  FUND_MINIMUM_BAHT,
  FUND_TRANSACTION_TYPE,
  SALE_REQUEST_STATUS,
} from "../config/constants.js";
import type {
  CommitteePurchaseInput,
  CommitteeSellRequestListQuery,
} from "../validators/committeeValidators.js";
import type { VillageScope } from "../middleware/villageScope.js";
import { memberScopeWhere } from "./villageScopeService.js";
import {
  activeRouteStopWhere,
  addRequestToRoundPlan,
  notifyStopAdded,
  removeRequestFromRoundPlan,
} from "./routePlanService.js";

// A request can be called off any time before it is completed.
const cancellableStatuses = [
  SALE_REQUEST_STATUS.REQUESTED,
  SALE_REQUEST_STATUS.CONFIRMED,
];

// The member never pinned where to collect: such a request can be accepted, but
// it can't be a stop on the round's run.
const withoutLocationWhere = {
  OR: [{ pickupLat: null }, { pickupLng: null }],
};

// Recording the weigh-in only makes sense once the committee has accepted the
// request and gone out to collect it, so 'requested' is not purchasable: accept
// it first (confirmRequest). The UI hides the form until then, and this is what
// stops a stale tab from posting a purchase against a request nobody took.
const purchasableStatuses = [SALE_REQUEST_STATUS.CONFIRMED];

const listInclude = {
  member: {
    select: {
      id: true,
      memberCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      phone: true,
      household: true,
    },
  },
  // Buyer name rides along so the route planner can show whose round each
  // request belongs to - a route plan may only ever go to one buyer.
  round: { include: { buyer: { select: { id: true, buyerName: true } } } },
  items: { include: { wasteType: true } },
};

const detailInclude = {
  ...listInclude,
  member: {
    select: {
      id: true,
      memberCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      phone: true,
      household: true,
      fundBalance: true,
    },
  },
  sale: {
    include: {
      details: { include: { wasteType: true } },
      receipt: true,
      documents: { orderBy: { uploadedAt: "asc" as const } },
    },
  },
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

// Sale and receipt numbers carry the Thai calendar date - pinned to
// Asia/Bangkok rather than the process timezone, so a server running on UTC
// still stamps a sale made at 01:00 Thai time with the day every screen shows.
const STAMP_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateStamp(date: Date): string {
  const parts = Object.fromEntries(
    STAMP_DATE_FORMAT.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

function appendNote(existing: string | null, prefix: string, note?: string) {
  if (!note) return existing ?? undefined;
  const entry = `${prefix}: ${note}`;
  return existing ? `${existing} | ${entry}` : entry;
}

async function notifyMember(memberId: number, title: string, message: string) {
  const account = await prisma.userAccount.findUnique({ where: { memberId } });
  if (!account) return;
  await prisma.notification.create({
    data: {
      userId: account.id,
      title,
      message,
      notificationType: "sell_request",
    },
  });
}

export async function listRequests(
  query: CommitteeSellRequestListQuery,
  scope: VillageScope | null,
) {
  const { page, pageSize } = query;
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.roundId ? { roundId: query.roundId } : {}),
    ...(query.unrouted ? { routeStops: { none: activeRouteStopWhere } } : {}),
    ...(query.located === false ? withoutLocationWhere : {}),
    // Search and village scope both constrain `member` - merge them so one
    // does not overwrite the other.
    member: {
      ...memberScopeWhere(scope),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search } },
              { lastName: { contains: query.search } },
              { memberCode: { contains: query.search } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    },
  };

  const [total, items] = await Promise.all([
    prisma.saleRequest.count({ where }),
    prisma.saleRequest.findMany({
      where,
      include: listInclude,
      orderBy: { requestDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

export async function getRequestsSummary(
  scope: VillageScope | null,
  roundId?: number,
) {
  const grouped = await prisma.saleRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: {
      ...(roundId ? { roundId } : {}),
      ...(scope ? { member: memberScopeWhere(scope) } : {}),
    },
  });

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
    total += row._count._all;
  }

  return { total, byStatus };
}

// Per round, counted by the database instead of fetched row by row:
// - noLocation: accepted requests the run can't include because the member
//   never pinned a location - the same filter as listRequests with
//   status=confirmed&located=false.
// - routed: requests on the round's run, collected ones included.
// Only rounds with at least one of the two are returned.
export async function getRouteCountsByRound(scope: VillageScope | null) {
  const [noLocation, routed] = await Promise.all([
    prisma.saleRequest.groupBy({
      by: ["roundId"],
      _count: { _all: true },
      where: {
        status: SALE_REQUEST_STATUS.CONFIRMED,
        ...withoutLocationWhere,
        member: memberScopeWhere(scope),
      },
    }),
    prisma.saleRequest.groupBy({
      by: ["roundId"],
      _count: { _all: true },
      where: {
        status: { not: SALE_REQUEST_STATUS.CANCELLED },
        routeStops: { some: activeRouteStopWhere },
        member: memberScopeWhere(scope),
      },
    }),
  ]);

  const byRound = new Map<number, { roundId: number; noLocation: number; routed: number }>();
  const rowOf = (roundId: number) => {
    let row = byRound.get(roundId);
    if (!row) {
      row = { roundId, noLocation: 0, routed: 0 };
      byRound.set(roundId, row);
    }
    return row;
  };
  for (const row of noLocation) rowOf(row.roundId).noLocation = row._count._all;
  for (const row of routed) rowOf(row.roundId).routed = row._count._all;

  return [...byRound.values()];
}

export async function getRequestDetail(requestId: number) {
  const request = await prisma.saleRequest.findUnique({
    where: { id: requestId },
    include: detailInclude,
  });
  if (!request) {
    throw ApiError.notFound("Sell request not found");
  }

  const savingsDeposit = request.sale
    ? ((
        await prisma.fundTransaction.findFirst({
          where: {
            saleId: request.sale.id,
            transactionType: FUND_TRANSACTION_TYPE.DEPOSIT,
          },
        })
      )?.amountIn ?? 0)
    : 0;

  // Assigned rather than conditionally spread, so `sale.documents` keeps the
  // serialized (fileUrl-carrying) type instead of collapsing back to the raw row.
  const sale = request.sale
    ? {
        ...request.sale,
        documents: await Promise.all(request.sale.documents.map(serializeSaleDocument)),
      }
    : null;

  return { ...request, sale, fundMinimum: FUND_MINIMUM_BAHT, savingsDeposit };
}

// --- Purchase proof (photos / slips) ------------------------------------------------

async function serializeSaleDocument(document: {
  id: number;
  saleId: number;
  fileName: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  uploadedBy: number | null;
  uploadedAt: Date;
}) {
  return {
    ...document,
    fileUrl: await privateFileUrl('saleDocuments', document.storagePath),
  };
}

// Attached to the sale, not the request: proof only exists once a purchase has
// actually been recorded. Callers have already checked the request is in scope.
export async function addSaleDocument(
  requestId: number,
  note: string | undefined,
  file: Express.Multer.File | undefined,
  uploadedBy: number,
) {
  if (!file) {
    throw ApiError.badRequest("กรุณาเลือกไฟล์ที่จะแนบ");
  }

  const request = await prisma.saleRequest.findUnique({
    where: { id: requestId },
    select: { sale: { select: { id: true } } },
  });
  if (!request) {
    throw ApiError.notFound("Sell request not found");
  }
  if (!request.sale) {
    throw ApiError.badRequest(
      "แนบหลักฐานได้หลังบันทึกการรับซื้อแล้วเท่านั้น",
    );
  }

  const objectPath = await storeUpload('saleDocuments', file);
  let document;
  try {
    document = await prisma.saleDocument.create({
      data: { saleId: request.sale.id, fileName: objectPath, originalName: file.originalname, storagePath: objectPath, mimeType: file.mimetype, fileSize: file.size, ...(note ? { note } : {}), uploadedBy },
    });
  } catch (error) {
    await deleteStoredObject('saleDocuments', objectPath).catch(() => undefined);
    throw error;
  }

  return await serializeSaleDocument(document);
}

// Accepting also puts the request on its round's pickup run (one per round per
// village) and re-orders the run - in the same transaction, so a request is
// never accepted without its stop. No pinned location: accepted, but off the map.
export async function confirmRequest(requestId: number) {
  const { updated, addedStop } = await prisma.$transaction(async (tx) => {
    const request = await tx.saleRequest.findUnique({
      where: { id: requestId },
      select: { memberId: true },
    });
    if (!request) {
      throw ApiError.notFound("Sell request not found");
    }

    const confirmed = await tx.saleRequest.updateMany({
      where: { id: requestId, status: SALE_REQUEST_STATUS.REQUESTED },
      data: { status: SALE_REQUEST_STATUS.CONFIRMED },
    });
    if (confirmed.count !== 1) {
      throw ApiError.badRequest(
        "Only a requested sell request can be confirmed",
      );
    }

    const addedStop = await addRequestToRoundPlan(tx, requestId);
    return {
      updated: await tx.saleRequest.findUnique({
        where: { id: requestId },
        include: listInclude,
      }),
      addedStop,
    };
    // Locking the round and re-ordering its run adds a few round trips.
  }, { maxWait: 10_000, timeout: 30_000 });

  if (!updated) {
    throw ApiError.notFound("Sell request not found");
  }
  if (addedStop) {
    await notifyStopAdded(addedStop);
  }

  await notifyMember(
    updated.memberId,
    "กรรมการรับเรื่องคำร้องขายขยะแล้ว",
    "คำร้องขายขยะของคุณได้รับการยืนยันแล้ว กรรมการจะเดินทางไปรับซื้อตามรอบที่แจ้งไว้",
  );

  return updated;
}

export async function cancelRequest(requestId: number, note?: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.saleRequest.findUnique({
      where: { id: requestId },
      select: { memberId: true, note: true },
    });
    if (!request) {
      throw ApiError.notFound("Sell request not found");
    }

    const cancelled = await tx.saleRequest.updateMany({
      where: { id: requestId, status: { in: cancellableStatuses } },
      data: {
        status: SALE_REQUEST_STATUS.CANCELLED,
        note: appendNote(request.note, "ยกเลิกโดยกรรมการ", note),
      },
    });
    if (cancelled.count !== 1) {
      throw ApiError.badRequest(
        "Only a requested or confirmed sell request can be cancelled",
      );
    }

    // An accepted request is on its round's run - take the stop off with it.
    await removeRequestFromRoundPlan(tx, requestId);

    return tx.saleRequest.findUnique({
      where: { id: requestId },
      include: listInclude,
    });
  }, { maxWait: 10_000, timeout: 30_000 });

  if (!updated) {
    throw ApiError.notFound("Sell request not found");
  }

  await notifyMember(
    updated.memberId,
    "คำร้องขายขยะถูกยกเลิก",
    note
      ? `กรรมการยกเลิกคำร้องขายขยะของคุณ เหตุผล: ${note}`
      : "กรรมการยกเลิกคำร้องขายขยะของคุณ",
  );

  return updated;
}

// Proof is part of recording a purchase, not a follow-up step: the sale hands
// cash to a member, so the receipt/photo is its audit trail. Files arrive in the
// same request and are written inside the same transaction - no proof means no
// sale, and a half-finished upload can never leave a paid sale undocumented.
export async function recordPurchase(
  requestId: number,
  input: CommitteePurchaseInput,
  recordedBy: number,
  files: Express.Multer.File[],
) {
  if (!files.length) {
    throw ApiError.badRequest(
      "ต้องแนบหลักฐานการรับซื้อ (ใบเสร็จ/รูปถ่าย) อย่างน้อย 1 ไฟล์",
    );
  }

  const wasteTypeIds = [
    ...new Set(input.items.map((item) => item.wasteTypeId)),
  ];
  if (wasteTypeIds.length !== input.items.length) {
    throw ApiError.badRequest("Duplicate wasteTypeId in purchase items");
  }

  const wasteTypes = await prisma.wasteType.findMany({
    where: { id: { in: wasteTypeIds } },
  });
  if (wasteTypes.length !== wasteTypeIds.length) {
    throw ApiError.badRequest("One or more wasteTypeId values are invalid");
  }

  // Reject invalid workflow state before persisting any proof object. The
  // transaction below repeats the check atomically to protect against races.
  const currentRequest = await prisma.saleRequest.findUnique({
    where: { id: requestId },
    select: { status: true, sale: { select: { id: true } } },
  });
  if (!currentRequest) throw ApiError.notFound('Sell request not found');
  if (currentRequest.sale || currentRequest.status !== SALE_REQUEST_STATUS.CONFIRMED) {
    throw ApiError.badRequest('Only a confirmed sell request can be purchased');
  }

  const lines = input.items.map((item) => {
    const wasteType = wasteTypes.find((wt) => wt.id === item.wasteTypeId)!;
    const unitPrice = item.unitPrice ?? wasteType.defaultPrice;
    return {
      wasteTypeId: item.wasteTypeId,
      quantity: item.quantity,
      unitPrice,
      subtotal: roundMoney(item.quantity * unitPrice),
    };
  });
  const totalAmount = roundMoney(
    lines.reduce((sum, line) => sum + line.subtotal, 0),
  );

  const storedFiles: Array<{ file: Express.Multer.File; objectPath: string }> = [];
  try {
    for (const file of files) {
      storedFiles.push({ file, objectPath: await storeUpload('saleDocuments', file) });
    }
  } catch (error) {
    await Promise.all(storedFiles.map(({ objectPath }) => deleteStoredObject('saleDocuments', objectPath).catch(() => undefined)));
    throw error;
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const request = await tx.saleRequest.findUnique({
      where: { id: requestId },
      include: {
        round: true,
        sale: true,
        member: { include: { fundBalance: true } },
      },
    });
    if (!request) {
      throw ApiError.notFound("Sell request not found");
    }
    if (request.sale) {
      throw ApiError.badRequest(
        "This sell request is already completed or cancelled",
      );
    }

    const claimed = await tx.saleRequest.updateMany({
      where: { id: requestId, status: { in: purchasableStatuses } },
      data: {
        status: SALE_REQUEST_STATUS.COMPLETED,
        note: appendNote(request.note, "บันทึกรับซื้อ", input.note),
      },
    });
    if (claimed.count !== 1) {
      throw ApiError.badRequest(
        request.status === SALE_REQUEST_STATUS.REQUESTED
          ? "ต้องกดรับเรื่องคำร้องนี้ก่อน จึงจะบันทึกการรับซื้อได้"
          : "คำร้องนี้ถูกบันทึกรับซื้อหรือยกเลิกไปแล้ว",
      );
    }

    const currentContribution =
      request.member.fundBalance?.totalContribution ?? 0;
    const fundDeductAmount = roundMoney(
      Math.min(
        totalAmount,
        Math.max(FUND_MINIMUM_BAHT - currentContribution, 0),
      ),
    );
    const netAmount = roundMoney(totalAmount - fundDeductAmount);
    // What's left after the automatic top-up is split by the member: this much
    // stays in savings (no longer withdrawable), the rest is paid out in cash.
    const surplusDeposit = roundMoney(input.depositAmount);
    if (surplusDeposit > netAmount) {
      throw ApiError.badRequest(
        `เก็บเข้าเงินสะสมได้ไม่เกิน ${netAmount.toLocaleString()} บาท (ยอดหลังเติมเงินสะสมให้ครบ ${FUND_MINIMUM_BAHT} บาทแล้ว)`,
      );
    }
    const cashPaid = roundMoney(netAmount - surplusDeposit);

    const now = new Date();
    const stamp = dateStamp(now);
    const createdSale = await tx.wasteSale.create({
      data: {
        saleNo: `SL-${stamp}-R${request.id}`,
        memberId: request.memberId,
        roundId: request.roundId,
        buyerId: request.round.buyerId,
        requestId: request.id,
        saleDate: now,
        totalAmount,
        fundDeductAmount,
        netAmount,
        recordedBy,
        status: "completed",
        details: { create: lines },
      },
    });

    await tx.receipt.create({
      data: {
        receiptNo: `RC-${stamp}-R${request.id}`,
        saleId: createdSale.id,
        receiptDate: now,
        totalAmount,
        fundAmount: fundDeductAmount,
        paidAmount: cashPaid,
        issuedBy: recordedBy,
      },
    });

    await tx.saleDocument.createMany({
      data: storedFiles.map(({ file, objectPath }) => ({
        saleId: createdSale.id,
        fileName: objectPath,
        originalName: file.originalname,
        storagePath: objectPath,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: recordedBy,
      })),
    });

    if (fundDeductAmount > 0 || surplusDeposit > 0) {
      const fundAccount =
        (await tx.fundAccount.findFirst()) ??
        (await tx.fundAccount.create({
          data: { accountName: "กองทุนฌาปนกิจสงเคราะห์", balance: 0 },
        }));
      let runningBalance = fundAccount.balance;

      if (fundDeductAmount > 0) {
        runningBalance = roundMoney(runningBalance + fundDeductAmount);
        await tx.fundTransaction.create({
          data: {
            fundAccountId: fundAccount.id,
            memberId: request.memberId,
            saleId: createdSale.id,
            transactionType: FUND_TRANSACTION_TYPE.CONTRIBUTION,
            amountIn: fundDeductAmount,
            balanceAfter: runningBalance,
            recordedBy,
            note: `เติมเงินสะสมให้ครบ ${FUND_MINIMUM_BAHT} บาทอัตโนมัติจากยอดขายขยะ`,
          },
        });
      }

      if (surplusDeposit > 0) {
        runningBalance = roundMoney(runningBalance + surplusDeposit);
        await tx.fundTransaction.create({
          data: {
            fundAccountId: fundAccount.id,
            memberId: request.memberId,
            saleId: createdSale.id,
            transactionType: FUND_TRANSACTION_TYPE.DEPOSIT,
            amountIn: surplusDeposit,
            balanceAfter: runningBalance,
            recordedBy,
            note: "เก็บเงินจากการขายขยะเข้าเงินสะสม",
          },
        });
      }

      await tx.fundAccount.update({
        where: { id: fundAccount.id },
        data: { balance: runningBalance },
      });
      await tx.memberFundBalance.upsert({
        where: { memberId: request.memberId },
        update: {
          totalContribution: { increment: roundMoney(fundDeductAmount + surplusDeposit) },
          lastContributionDate: now,
        },
        create: {
          memberId: request.memberId,
          totalContribution: roundMoney(fundDeductAmount + surplusDeposit),
          lastContributionDate: now,
        },
      });
    }

    return {
      memberId: request.memberId,
      totalAmount,
      fundDeductAmount,
      surplusDeposit,
      cashPaid,
    };
    });
  } catch (error) {
    await Promise.all(storedFiles.map(({ objectPath }) => deleteStoredObject('saleDocuments', objectPath).catch(() => undefined)));
    throw error;
  }

  const messageParts = [
    result.fundDeductAmount > 0
      ? `เติมเงินสะสมให้ครบขั้นต่ำ ${result.fundDeductAmount.toLocaleString()} บาท`
      : null,
    result.surplusDeposit > 0
      ? `เก็บเข้าเงินสะสม ${result.surplusDeposit.toLocaleString()} บาท`
      : null,
    `รับเงินสด ${result.cashPaid.toLocaleString()} บาท`,
  ].filter(Boolean);
  await notifyMember(
    result.memberId,
    "รับซื้อขยะเรียบร้อยแล้ว",
    `กรรมการบันทึกการรับซื้อขยะของคุณแล้ว ยอดรวม ${result.totalAmount.toLocaleString()} บาท (${messageParts.join(" / ")})`,
  );

  return getRequestDetail(requestId);
}

export async function listWasteTypes() {
  return prisma.wasteType.findMany({
    where: { status: "active" },
    orderBy: { id: "asc" },
  });
}
