-- CreateTable
CREATE TABLE "funeral_case" (
    "funeral_case_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deceased_member_id" INTEGER NOT NULL,
    "required_amount" REAL NOT NULL DEFAULT 50,
    "event_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funeral_case_deceased_member_id_fkey" FOREIGN KEY ("deceased_member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "funeral_contribution" (
    "funeral_contribution_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funeral_case_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "required_amount" REAL NOT NULL DEFAULT 50,
    "fund_amount" REAL NOT NULL DEFAULT 0,
    "personal_fund_amount" REAL NOT NULL DEFAULT 0,
    "total_paid" REAL NOT NULL DEFAULT 0,
    "shortfall" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "personal_fund_balance_after" REAL NOT NULL,
    "recorded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funeral_contribution_funeral_case_id_fkey" FOREIGN KEY ("funeral_case_id") REFERENCES "funeral_case" ("funeral_case_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "funeral_contribution_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "funeral_contribution_funeral_case_id_member_id_key" ON "funeral_contribution"("funeral_case_id", "member_id");

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
    CONSTRAINT "fund_transaction_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fund_transaction_funeral_case_id_fkey" FOREIGN KEY ("funeral_case_id") REFERENCES "funeral_case" ("funeral_case_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_fund_transaction" ("fund_transaction_id", "fund_account_id", "member_id", "sale_id", "transaction_date", "transaction_type", "amount_in", "amount_out", "balance_after", "recorded_by", "note") SELECT "fund_transaction_id", "fund_account_id", "member_id", "sale_id", "transaction_date", "transaction_type", "amount_in", "amount_out", "balance_after", "recorded_by", "note" FROM "fund_transaction";
DROP TABLE "fund_transaction";
ALTER TABLE "new_fund_transaction" RENAME TO "fund_transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
