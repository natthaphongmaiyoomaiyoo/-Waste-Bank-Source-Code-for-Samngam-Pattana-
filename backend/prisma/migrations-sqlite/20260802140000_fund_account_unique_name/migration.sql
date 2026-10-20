-- Nothing enforced account_name uniqueness, and every money-moving path resolves
-- "the" fund account via fundAccount.findFirst() (lowest id) - so a duplicate row
-- created by mistake (double seed run, admin master-data re-entry, etc.) just sits
-- there empty and untouched forever while still showing up on the fund dashboard.
-- Clean up any such orphaned duplicates - same name as another account, zero
-- balance, never touched by a transaction - before locking the name down.
DELETE FROM "fund_account" AS dup
WHERE dup.balance = 0
  AND dup.fund_account_id NOT IN (SELECT DISTINCT fund_account_id FROM fund_transaction)
  AND EXISTS (
    SELECT 1 FROM "fund_account" AS other
    WHERE other.account_name = dup.account_name
      AND other.fund_account_id != dup.fund_account_id
  );

-- CreateIndex
CREATE UNIQUE INDEX "fund_account_account_name_key" ON "fund_account"("account_name");
