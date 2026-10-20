import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const masterListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  // A table column to sort on; each list accepts only its own columns and
  // falls back to its usual order otherwise.
  sortBy: z.string().trim().min(1).max(40).optional(),
  descending: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type MasterListQuery = z.infer<typeof masterListQuerySchema>;

export const buyerSchema = z.object({
  buyerName: z.string().trim().min(1),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export type BuyerInput = z.infer<typeof buyerSchema>;

export const villageAreaSchema = z.object({
  villageName: z.string().trim().min(1),
  moo: z.string().trim().optional(),
  subdistrict: z.string().trim().optional(),
  district: z.string().trim().optional(),
  province: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export type VillageAreaInput = z.infer<typeof villageAreaSchema>;

export const fundAccountSchema = z.object({
  accountName: z.string().trim().min(1),
  balance: z.coerce.number().min(0).optional(),
});
export type FundAccountInput = z.infer<typeof fundAccountSchema>;

export const wastePriceHistorySchema = z.object({
  wasteTypeId: z.coerce.number().int().positive(),
  buyerId: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().min(0),
  effectiveFrom: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date'),
  effectiveTo: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
    .optional(),
});
export type WastePriceHistoryInput = z.infer<typeof wastePriceHistorySchema>;

export const systemSettingSchema = z.object({
  settingKey: z.string().trim().min(1).max(100),
  settingValue: z.string(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  description: z.string().trim().optional(),
});
export type SystemSettingInput = z.infer<typeof systemSettingSchema>;

