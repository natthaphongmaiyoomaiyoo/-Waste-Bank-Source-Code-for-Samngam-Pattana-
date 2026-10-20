-- A committee's death report now waits for the municipality: only approval
-- marks the member deceased and moves money. Every case recorded before this
-- was charged on the spot, so they are all approved already - recorded and
-- approved by the same person at the same time.
ALTER TABLE "funeral_case" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN "report_note" TEXT,
ADD COLUMN "approved_by" INTEGER,
ADD COLUMN "approved_at" TIMESTAMP(3);

UPDATE "funeral_case" SET "approved_at" = "event_date", "approved_by" = "recorded_by";

-- New reports start out pending.
ALTER TABLE "funeral_case" ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "funeral_case_status_idx" ON "funeral_case"("status");
