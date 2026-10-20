-- Banners get a slideshow position the admin can drag to change, and their own
-- optional text: a first and a second line.

-- AlterTable
ALTER TABLE "banner" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "text_intro" TEXT,
ADD COLUMN     "text_main" TEXT;

-- Keep today's order: oldest first.
UPDATE "banner" b
   SET "sort_order" = o."position"
  FROM (SELECT "banner_id", (ROW_NUMBER() OVER (ORDER BY "banner_id"))::INTEGER AS "position"
          FROM "banner") o
 WHERE o."banner_id" = b."banner_id";

-- The welcome text used to be hard-coded in the frontend and shown on the last
-- slide only: it now lives on that banner, so the homepage looks the same.
UPDATE "banner"
   SET "text_intro" = 'ยินดีต้อนรับสู่', "text_main" = 'กองทุนธนาคารขยะ'
 WHERE "banner_id" = (SELECT MAX("banner_id") FROM "banner");
