-- =============================================================================
-- โครงสร้างฐานข้อมูลระบบธนาคารขยะ (PostgreSQL)
-- 35 ตาราง พร้อม primary key, foreign key, unique และ index ครบ ไม่มีข้อมูลตัวอย่าง
--
-- สร้างจาก backend/prisma/schema.prisma (Prisma 6.19.3) ด้วยคำสั่ง
--   cd backend
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- ถ้าแก้ schema.prisma ให้รันคำสั่งนี้ใหม่แล้ววางทับไฟล์นี้
--
-- ไฟล์นี้มีไว้อ่านหรือสร้างฐานข้อมูลเปล่าด้วยมือ (psql -f database/schema.sql)
-- ถ้าจะรัน backend ให้ใช้ `npx prisma migrate deploy` แทน เพื่อให้ Prisma
-- บันทึกประวัติ migration ไว้ในตาราง _prisma_migrations
-- =============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "role" (
    "role_id" SERIAL NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "role_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "waste_type" (
    "waste_type_id" SERIAL NOT NULL,
    "waste_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "default_price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "proposed_by" INTEGER,
    "proposed_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "reject_reason" TEXT,

    CONSTRAINT "waste_type_pkey" PRIMARY KEY ("waste_type_id")
);

-- CreateTable
CREATE TABLE "waste_price_history" (
    "price_history_id" SERIAL NOT NULL,
    "waste_type_id" INTEGER NOT NULL,
    "buyer_id" INTEGER,
    "price" DOUBLE PRECISION NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_price_history_pkey" PRIMARY KEY ("price_history_id")
);

-- CreateTable
CREATE TABLE "buyer" (
    "buyer_id" SERIAL NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "buyer_pkey" PRIMARY KEY ("buyer_id")
);

-- CreateTable
CREATE TABLE "fund_account" (
    "fund_account_id" SERIAL NOT NULL,
    "account_name" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_account_pkey" PRIMARY KEY ("fund_account_id")
);

-- CreateTable
CREATE TABLE "village_area" (
    "village_area_id" SERIAL NOT NULL,
    "village_name" TEXT NOT NULL,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "village_area_pkey" PRIMARY KEY ("village_area_id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "setting_id" SERIAL NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE "household" (
    "household_id" SERIAL NOT NULL,
    "house_no" TEXT,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postcode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "village_area_id" INTEGER,

    CONSTRAINT "household_pkey" PRIMARY KEY ("household_id")
);

-- CreateTable
CREATE TABLE "member" (
    "member_id" SERIAL NOT NULL,
    "member_code" TEXT NOT NULL,
    "household_id" INTEGER NOT NULL,
    "citizen_id" TEXT NOT NULL,
    "prefix" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "phone" TEXT NOT NULL,
    "occupation" TEXT,
    "apply_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remark" TEXT,

    CONSTRAINT "member_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "member_status_history" (
    "status_history_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_status_history_pkey" PRIMARY KEY ("status_history_id")
);

-- CreateTable
CREATE TABLE "member_document" (
    "document_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "note" TEXT,
    "uploaded_by" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_document_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "member_verification" (
    "verification_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "check_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "age_years" INTEGER NOT NULL,
    "age_eligible" BOOLEAN NOT NULL,
    "address_verified" BOOLEAN NOT NULL,
    "guarantor_verified" BOOLEAN NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "verified_by" INTEGER,

    CONSTRAINT "member_verification_pkey" PRIMARY KEY ("verification_id")
);

-- CreateTable
CREATE TABLE "member_guarantor" (
    "guarantor_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "guarantor_name" TEXT NOT NULL,
    "guarantor_phone" TEXT,
    "relationship" TEXT,
    "note" TEXT,

    CONSTRAINT "member_guarantor_pkey" PRIMARY KEY ("guarantor_id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "user_id" SERIAL NOT NULL,
    "member_id" INTEGER,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role_id" INTEGER NOT NULL,
    "village_area_id" INTEGER,
    "buyer_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login" TIMESTAMP(3),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMP(3),

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "login_audit" (
    "login_audit_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "identifier" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failure_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_audit_pkey" PRIMARY KEY ("login_audit_id")
);

-- CreateTable
CREATE TABLE "collection_round" (
    "round_id" SERIAL NOT NULL,
    "round_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "location_note" TEXT,
    "village_area_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_by" INTEGER,

    CONSTRAINT "collection_round_pkey" PRIMARY KEY ("round_id")
);

-- CreateTable
CREATE TABLE "sale_request" (
    "request_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "request_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickup_address" TEXT,
    "pickup_lat" DOUBLE PRECISION,
    "pickup_lng" DOUBLE PRECISION,
    "estimated_quantity" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "note" TEXT,

    CONSTRAINT "sale_request_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "pickup_route_plan" (
    "route_plan_id" SERIAL NOT NULL,
    "round_id" INTEGER,
    "village_area_id" INTEGER,
    "buyer_id" INTEGER NOT NULL,
    "plan_date" TIMESTAMP(3) NOT NULL,
    "start_lat" DOUBLE PRECISION,
    "start_lng" DOUBLE PRECISION,
    "total_distance_km" DOUBLE PRECISION,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "confirmed_by" INTEGER,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_route_plan_pkey" PRIMARY KEY ("route_plan_id")
);

-- CreateTable
CREATE TABLE "pickup_route_stop" (
    "route_stop_id" SERIAL NOT NULL,
    "route_plan_id" INTEGER NOT NULL,
    "request_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "leg_distance_km" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "marked_at" TIMESTAMP(3),
    "marked_by" INTEGER,
    "note" TEXT,

    CONSTRAINT "pickup_route_stop_pkey" PRIMARY KEY ("route_stop_id")
);

-- CreateTable
CREATE TABLE "sale_request_item" (
    "request_item_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "waste_type_id" INTEGER NOT NULL,
    "estimated_quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sale_request_item_pkey" PRIMARY KEY ("request_item_id")
);

-- CreateTable
CREATE TABLE "waste_sale" (
    "sale_id" SERIAL NOT NULL,
    "sale_no" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "request_id" INTEGER,
    "sale_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "fund_deduct_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_amount" DOUBLE PRECISION NOT NULL,
    "recorded_by" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',

    CONSTRAINT "waste_sale_pkey" PRIMARY KEY ("sale_id")
);

-- CreateTable
CREATE TABLE "sale_document" (
    "sale_document_id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "note" TEXT,
    "uploaded_by" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_document_pkey" PRIMARY KEY ("sale_document_id")
);

-- CreateTable
CREATE TABLE "waste_sale_detail" (
    "sale_detail_id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "waste_type_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "waste_sale_detail_pkey" PRIMARY KEY ("sale_detail_id")
);

-- CreateTable
CREATE TABLE "receipt" (
    "receipt_id" SERIAL NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "fund_amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL,
    "issued_by" INTEGER,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("receipt_id")
);

-- CreateTable
CREATE TABLE "fund_transaction" (
    "fund_transaction_id" SERIAL NOT NULL,
    "fund_account_id" INTEGER NOT NULL,
    "member_id" INTEGER,
    "sale_id" INTEGER,
    "funeral_case_id" INTEGER,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_type" TEXT NOT NULL,
    "amount_in" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_out" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "recorded_by" INTEGER,
    "note" TEXT,

    CONSTRAINT "fund_transaction_pkey" PRIMARY KEY ("fund_transaction_id")
);

-- CreateTable
CREATE TABLE "member_fund_balance" (
    "member_fund_balance_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "total_contribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_contribution_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_fund_balance_pkey" PRIMARY KEY ("member_fund_balance_id")
);

-- CreateTable
CREATE TABLE "funeral_case" (
    "funeral_case_id" SERIAL NOT NULL,
    "deceased_member_id" INTEGER NOT NULL,
    "required_amount" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "event_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "death_date" TIMESTAMP(3) NOT NULL,
    "cause_of_death" TEXT NOT NULL,
    "recorded_by" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "report_note" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funeral_case_pkey" PRIMARY KEY ("funeral_case_id")
);

-- CreateTable
CREATE TABLE "funeral_contribution" (
    "funeral_contribution_id" SERIAL NOT NULL,
    "funeral_case_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "required_amount" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "fund_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "personal_fund_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shortfall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "personal_fund_balance_after" DOUBLE PRECISION NOT NULL,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funeral_contribution_pkey" PRIMARY KEY ("funeral_contribution_id")
);

-- CreateTable
CREATE TABLE "eligibility_check" (
    "eligibility_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "check_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_month_count" INTEGER NOT NULL,
    "continuous_month_count" INTEGER NOT NULL,
    "is_eligible" BOOLEAN NOT NULL,
    "reason" TEXT,
    "checked_by" INTEGER,

    CONSTRAINT "eligibility_check_pkey" PRIMARY KEY ("eligibility_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "news" (
    "news_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("news_id")
);

-- CreateTable
CREATE TABLE "banner" (
    "banner_id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "text_intro" TEXT,
    "text_main" TEXT,

    CONSTRAINT "banner_pkey" PRIMARY KEY ("banner_id")
);

-- CreateTable
CREATE TABLE "member_type" (
    "member_type_id" SERIAL NOT NULL,
    "type_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_type_pkey" PRIMARY KEY ("member_type_id")
);

-- CreateTable
CREATE TABLE "system_log" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "target_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "waste_sorting_video" (
    "video_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "video_url" TEXT NOT NULL,
    "cover_url" TEXT,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waste_sorting_video_pkey" PRIMARY KEY ("video_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_role_name_key" ON "role"("role_name");

-- CreateIndex
CREATE INDEX "waste_type_status_idx" ON "waste_type"("status");

-- CreateIndex
CREATE INDEX "waste_type_proposed_by_idx" ON "waste_type"("proposed_by");

-- CreateIndex
CREATE INDEX "waste_price_history_waste_type_id_idx" ON "waste_price_history"("waste_type_id");

-- CreateIndex
CREATE INDEX "waste_price_history_buyer_id_idx" ON "waste_price_history"("buyer_id");

-- CreateIndex
CREATE INDEX "waste_price_history_effective_from_idx" ON "waste_price_history"("effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "fund_account_account_name_key" ON "fund_account"("account_name");

-- CreateIndex
CREATE INDEX "village_area_moo_idx" ON "village_area"("moo");

-- CreateIndex
CREATE UNIQUE INDEX "system_setting_setting_key_key" ON "system_setting"("setting_key");

-- CreateIndex
CREATE INDEX "household_village_area_id_idx" ON "household"("village_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_member_code_key" ON "member"("member_code");

-- CreateIndex
CREATE UNIQUE INDEX "member_citizen_id_key" ON "member"("citizen_id");

-- CreateIndex
CREATE INDEX "member_household_id_idx" ON "member"("household_id");

-- CreateIndex
CREATE INDEX "member_status_idx" ON "member"("status");

-- CreateIndex
CREATE INDEX "member_status_history_member_id_idx" ON "member_status_history"("member_id");

-- CreateIndex
CREATE INDEX "member_status_history_changed_at_idx" ON "member_status_history"("changed_at");

-- CreateIndex
CREATE INDEX "member_document_member_id_idx" ON "member_document"("member_id");

-- CreateIndex
CREATE INDEX "member_document_document_type_idx" ON "member_document"("document_type");

-- CreateIndex
CREATE INDEX "member_verification_member_id_idx" ON "member_verification"("member_id");

-- CreateIndex
CREATE INDEX "member_guarantor_member_id_idx" ON "member_guarantor"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_member_id_key" ON "user_account"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_username_key" ON "user_account"("username");

-- CreateIndex
CREATE INDEX "user_account_village_area_id_idx" ON "user_account"("village_area_id");

-- CreateIndex
CREATE INDEX "user_account_buyer_id_idx" ON "user_account"("buyer_id");

-- CreateIndex
CREATE INDEX "login_audit_user_id_idx" ON "login_audit"("user_id");

-- CreateIndex
CREATE INDEX "login_audit_created_at_idx" ON "login_audit"("created_at");

-- CreateIndex
CREATE INDEX "collection_round_village_area_id_idx" ON "collection_round"("village_area_id");

-- CreateIndex
CREATE INDEX "collection_round_round_date_idx" ON "collection_round"("round_date");

-- CreateIndex
CREATE INDEX "sale_request_member_id_idx" ON "sale_request"("member_id");

-- CreateIndex
CREATE INDEX "sale_request_round_id_idx" ON "sale_request"("round_id");

-- CreateIndex
CREATE INDEX "sale_request_status_idx" ON "sale_request"("status");

-- CreateIndex
CREATE INDEX "pickup_route_plan_buyer_id_idx" ON "pickup_route_plan"("buyer_id");

-- CreateIndex
CREATE INDEX "pickup_route_plan_village_area_id_idx" ON "pickup_route_plan"("village_area_id");

-- CreateIndex
CREATE INDEX "pickup_route_plan_status_idx" ON "pickup_route_plan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_route_plan_round_id_village_area_id_key" ON "pickup_route_plan"("round_id", "village_area_id");

-- CreateIndex
CREATE INDEX "pickup_route_stop_status_idx" ON "pickup_route_stop"("status");

-- CreateIndex
CREATE INDEX "pickup_route_stop_request_id_idx" ON "pickup_route_stop"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_route_stop_route_plan_id_request_id_key" ON "pickup_route_stop"("route_plan_id", "request_id");

-- CreateIndex
CREATE INDEX "sale_request_item_request_id_idx" ON "sale_request_item"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "waste_sale_sale_no_key" ON "waste_sale"("sale_no");

-- CreateIndex
CREATE UNIQUE INDEX "waste_sale_request_id_key" ON "waste_sale"("request_id");

-- CreateIndex
CREATE INDEX "waste_sale_member_id_sale_date_idx" ON "waste_sale"("member_id", "sale_date");

-- CreateIndex
CREATE INDEX "waste_sale_round_id_idx" ON "waste_sale"("round_id");

-- CreateIndex
CREATE INDEX "waste_sale_sale_date_idx" ON "waste_sale"("sale_date");

-- CreateIndex
CREATE INDEX "sale_document_sale_id_idx" ON "sale_document"("sale_id");

-- CreateIndex
CREATE INDEX "waste_sale_detail_sale_id_idx" ON "waste_sale_detail"("sale_id");

-- CreateIndex
CREATE INDEX "waste_sale_detail_waste_type_id_idx" ON "waste_sale_detail"("waste_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_receipt_no_key" ON "receipt"("receipt_no");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_sale_id_key" ON "receipt"("sale_id");

-- CreateIndex
CREATE INDEX "fund_transaction_member_id_transaction_date_idx" ON "fund_transaction"("member_id", "transaction_date");

-- CreateIndex
CREATE INDEX "fund_transaction_sale_id_idx" ON "fund_transaction"("sale_id");

-- CreateIndex
CREATE INDEX "fund_transaction_funeral_case_id_idx" ON "fund_transaction"("funeral_case_id");

-- CreateIndex
CREATE INDEX "fund_transaction_transaction_date_idx" ON "fund_transaction"("transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "member_fund_balance_member_id_key" ON "member_fund_balance"("member_id");

-- CreateIndex
CREATE INDEX "funeral_case_deceased_member_id_idx" ON "funeral_case"("deceased_member_id");

-- CreateIndex
CREATE INDEX "funeral_case_status_idx" ON "funeral_case"("status");

-- CreateIndex
CREATE INDEX "funeral_contribution_member_id_idx" ON "funeral_contribution"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "funeral_contribution_funeral_case_id_member_id_key" ON "funeral_contribution"("funeral_case_id", "member_id");

-- CreateIndex
CREATE INDEX "eligibility_check_member_id_idx" ON "eligibility_check"("member_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_type_type_name_key" ON "member_type"("type_name");

-- CreateIndex
CREATE INDEX "system_log_user_id_idx" ON "system_log"("user_id");

-- CreateIndex
CREATE INDEX "system_log_created_at_idx" ON "system_log"("created_at");

-- AddForeignKey
ALTER TABLE "waste_price_history" ADD CONSTRAINT "waste_price_history_waste_type_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_type"("waste_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_price_history" ADD CONSTRAINT "waste_price_history_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer"("buyer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household" ADD CONSTRAINT "household_village_area_id_fkey" FOREIGN KEY ("village_area_id") REFERENCES "village_area"("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("household_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_status_history" ADD CONSTRAINT "member_status_history_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_document" ADD CONSTRAINT "member_document_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_verification" ADD CONSTRAINT "member_verification_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_guarantor" ADD CONSTRAINT "member_guarantor_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_village_area_id_fkey" FOREIGN KEY ("village_area_id") REFERENCES "village_area"("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer"("buyer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_audit" ADD CONSTRAINT "login_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_round" ADD CONSTRAINT "collection_round_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer"("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_round" ADD CONSTRAINT "collection_round_village_area_id_fkey" FOREIGN KEY ("village_area_id") REFERENCES "village_area"("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_request" ADD CONSTRAINT "sale_request_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_request" ADD CONSTRAINT "sale_request_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round"("round_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_route_plan" ADD CONSTRAINT "pickup_route_plan_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round"("round_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_route_plan" ADD CONSTRAINT "pickup_route_plan_village_area_id_fkey" FOREIGN KEY ("village_area_id") REFERENCES "village_area"("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_route_plan" ADD CONSTRAINT "pickup_route_plan_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer"("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_route_stop" ADD CONSTRAINT "pickup_route_stop_route_plan_id_fkey" FOREIGN KEY ("route_plan_id") REFERENCES "pickup_route_plan"("route_plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_route_stop" ADD CONSTRAINT "pickup_route_stop_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "sale_request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_request_item" ADD CONSTRAINT "sale_request_item_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "sale_request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_request_item" ADD CONSTRAINT "sale_request_item_waste_type_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_type"("waste_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_sale" ADD CONSTRAINT "waste_sale_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_sale" ADD CONSTRAINT "waste_sale_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round"("round_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_sale" ADD CONSTRAINT "waste_sale_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer"("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_sale" ADD CONSTRAINT "waste_sale_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "sale_request"("request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_document" ADD CONSTRAINT "sale_document_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "waste_sale"("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_sale_detail" ADD CONSTRAINT "waste_sale_detail_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "waste_sale"("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_sale_detail" ADD CONSTRAINT "waste_sale_detail_waste_type_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_type"("waste_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "waste_sale"("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transaction" ADD CONSTRAINT "fund_transaction_fund_account_id_fkey" FOREIGN KEY ("fund_account_id") REFERENCES "fund_account"("fund_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transaction" ADD CONSTRAINT "fund_transaction_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transaction" ADD CONSTRAINT "fund_transaction_funeral_case_id_fkey" FOREIGN KEY ("funeral_case_id") REFERENCES "funeral_case"("funeral_case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_fund_balance" ADD CONSTRAINT "member_fund_balance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funeral_case" ADD CONSTRAINT "funeral_case_deceased_member_id_fkey" FOREIGN KEY ("deceased_member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funeral_contribution" ADD CONSTRAINT "funeral_contribution_funeral_case_id_fkey" FOREIGN KEY ("funeral_case_id") REFERENCES "funeral_case"("funeral_case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funeral_contribution" ADD CONSTRAINT "funeral_contribution_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_check" ADD CONSTRAINT "eligibility_check_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

