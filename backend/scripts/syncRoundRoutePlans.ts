// One-off repair, safe to run again: puts every accepted request that has a
// pinned location but no stop onto its round's run, then re-orders every run.
// Needed once, right after the per-round migration
// (20261012180000_route_plan_per_round), because requests accepted before it
// were only routed by hand.
//
//   npx tsx scripts/syncRoundRoutePlans.ts
//
// On the production server (compiled code only, no tsx), from the backend dir:
//   node --env-file=.env --input-type=module -e "const m = await import('./dist/services/routePlanService.js'); console.log(await m.syncAllRoundPlans())"
import { prisma } from '../src/database/prisma.js';
import { syncAllRoundPlans } from '../src/services/routePlanService.js';

try {
  console.log(await syncAllRoundPlans());
} finally {
  await prisma.$disconnect();
}
