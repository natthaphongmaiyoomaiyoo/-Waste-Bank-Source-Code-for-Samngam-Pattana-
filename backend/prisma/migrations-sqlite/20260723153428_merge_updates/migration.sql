-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_system_setting" (
    "setting_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updated_by" INTEGER,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_system_setting" ("description", "setting_id", "setting_key", "setting_value", "updated_at", "updated_by", "value_type") SELECT "description", "setting_id", "setting_key", "setting_value", "updated_at", "updated_by", "value_type" FROM "system_setting";
DROP TABLE "system_setting";
ALTER TABLE "new_system_setting" RENAME TO "system_setting";
CREATE UNIQUE INDEX "system_setting_setting_key_key" ON "system_setting"("setting_key");
CREATE TABLE "new_village_area" (
    "village_area_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "village_name" TEXT NOT NULL,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_village_area" ("created_at", "district", "moo", "postcode", "province", "status", "subdistrict", "updated_at", "village_area_id", "village_name") SELECT "created_at", "district", "moo", "postcode", "province", "status", "subdistrict", "updated_at", "village_area_id", "village_name" FROM "village_area";
DROP TABLE "village_area";
ALTER TABLE "new_village_area" RENAME TO "village_area";
CREATE INDEX "village_area_moo_idx" ON "village_area"("moo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
