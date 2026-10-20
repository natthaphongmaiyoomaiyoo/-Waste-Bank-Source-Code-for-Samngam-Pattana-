-- CreateTable
CREATE TABLE "member_type" (
    "member_type_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "member_type_type_name_key" ON "member_type"("type_name");
