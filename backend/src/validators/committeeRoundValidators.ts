import { z } from 'zod';
import { COLLECTION_ROUND_STATUS } from '../config/constants.js';

// Collection rounds ("รอบรับซื้อขยะ") a village committee schedules for its own
// village. The village itself is never taken from the client - it comes from the
// caller's scope (see committeeRoundService).

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาต้องอยู่ในรูปแบบ HH:mm');

const dateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'รูปแบบวันที่ไม่ถูกต้อง');

export const committeeRoundIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const committeeRoundListQuerySchema = z.object({
  status: z.enum(Object.values(COLLECTION_ROUND_STATUS) as [string, ...string[]]).optional(),
  // 'upcoming' (default) hides rounds whose date has already passed.
  scope: z.enum(['upcoming', 'all']).default('upcoming'),
  // The round management page lists only the committee's own village's rounds,
  // leaving out the municipality-wide ones it can't edit. The sell-request pages
  // leave this off: members may book those rounds too. 'true'/'false'.
  ownVillageOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  villageAreaId: z.coerce.number().int().positive().optional(),
  // Opt-in paging for the round tables: without `page` every matching round
  // comes back, as the month-by-month timeline pages expect.
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  // Matches the Thai date (short or long form, weekday), times, buyer, meeting
  // point and village - the same text the tables show.
  search: z.string().trim().min(1).max(100).optional(),
  // Newest first when 'true'; oldest first otherwise.
  descending: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type CommitteeRoundListQuery = z.infer<typeof committeeRoundListQuerySchema>;

const roundBodySchema = z.object({
  roundDate: dateStringSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  buyerId: z.coerce.number().int().positive({ message: 'กรุณาเลือกผู้รับซื้อ' }),
  locationNote: z.string().trim().max(300).optional(),
});

export const committeeRoundCreateSchema = roundBodySchema.refine(
  (input) => input.endTime > input.startTime,
  { message: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม', path: ['endTime'] },
);
export type CommitteeRoundCreateInput = z.infer<typeof committeeRoundCreateSchema>;

export const committeeRoundUpdateSchema = roundBodySchema
  .partial()
  .refine(
    (input) =>
      input.startTime === undefined ||
      input.endTime === undefined ||
      input.endTime > input.startTime,
    { message: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม', path: ['endTime'] },
  );
export type CommitteeRoundUpdateInput = z.infer<typeof committeeRoundUpdateSchema>;
