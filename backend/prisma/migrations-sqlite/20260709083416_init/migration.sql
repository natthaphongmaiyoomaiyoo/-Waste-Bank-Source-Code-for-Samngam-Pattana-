-- CreateTable
CREATE TABLE "role" (
    "role_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role_name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "waste_type" (
    "waste_type_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "waste_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "default_price" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active'
);

-- CreateTable
CREATE TABLE "buyer" (
    "buyer_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buyer_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active'
);

-- CreateTable
CREATE TABLE "fund_account" (
    "fund_account_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_name" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "household" (
    "household_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "house_no" TEXT,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postcode" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "member" (
    "member_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_code" TEXT NOT NULL,
    "household_id" INTEGER NOT NULL,
    "citizen_id" TEXT NOT NULL,
    "prefix" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATETIME NOT NULL,
    "gender" TEXT,
    "phone" TEXT NOT NULL,
    "occupation" TEXT,
    "apply_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remark" TEXT,
    CONSTRAINT "member_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household" ("household_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "member_guarantor" (
    "guarantor_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "guarantor_name" TEXT NOT NULL,
    "guarantor_phone" TEXT,
    "relationship" TEXT,
    "note" TEXT,
    CONSTRAINT "member_guarantor_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_account" (
    "user_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login" DATETIME,
    CONSTRAINT "user_account_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_account_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role" ("role_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "collection_round" (
    "round_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round_date" DATETIME NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "location_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_by" INTEGER,
    CONSTRAINT "collection_round_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer" ("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sale_request" (
    "request_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "request_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickup_address" TEXT,
    "estimated_quantity" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "note" TEXT,
    CONSTRAINT "sale_request_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_request_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round" ("round_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "waste_sale" (
    "sale_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_no" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "sale_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" REAL NOT NULL,
    "fund_deduct_amount" REAL NOT NULL DEFAULT 0,
    "net_amount" REAL NOT NULL,
    "recorded_by" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    CONSTRAINT "waste_sale_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_sale_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round" ("round_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_sale_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer" ("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "waste_sale_detail" (
    "sale_detail_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_id" INTEGER NOT NULL,
    "waste_type_id" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "waste_sale_detail_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "waste_sale" ("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "waste_sale_detail_waste_type_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_type" ("waste_type_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "receipt" (
    "receipt_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receipt_no" TEXT NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "receipt_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" REAL NOT NULL,
    "fund_amount" REAL NOT NULL,
    "paid_amount" REAL NOT NULL,
    "issued_by" INTEGER,
    CONSTRAINT "receipt_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "waste_sale" ("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fund_transaction" (
    "fund_transaction_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fund_account_id" INTEGER NOT NULL,
    "member_id" INTEGER,
    "sale_id" INTEGER,
    "transaction_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_type" TEXT NOT NULL,
    "amount_in" REAL NOT NULL DEFAULT 0,
    "amount_out" REAL NOT NULL DEFAULT 0,
    "balance_after" REAL NOT NULL,
    "recorded_by" INTEGER,
    "note" TEXT,
    CONSTRAINT "fund_transaction_fund_account_id_fkey" FOREIGN KEY ("fund_account_id") REFERENCES "fund_account" ("fund_account_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fund_transaction_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "member_fund_balance" (
    "member_fund_balance_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "total_contribution" REAL NOT NULL DEFAULT 0,
    "last_contribution_date" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "member_fund_balance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "eligibility_check" (
    "eligibility_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "check_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_month_count" INTEGER NOT NULL,
    "continuous_month_count" INTEGER NOT NULL,
    "is_eligible" BOOLEAN NOT NULL,
    "reason" TEXT,
    "checked_by" INTEGER,
    CONSTRAINT "eligibility_check_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("member_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "role_role_name_key" ON "role"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "member_member_code_key" ON "member"("member_code");

-- CreateIndex
CREATE UNIQUE INDEX "member_citizen_id_key" ON "member"("citizen_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_member_id_key" ON "user_account"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_username_key" ON "user_account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "waste_sale_sale_no_key" ON "waste_sale"("sale_no");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_receipt_no_key" ON "receipt"("receipt_no");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_sale_id_key" ON "receipt"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_fund_balance_member_id_key" ON "member_fund_balance"("member_id");
