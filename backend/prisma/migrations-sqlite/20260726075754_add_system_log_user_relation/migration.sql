-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_system_log" (
    "log_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "target_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_system_log" ("action", "action_type", "created_at", "detail", "ip_address", "log_id", "module", "status", "target_id", "user_agent", "user_id") SELECT "action", "action_type", "created_at", "detail", "ip_address", "log_id", "module", "status", "target_id", "user_agent", "user_id" FROM "system_log";
DROP TABLE "system_log";
ALTER TABLE "new_system_log" RENAME TO "system_log";
CREATE INDEX "system_log_user_id_idx" ON "system_log"("user_id");
CREATE INDEX "system_log_created_at_idx" ON "system_log"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
