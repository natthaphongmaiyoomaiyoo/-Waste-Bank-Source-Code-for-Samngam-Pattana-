-- CreateTable
CREATE TABLE "member_status_history" (
    "status_history_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by" INTEGER,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_status_history_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "member_status_history_member_id_idx" ON "member_status_history"("member_id");

-- CreateIndex
CREATE INDEX "member_status_history_changed_at_idx" ON "member_status_history"("changed_at");
