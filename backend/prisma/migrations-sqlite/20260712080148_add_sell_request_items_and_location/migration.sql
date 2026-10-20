-- AlterTable
ALTER TABLE "sale_request" ADD COLUMN "pickup_lat" REAL;
ALTER TABLE "sale_request" ADD COLUMN "pickup_lng" REAL;

-- CreateTable
CREATE TABLE "sale_request_item" (
    "request_item_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "request_id" INTEGER NOT NULL,
    "waste_type_id" INTEGER NOT NULL,
    "estimated_quantity" REAL NOT NULL,
    CONSTRAINT "sale_request_item_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "sale_request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_request_item_waste_type_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_type" ("waste_type_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_waste_sale" (
    "sale_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_no" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "request_id" INTEGER,
    "sale_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" REAL NOT NULL,
    "fund_deduct_amount" REAL NOT NULL DEFAULT 0,
    "net_amount" REAL NOT NULL,
    "recorded_by" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    CONSTRAINT "waste_sale_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_sale_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round" ("round_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_sale_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer" ("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_sale_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "sale_request" ("request_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_waste_sale" ("buyer_id", "fund_deduct_amount", "member_id", "net_amount", "recorded_by", "round_id", "sale_date", "sale_id", "sale_no", "status", "total_amount") SELECT "buyer_id", "fund_deduct_amount", "member_id", "net_amount", "recorded_by", "round_id", "sale_date", "sale_id", "sale_no", "status", "total_amount" FROM "waste_sale";
DROP TABLE "waste_sale";
ALTER TABLE "new_waste_sale" RENAME TO "waste_sale";
CREATE UNIQUE INDEX "waste_sale_sale_no_key" ON "waste_sale"("sale_no");
CREATE UNIQUE INDEX "waste_sale_request_id_key" ON "waste_sale"("request_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
