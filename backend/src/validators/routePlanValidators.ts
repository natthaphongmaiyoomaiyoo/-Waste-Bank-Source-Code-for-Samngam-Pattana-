import { z } from 'zod';
import { ROUTE_PLAN_STATUS, ROUTE_STOP_STATUS } from '../config/constants.js';

export const routePlanIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const routeStopParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  stopId: z.coerce.number().int().positive(),
});

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

// Where the committee wants the run to start; the unvisited stops are
// re-ordered from it.
export const routePlanStartSchema = z.object({
  lat: latitude,
  lng: longitude,
});
export type RoutePlanStartInput = z.infer<typeof routePlanStartSchema>;

export const markRouteStopSchema = z.object({
  status: z.enum([
    ROUTE_STOP_STATUS.PENDING,
    ROUTE_STOP_STATUS.NEXT,
    ROUTE_STOP_STATUS.COLLECTED,
    ROUTE_STOP_STATUS.SKIPPED,
  ]),
  note: z.string().trim().max(500).optional(),
});
export type MarkRouteStopInput = z.infer<typeof markRouteStopSchema>;

export const routePlanListQuerySchema = z.object({
  status: z
    .enum([
      ROUTE_PLAN_STATUS.SENT,
      ROUTE_PLAN_STATUS.IN_PROGRESS,
      ROUTE_PLAN_STATUS.COMPLETED,
      ROUTE_PLAN_STATUS.CANCELLED,
      'all',
    ])
    .optional(),
  // Committee planner only: plans whose stops come from this collection round.
  roundId: z.coerce.number().int().positive().optional(),
  // Opt-in paging: without `page` the list comes back as a plain array.
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
