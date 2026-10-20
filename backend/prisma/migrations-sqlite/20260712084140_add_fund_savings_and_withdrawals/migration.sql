-- CreateTable
CREATE TABLE "fund_withdrawal" (
    "withdrawal_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "result_note" TEXT,
    "request_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_by" INTEGER,
    "processed_date" DATETIME,
    CONSTRAINT "fund_withdrawal_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_member_fund_balance" (
    "member_fund_balance_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "total_contribution" REAL NOT NULL DEFAULT 0,
    "savings_balance" REAL NOT NULL DEFAULT 0,
    "last_contribution_date" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "member_fund_balance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_member_fund_balance" ("last_contribution_date", "member_fund_balance_id", "member_id", "total_contribution", "updated_at") SELECT "last_contribution_date", "member_fund_balance_id", "member_id", "total_contribution", "updated_at" FROM "member_fund_balance";
DROP TABLE "member_fund_balance";
ALTER TABLE "new_member_fund_balance" RENAME TO "member_fund_balance";
CREATE UNIQUE INDEX "member_fund_balance_member_id_key" ON "member_fund_balance"("member_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
