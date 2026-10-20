-- CreateTable
CREATE TABLE "member_verification" (
    "verification_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "check_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "age_years" INTEGER NOT NULL,
    "age_eligible" BOOLEAN NOT NULL,
    "address_verified" BOOLEAN NOT NULL,
    "guarantor_verified" BOOLEAN NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "verified_by" INTEGER,
    CONSTRAINT "member_verification_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
