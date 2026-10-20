-- Which village a collection round is held for. NULL = open to the whole
-- municipality (existing rounds keep that behaviour), a value = only that
-- village's members are offered the round and may submit a sell request for it.
-- AlterTable
ALTER TABLE "collection_round" ADD COLUMN "village_area_id" INTEGER REFERENCES "village_area" ("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "collection_round_village_area_id_idx" ON "collection_round"("village_area_id");

-- CreateIndex
CREATE INDEX "collection_round_round_date_idx" ON "collection_round"("round_date");
