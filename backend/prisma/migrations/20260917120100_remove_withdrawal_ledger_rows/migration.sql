-- Clean the ledger of what the old two-balance model left behind, so every row
-- fits the single non-withdrawable savings balance.

-- 1. Funeral money once taken from the separate withdrawable savings is simply
--    funeral money taken from savings now.
UPDATE "fund_transaction"
SET "transaction_type" = 'benefit_payment'
WHERE "transaction_type" = 'funeral_personal_transfer';

UPDATE "funeral_contribution"
SET "fund_amount" = "fund_amount" + "personal_fund_amount",
    "personal_fund_amount" = 0
WHERE "personal_fund_amount" <> 0;

-- 2. Top-ups only moved money between the two old sub-balances (no effect on
--    the total or the fund account), so they have nothing left to record.
DELETE FROM "fund_transaction" WHERE "transaction_type" = 'savings_topup';

-- 3. Withdrawals no longer exist: remove them as if they never happened. The
--    money goes back into the member's savings and the fund account, and every
--    later ledger row's running balance moves up by what was withdrawn before it.
UPDATE "fund_transaction" AS t
SET "balance_after" = t."balance_after" + (
  SELECT COALESCE(SUM(w."amount_out"), 0)
  FROM "fund_transaction" AS w
  WHERE w."transaction_type" = 'withdrawal'
    AND w."fund_account_id" = t."fund_account_id"
    AND w."fund_transaction_id" < t."fund_transaction_id"
)
WHERE t."transaction_type" <> 'withdrawal';

UPDATE "member_fund_balance" AS b
SET "total_contribution" = b."total_contribution" + w.total
FROM (
  SELECT "member_id", SUM("amount_out") AS total
  FROM "fund_transaction"
  WHERE "transaction_type" = 'withdrawal' AND "member_id" IS NOT NULL
  GROUP BY "member_id"
) AS w
WHERE b."member_id" = w."member_id";

UPDATE "fund_account" AS a
SET "balance" = a."balance" + w.total
FROM (
  SELECT "fund_account_id", SUM("amount_out") AS total
  FROM "fund_transaction"
  WHERE "transaction_type" = 'withdrawal'
  GROUP BY "fund_account_id"
) AS w
WHERE a."fund_account_id" = w."fund_account_id";

DELETE FROM "fund_transaction" WHERE "transaction_type" = 'withdrawal';
