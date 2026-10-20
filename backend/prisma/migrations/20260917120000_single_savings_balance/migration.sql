-- Savings become one balance (member_fund_balance.total_contribution) that can
-- no longer be withdrawn, so the separate withdrawable savings_balance and the
-- fund_withdrawal request flow go away.

-- 1. Unfinished withdrawal requests had already reserved their amount out of
--    savings_balance without paying it out: give that money back first.
UPDATE "member_fund_balance" AS b
SET "savings_balance" = b."savings_balance" + r.reserved
FROM (
  SELECT "member_id", SUM("amount") AS reserved
  FROM "fund_withdrawal"
  WHERE "status" IN ('pending', 'approved')
  GROUP BY "member_id"
) AS r
WHERE b."member_id" = r."member_id";

-- 2. Fold the withdrawable savings into the single balance.
UPDATE "member_fund_balance"
SET "total_contribution" = "total_contribution" + "savings_balance";

-- 3. Drop what only the withdrawal feature used.
ALTER TABLE "member_fund_balance" DROP COLUMN "savings_balance";
DROP TABLE "fund_withdrawal";
