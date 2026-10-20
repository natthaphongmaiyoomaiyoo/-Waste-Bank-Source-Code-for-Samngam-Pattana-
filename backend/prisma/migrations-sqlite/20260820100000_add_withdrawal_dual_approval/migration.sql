-- Dual approval for member savings withdrawals: the village committee AND a
-- municipality officer each approve (either order), then the member confirms
-- the cash in hand. Neither approver can reject.
-- AlterTable
ALTER TABLE "fund_withdrawal" ADD COLUMN "committee_approved_by" INTEGER;
ALTER TABLE "fund_withdrawal" ADD COLUMN "committee_approved_date" DATETIME;
ALTER TABLE "fund_withdrawal" ADD COLUMN "municipality_approved_by" INTEGER;
ALTER TABLE "fund_withdrawal" ADD COLUMN "municipality_approved_date" DATETIME;
ALTER TABLE "fund_withdrawal" ADD COLUMN "received_by" INTEGER;
ALTER TABLE "fund_withdrawal" ADD COLUMN "received_date" DATETIME;

-- Backfill rows already paid under the old single-approval flow so the UI does
-- not show them as half-approved: whoever paid them counts as the committee
-- approval, and the payout date doubles as the member's receipt date.
UPDATE "fund_withdrawal"
SET "committee_approved_by" = "processed_by",
    "committee_approved_date" = "processed_date",
    "municipality_approved_by" = "processed_by",
    "municipality_approved_date" = "processed_date",
    "received_date" = "processed_date"
WHERE "status" = 'paid';
