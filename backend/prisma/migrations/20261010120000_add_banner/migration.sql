-- CreateTable
CREATE TABLE "banner" (
    "banner_id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banner_pkey" PRIMARY KEY ("banner_id")
);

-- The slideshow used to be hard-coded in the frontend (HERO_SLIDE_IMAGES);
-- carry that set over in the same order so admins can remove it like any
-- uploaded banner. These rows point at the frontend's own static files.
INSERT INTO "banner" ("image_url") VALUES
    ('/icons/anou1.png'),
    ('/icons/anou4.png'),
    ('/icons/anou3.png'),
    ('/icons/anou2.png');
