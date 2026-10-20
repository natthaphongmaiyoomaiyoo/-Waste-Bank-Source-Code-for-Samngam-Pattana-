import { Prisma } from '@prisma/client';
import { FUND_MINIMUM_BAHT, FUND_TRANSACTION_TYPE } from '../config/constants.js';
import { prisma } from '../database/prisma.js';
import type { MemberHistoryQuery } from '../validators/sellRequestValidators.js';

export async function getBalance(memberId: number) {
  const balance = await prisma.memberFundBalance.findUnique({ where: { memberId } });
  if (balance) return balance;

  // Defensive default - registration always creates this row, but guard against
  // older/manually-created member rows that might not have one.
  return prisma.memberFundBalance.create({ data: { memberId, totalContribution: 0 } });
}

export async function listTransactions(memberId: number) {
  return prisma.fundTransaction.findMany({
    where: { memberId },
    orderBy: { transactionDate: 'desc' },
  });
}

interface MemberLedgerRow {
  id: number;
  transactionDate: Date;
  transactionType: string;
  amountIn: number;
  amountOut: number;
  note: string | null;
  saleId: number | null;
  personalBalance: number;
}

// One page of the member's savings ledger ("เงินสะสม" tab). balance_after on
// fund_transaction tracks the shared fund account, not this member, so each
// row's personal running balance is replayed here, oldest to newest over the
// member's whole ledger, by a window function: only the page travels back.
// Signs follow the savings balance itself - contribution and deposit add to it,
// benefit_payment (funeral collection) takes from it, funeral_late_payment (cash
// handed over for a funeral the member was short on) never touches it - and
// each row's amount is amount_in, or amount_out when nothing came in.
export async function listTransactionsPage(
  memberId: number,
  query: MemberHistoryQuery & { page: number },
) {
  const direction = Prisma.raw(query.descending === false ? 'ASC' : 'DESC');
  const orderBy =
    query.sortBy === 'amount'
      ? Prisma.sql`amount ${direction}, "transactionDate" DESC, id DESC`
      : Prisma.sql`"transactionDate" ${direction}, id ${direction}`;

  const [total, rows] = await Promise.all([
    prisma.fundTransaction.count({ where: { memberId } }),
    prisma.$queryRaw<(MemberLedgerRow & { amount: number })[]>`
      SELECT * FROM (
        SELECT
          fund_transaction_id AS id,
          transaction_date AS "transactionDate",
          transaction_type AS "transactionType",
          amount_in AS "amountIn",
          amount_out AS "amountOut",
          note,
          sale_id AS "saleId",
          CASE WHEN amount_in <> 0 THEN amount_in ELSE amount_out END AS amount,
          ROUND(SUM(
            CASE
              WHEN transaction_type = ${FUND_TRANSACTION_TYPE.BENEFIT_PAYMENT} THEN -1
              WHEN transaction_type = ${FUND_TRANSACTION_TYPE.FUNERAL_LATE_PAYMENT} THEN 0
              ELSE 1
            END
            * CASE WHEN amount_in <> 0 THEN amount_in ELSE amount_out END
          ) OVER (ORDER BY transaction_date, fund_transaction_id)::numeric, 2)::float8 AS "personalBalance"
        FROM fund_transaction
        WHERE member_id = ${memberId}
      ) ledger
      ORDER BY ${orderBy}
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
    `,
  ]);

  return {
    items: rows.map(({ amount: _amount, ...row }) => row),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
  };
}

// Members whose savings balance has not reached the 50-baht minimum - the
// "เงินสะสมยังไม่ครบ" tracking filter shared by the committee and
// municipality member lists. The null branch covers any member row without a
// member_fund_balance: no row means 0 baht contributed, not "unknown".
export const belowMinimumContributionWhere: Prisma.MemberWhereInput = {
  OR: [
    { fundBalance: { is: null } },
    { fundBalance: { totalContribution: { lt: FUND_MINIMUM_BAHT } } },
  ],
};
