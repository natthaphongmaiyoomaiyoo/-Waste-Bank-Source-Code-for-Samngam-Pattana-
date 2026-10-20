-- Add publish status to waste sorting videos; existing rows stay visible (default true)
ALTER TABLE "waste_sorting_video" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
