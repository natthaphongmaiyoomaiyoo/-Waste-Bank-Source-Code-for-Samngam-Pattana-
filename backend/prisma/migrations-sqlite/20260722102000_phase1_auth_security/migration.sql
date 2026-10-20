-- AlterTable
ALTER TABLE "user_account" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_account" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_account" ADD COLUMN "locked_until" DATETIME;
ALTER TABLE "user_account" ADD COLUMN "password_changed_at" DATETIME;
ALTER TABLE "user_account" ADD COLUMN "reset_token_hash" TEXT;
ALTER TABLE "user_account" ADD COLUMN "reset_token_expires_at" DATETIME;

-- CreateTable
CREATE TABLE "login_audit" (
    "login_audit_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "identifier" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failure_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "login_audit_user_id_idx" ON "login_audit"("user_id");

-- CreateIndex
CREATE INDEX "login_audit_created_at_idx" ON "login_audit"("created_at");
