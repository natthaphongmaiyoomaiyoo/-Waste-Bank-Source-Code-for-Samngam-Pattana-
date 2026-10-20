-- Binds a village-committee account to the village (master data row) it is
-- responsible for. NULL for every other role.
-- AlterTable
ALTER TABLE "user_account" ADD COLUMN "village_area_id" INTEGER REFERENCES "village_area" ("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "user_account_village_area_id_idx" ON "user_account"("village_area_id");
