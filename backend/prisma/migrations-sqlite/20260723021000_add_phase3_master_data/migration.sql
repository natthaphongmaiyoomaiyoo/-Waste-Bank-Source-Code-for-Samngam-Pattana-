-- CreateTable
CREATE TABLE "waste_price_history" (
    "price_history_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "waste_type_id" INTEGER NOT NULL,
    "buyer_id" INTEGER,
    "price" REAL NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "waste_price_history_waste_type_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_type" ("waste_type_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_price_history_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer" ("buyer_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "village_area" (
    "village_area_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "village_name" TEXT NOT NULL,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "system_setting" (
    "setting_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updated_by" INTEGER,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "waste_price_history_waste_type_id_idx" ON "waste_price_history"("waste_type_id");

-- CreateIndex
CREATE INDEX "waste_price_history_buyer_id_idx" ON "waste_price_history"("buyer_id");

-- CreateIndex
CREATE INDEX "waste_price_history_effective_from_idx" ON "waste_price_history"("effective_from");

-- CreateIndex
CREATE INDEX "village_area_moo_idx" ON "village_area"("moo");

-- CreateIndex
CREATE UNIQUE INDEX "system_setting_setting_key_key" ON "system_setting"("setting_key");
