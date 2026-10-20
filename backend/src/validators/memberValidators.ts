import { z } from 'zod';

export const updateProfileSchema = z.object({
  prefix: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  gender: z.string().optional(),
  phone: z.string().min(6).optional(),
  occupation: z.string().optional(),
  address: z
    .object({
      houseNo: z.string().optional(),
      moo: z.string().optional(),
      subdistrict: z.string().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
      postcode: z.string().optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
