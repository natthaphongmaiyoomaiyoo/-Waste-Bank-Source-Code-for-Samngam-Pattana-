-- Pickup route plans. The village committee orders the day's confirmed sell
-- requests on a map and confirms the result; confirming persists the plan here
-- and hands it to the buyer, who marks each stop as "heading there next" or
-- "collected" while driving the run.
--
-- user_account.buyer_id binds a buyer login to the shop it works for, the same
-- way village_area_id binds a committee login to its village - it is what scopes
-- a buyer to their own plans.

-- AlterTable
ALTER TABLE "user_account" ADD COLUMN "buyer_id" INTEGER REFERENCES "buyer" ("buyer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "user_account_buyer_id_idx" ON "user_account"("buyer_id");

-- Existing buyer logins predate this column. Link any that are still unbound to
-- the first buyer row so seeded/demo accounts keep working instead of being
-- locked out by buyerScope.
UPDATE "user_account"
SET "buyer_id" = (SELECT MIN("buyer_id") FROM "buyer")
WHERE "buyer_id" IS NULL
  AND "role_id" IN (SELECT "role_id" FROM "role" WHERE "role_name" = 'buyer')
  AND EXISTS (SELECT 1 FROM "buyer");

-- CreateTable
CREATE TABLE "pickup_route_plan" (
    "route_plan_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "village_area_id" INTEGER,
    "buyer_id" INTEGER NOT NULL,
    "plan_date" DATETIME NOT NULL,
    "start_lat" REAL,
    "start_lng" REAL,
    "total_distance_km" REAL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "confirmed_by" INTEGER,
    "confirmed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pickup_route_plan_village_area_id_fkey" FOREIGN KEY ("village_area_id") REFERENCES "village_area" ("village_area_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pickup_route_plan_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer" ("buyer_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "pickup_route_plan_buyer_id_idx" ON "pickup_route_plan"("buyer_id");
CREATE INDEX "pickup_route_plan_village_area_id_idx" ON "pickup_route_plan"("village_area_id");
CREATE INDEX "pickup_route_plan_status_idx" ON "pickup_route_plan"("status");

-- CreateTable
CREATE TABLE "pickup_route_stop" (
    "route_stop_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "route_plan_id" INTEGER NOT NULL,
    "request_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "leg_distance_km" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "marked_at" DATETIME,
    "marked_by" INTEGER,
    "note" TEXT,
    CONSTRAINT "pickup_route_stop_route_plan_id_fkey" FOREIGN KEY ("route_plan_id") REFERENCES "pickup_route_plan" ("route_plan_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pickup_route_stop_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "sale_request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_route_stop_route_plan_id_request_id_key" ON "pickup_route_stop"("route_plan_id", "request_id");
CREATE INDEX "pickup_route_stop_status_idx" ON "pickup_route_stop"("status");
