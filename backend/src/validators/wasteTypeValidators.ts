import { z } from 'zod';
import { WASTE_TYPE_STATUS } from '../config/constants.js';

export const wasteTypeIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createWasteTypeSchema = z.object({
  wasteName: z.string().min(1, 'wasteName is required'),
  unit: z.string().min(1, 'unit is required').default('kg'),
  defaultPrice: z.coerce.number().min(0, 'defaultPrice must be non-negative'),
});
export type CreateWasteTypeInput = z.infer<typeof createWasteTypeSchema>;

export const updateWasteTypeSchema = createWasteTypeSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);
export type UpdateWasteTypeInput = z.infer<typeof updateWasteTypeSchema>;

// What a buyer submits: same shape as an admin create, but the price is only a
// suggestion until an admin approves it.
export const proposeWasteTypeSchema = createWasteTypeSchema;
export type ProposeWasteTypeInput = z.infer<typeof proposeWasteTypeSchema>;

// Admin may correct the buyer's suggested name/unit/price while approving.
export const reviewWasteTypeSchema = createWasteTypeSchema.partial();
export type ReviewWasteTypeInput = z.infer<typeof reviewWasteTypeSchema>;

export const rejectWasteTypeSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required'),
});
export type RejectWasteTypeInput = z.infer<typeof rejectWasteTypeSchema>;

export const proposalListQuerySchema = z.object({
  status: z
    .enum([
      WASTE_TYPE_STATUS.PENDING,
      WASTE_TYPE_STATUS.ACTIVE,
      WASTE_TYPE_STATUS.REJECTED,
      WASTE_TYPE_STATUS.INACTIVE,
      'all',
    ])
    .default(WASTE_TYPE_STATUS.PENDING),
});
