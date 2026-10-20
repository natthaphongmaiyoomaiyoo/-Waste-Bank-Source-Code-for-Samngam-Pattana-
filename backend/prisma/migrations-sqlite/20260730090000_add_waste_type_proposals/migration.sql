-- Buyer-proposed waste types. A buyer can submit a new waste type with a rough
-- price; the row is created with status = 'pending' and stays invisible to
-- members/committees (they only ever read status = 'active') until an admin
-- approves it. Rejected proposals keep the reason so the buyer can see why.

-- AlterTable
ALTER TABLE "waste_type" ADD COLUMN "proposed_by" INTEGER;
ALTER TABLE "waste_type" ADD COLUMN "proposed_at" DATETIME;
ALTER TABLE "waste_type" ADD COLUMN "reviewed_by" INTEGER;
ALTER TABLE "waste_type" ADD COLUMN "reviewed_at" DATETIME;
ALTER TABLE "waste_type" ADD COLUMN "reject_reason" TEXT;

-- CreateIndex
CREATE INDEX "waste_type_status_idx" ON "waste_type"("status");

-- CreateIndex
CREATE INDEX "waste_type_proposed_by_idx" ON "waste_type"("proposed_by");
