-- A route plan now belongs to one collection round: one plan per round per
-- village, kept in step with the round's accepted requests by the API.

-- AlterTable
ALTER TABLE "pickup_route_plan" ADD COLUMN     "round_id" INTEGER;

-- Every plan was built from a single round's requests: read it off its stops.
-- Cancelled plans keep a null round, so they stay as history without counting
-- towards one-plan-per-round.
UPDATE "pickup_route_plan" p
   SET "round_id" = (
         SELECT r."round_id"
           FROM "pickup_route_stop" s
           JOIN "sale_request" r ON r."request_id" = s."request_id"
          WHERE s."route_plan_id" = p."route_plan_id"
          ORDER BY s."sequence"
          LIMIT 1)
 WHERE p."status" <> 'cancelled';

-- Rounds that ended up with several plans: move every stop onto the oldest
-- plan of that round and village, then drop the emptied plans.
WITH "keeper" AS (
  SELECT "round_id", "village_area_id", MIN("route_plan_id") AS "keep_id"
    FROM "pickup_route_plan"
   WHERE "round_id" IS NOT NULL
   GROUP BY "round_id", "village_area_id"
  HAVING COUNT(*) > 1
)
UPDATE "pickup_route_stop" s
   SET "route_plan_id" = k."keep_id"
  FROM "pickup_route_plan" p
  JOIN "keeper" k
    ON k."round_id" = p."round_id"
   AND k."village_area_id" IS NOT DISTINCT FROM p."village_area_id"
 WHERE s."route_plan_id" = p."route_plan_id"
   AND p."route_plan_id" <> k."keep_id";

DELETE FROM "pickup_route_plan" p
 WHERE p."round_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "pickup_route_stop" s WHERE s."route_plan_id" = p."route_plan_id");

-- Number each plan's stops again: stops already worked first, in the order
-- they were marked, then the rest in their old order. The API re-orders the
-- unvisited part (and recomputes distances) on its next change.
UPDATE "pickup_route_stop" s
   SET "sequence" = n."seq"
  FROM (
    SELECT "route_stop_id",
           ROW_NUMBER() OVER (
             PARTITION BY "route_plan_id"
             ORDER BY ("status" IN ('collected', 'skipped')) DESC, "marked_at" NULLS LAST, "sequence", "route_stop_id"
           ) AS "seq"
      FROM "pickup_route_stop"
  ) n
 WHERE n."route_stop_id" = s."route_stop_id";

-- Same rule as routePlanService.planStatusOf.
UPDATE "pickup_route_plan" p
   SET "status" = CASE
         WHEN NOT EXISTS (SELECT 1 FROM "pickup_route_stop" s
                           WHERE s."route_plan_id" = p."route_plan_id" AND s."status" IN ('pending', 'next'))
           THEN 'completed'
         WHEN EXISTS (SELECT 1 FROM "pickup_route_stop" s
                       WHERE s."route_plan_id" = p."route_plan_id" AND s."status" IN ('next', 'collected', 'skipped'))
           THEN 'in_progress'
         ELSE 'sent'
       END
 WHERE p."round_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "pickup_route_plan_round_id_village_area_id_key" ON "pickup_route_plan"("round_id", "village_area_id");

-- AddForeignKey
ALTER TABLE "pickup_route_plan" ADD CONSTRAINT "pickup_route_plan_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "collection_round"("round_id") ON DELETE SET NULL ON UPDATE CASCADE;
