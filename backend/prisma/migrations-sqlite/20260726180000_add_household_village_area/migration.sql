-- Household -> VillageArea, the key committee permissions are resolved against.
-- Replaces matching household.moo against village_area.moo, which broke whenever
-- a moo was renamed or shared by two villages.
-- AlterTable
ALTER TABLE "household" ADD COLUMN "village_area_id" INTEGER REFERENCES "village_area" ("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "household_village_area_id_idx" ON "household"("village_area_id");

-- Backfill from the moo the old scoping relied on, but only where that match is
-- unambiguous (exactly one village carries that moo). Households whose moo has
-- no village row - or an ambiguous one - stay NULL on purpose: no committee
-- owns them until an admin links them, which fails closed rather than open.
UPDATE "household"
SET "village_area_id" = (
  SELECT v."village_area_id"
  FROM "village_area" v
  WHERE TRIM(v."moo") = TRIM("household"."moo")
)
WHERE "moo" IS NOT NULL
  AND TRIM("moo") <> ''
  AND (
    SELECT COUNT(*)
    FROM "village_area" v2
    WHERE TRIM(v2."moo") = TRIM("household"."moo")
  ) = 1;
