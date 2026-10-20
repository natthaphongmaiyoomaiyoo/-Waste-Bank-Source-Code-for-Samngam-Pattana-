import type { Request, Response } from 'express';
import * as routePlanService from '../services/routePlanService.js';
import { buyerScopeOf } from '../middleware/buyerScope.js';
import { villageScopeOf } from '../middleware/villageScope.js';
import {
  markRouteStopSchema,
  routePlanIdParamSchema,
  routePlanListQuerySchema,
  routePlanStartSchema,
  routeStopParamsSchema,
} from '../validators/routePlanValidators.js';

// --- Committee side ---
// Plans are built by the system as requests are accepted
// (routePlanService.addRequestToRoundPlan); the committee reads them and picks
// where the run starts.

export async function listCommitteePlans(req: Request, res: Response) {
  const { status, roundId, page, pageSize } = routePlanListQuerySchema.parse(req.query);
  const scope = villageScopeOf(req);
  res.json(
    page
      ? await routePlanService.listPlansForCommitteePage(scope, { status, roundId, page, pageSize })
      : await routePlanService.listPlansForCommittee(scope, status, roundId),
  );
}

export async function getCommitteePlan(req: Request, res: Response) {
  const { id } = routePlanIdParamSchema.parse(req.params);
  res.json(
    await routePlanService.getPlan(id, { villageScope: villageScopeOf(req), buyerScope: null }),
  );
}

export async function setStartPoint(req: Request, res: Response) {
  const { id } = routePlanIdParamSchema.parse(req.params);
  const input = routePlanStartSchema.parse(req.body);
  res.json(await routePlanService.setPlanStartPoint(id, input, villageScopeOf(req)));
}

// --- Buyer side ---

export async function listBuyerPlans(req: Request, res: Response) {
  const { status } = routePlanListQuerySchema.parse(req.query);
  res.json(await routePlanService.listPlansForBuyer(buyerScopeOf(req), status));
}

export async function getBuyerPlan(req: Request, res: Response) {
  const { id } = routePlanIdParamSchema.parse(req.params);
  res.json(
    await routePlanService.getPlan(id, { villageScope: null, buyerScope: buyerScopeOf(req) }),
  );
}

export async function markStop(req: Request, res: Response) {
  const { id, stopId } = routeStopParamsSchema.parse(req.params);
  const input = markRouteStopSchema.parse(req.body);
  res.json(await routePlanService.markStop(id, stopId, input, req.auth!.userId, buyerScopeOf(req)));
}
