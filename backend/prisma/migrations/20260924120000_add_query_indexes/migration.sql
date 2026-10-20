-- CreateIndex
CREATE INDEX "eligibility_check_member_id_idx" ON "eligibility_check"("member_id");

-- CreateIndex
CREATE INDEX "fund_transaction_member_id_transaction_date_idx" ON "fund_transaction"("member_id", "transaction_date");

-- CreateIndex
CREATE INDEX "fund_transaction_sale_id_idx" ON "fund_transaction"("sale_id");

-- CreateIndex
CREATE INDEX "fund_transaction_funeral_case_id_idx" ON "fund_transaction"("funeral_case_id");

-- CreateIndex
CREATE INDEX "fund_transaction_transaction_date_idx" ON "fund_transaction"("transaction_date");

-- CreateIndex
CREATE INDEX "funeral_case_deceased_member_id_idx" ON "funeral_case"("deceased_member_id");

-- CreateIndex
CREATE INDEX "funeral_contribution_member_id_idx" ON "funeral_contribution"("member_id");

-- CreateIndex
CREATE INDEX "member_household_id_idx" ON "member"("household_id");

-- CreateIndex
CREATE INDEX "member_status_idx" ON "member"("status");

-- CreateIndex
CREATE INDEX "member_guarantor_member_id_idx" ON "member_guarantor"("member_id");

-- CreateIndex
CREATE INDEX "member_verification_member_id_idx" ON "member_verification"("member_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "pickup_route_stop_request_id_idx" ON "pickup_route_stop"("request_id");

-- CreateIndex
CREATE INDEX "sale_request_member_id_idx" ON "sale_request"("member_id");

-- CreateIndex
CREATE INDEX "sale_request_round_id_idx" ON "sale_request"("round_id");

-- CreateIndex
CREATE INDEX "sale_request_status_idx" ON "sale_request"("status");

-- CreateIndex
CREATE INDEX "sale_request_item_request_id_idx" ON "sale_request_item"("request_id");

-- CreateIndex
CREATE INDEX "waste_sale_member_id_sale_date_idx" ON "waste_sale"("member_id", "sale_date");

-- CreateIndex
CREATE INDEX "waste_sale_round_id_idx" ON "waste_sale"("round_id");

-- CreateIndex
CREATE INDEX "waste_sale_sale_date_idx" ON "waste_sale"("sale_date");

-- CreateIndex
CREATE INDEX "waste_sale_detail_sale_id_idx" ON "waste_sale_detail"("sale_id");

-- CreateIndex
CREATE INDEX "waste_sale_detail_waste_type_id_idx" ON "waste_sale_detail"("waste_type_id");

