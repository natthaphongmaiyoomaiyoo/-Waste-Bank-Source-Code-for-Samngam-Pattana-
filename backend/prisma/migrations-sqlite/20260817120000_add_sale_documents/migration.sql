-- Purchase proof (photos / slips) the committee attaches when recording a sale.
-- CreateTable
CREATE TABLE "sale_document" (
    "sale_document_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "note" TEXT,
    "uploaded_by" INTEGER,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sale_document_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "waste_sale" ("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sale_document_sale_id_idx" ON "sale_document"("sale_id");
