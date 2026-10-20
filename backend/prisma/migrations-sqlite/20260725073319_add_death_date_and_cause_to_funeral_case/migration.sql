/*
  Warnings:

  - Added the required column `cause_of_death` to the `funeral_case` table without a default value. This is not possible if the table is not empty.
  - Added the required column `death_date` to the `funeral_case` table without a default value. This is not possible if the table is not empty.

  Hand-edited (Prisma's auto-generated INSERT below did not supply values for
  the two new NOT NULL columns, which would fail against existing rows):
  the dev database had 1 pre-existing funeral_case row (id 1, recorded before
  this feature existed). It is backfilled below with death_date = event_date
  (best available proxy - the case's recorded date) and a literal
  cause_of_death placeholder flagging it as legacy data. Both columns stay
  required/non-nullable in schema.prisma (no @default) per the business rule
  that new death confirmations must always capture both fields.
*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_fund_transaction" (
    "fund_transaction_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fund_account_id" INTEGER NOT NULL,
    "member_id" INTEGER,
    "sale_id" INTEGER,
    "funeral_case_id" INTEGER,
    "transaction_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_type" TEXT NOT NULL,
    "amount_in" REAL NOT NULL DEFAULT 0,
    "amount_out" REAL NOT NULL DEFAULT 0,
    "balance_after" REAL NOT NULL,
    "recorded_by" INTEGER,
    "note" TEXT,
    CONSTRAINT "fund_transaction_fund_account_id_fkey" FOREIGN KEY ("fund_account_id") REFERENCES "fund_account" ("fund_account_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fund_transaction_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fund_transaction_funeral_case_id_fkey" FOREIGN KEY ("funeral_case_id") REFERENCES "funeral_case" ("funeral_case_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_fund_transaction" ("amount_in", "amount_out", "balance_after", "fund_account_id", "fund_transaction_id", "funeral_case_id", "member_id", "note", "recorded_by", "sale_id", "transaction_date", "transaction_type") SELECT "amount_in", "amount_out", "balance_after", "fund_account_id", "fund_transaction_id", "funeral_case_id", "member_id", "note", "recorded_by", "sale_id", "transaction_date", "transaction_type" FROM "fund_transaction";
DROP TABLE "fund_transaction";
ALTER TABLE "new_fund_transaction" RENAME TO "fund_transaction";
CREATE TABLE "new_funeral_case" (
    "funeral_case_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deceased_member_id" INTEGER NOT NULL,
    "required_amount" REAL NOT NULL DEFAULT 50,
    "event_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "death_date" DATETIME NOT NULL,
    "cause_of_death" TEXT NOT NULL,
    "recorded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funeral_case_deceased_member_id_fkey" FOREIGN KEY ("deceased_member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_funeral_case" ("created_at", "deceased_member_id", "event_date", "death_date", "cause_of_death", "funeral_case_id", "recorded_by", "required_amount") SELECT "created_at", "deceased_member_id", "event_date", "event_date" AS "death_date", 'ไม่ระบุ (ข้อมูลเดิมก่อนปรับปรุงระบบ)' AS "cause_of_death", "funeral_case_id", "recorded_by", "required_amount" FROM "funeral_case";
DROP TABLE "funeral_case";
ALTER TABLE "new_funeral_case" RENAME TO "funeral_case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
