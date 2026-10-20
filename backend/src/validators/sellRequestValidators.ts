import { z } from 'zod';

export const createSellRequestSchema = z.object({
  roundId: z.number().int().positive(),
  pickupAddress: z.string().optional(),
  note: z.string().optional(),
  // Member's GPS position from the browser Geolocation API (shared with
  // consent on the sell-request page) so the committee can plan the pickup
  // route. Optional - members may decline the permission prompt.
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  // Stored per waste type in sale_request_item; sale_request.estimated_quantity
  // keeps the denormalized sum (the ERD field). Optional - the member page only
  // sends round + location now, and the committee records the actual waste
  // types and weights at pickup.
  items: z
    .array(
      z.object({
        wasteTypeId: z.number().int().positive(),
        estimatedQuantity: z.number().positive(),
      }),
    )
    .default([]),
});
export type CreateSellRequestInput = z.infer<typeof createSellRequestSchema>;

const descendingSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

// The member's own request list. Opt-in paging: without `page` every request
// comes back as a plain array (the sell-request form reads it that way).
export const sellRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(8),
  status: z.enum(['requested', 'confirmed', 'completed', 'cancelled']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(['date', 'quantity', 'status']).default('date'),
  descending: descendingSchema,
});
export type SellRequestListQuery = z.infer<typeof sellRequestListQuerySchema>;

// The member's sale history and savings ledger (GET /history/sales,
// GET /fund/transactions). Same opt-in paging.
export const memberHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  // 'amount' = the sale's totalAmount / the ledger row's amount.
  sortBy: z.enum(['date', 'amount']).default('date'),
  descending: descendingSchema,
});
export type MemberHistoryQuery = z.infer<typeof memberHistoryQuerySchema>;
