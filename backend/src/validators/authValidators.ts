import { z } from 'zod';

const addressSchema = z.object({
  houseNo: z.string().optional(),
  moo: z.string().optional(),
  subdistrict: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  postcode: z.string().optional(),
});

export const registerSchema = z
  .object({
    citizenId: z.string().regex(/^\d{13}$/, 'citizenId must be 13 digits'),
    password: z.string().min(8, 'password must be at least 8 characters').optional(),
    prefix: z.string().optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'birthDate must be a valid date'),
    gender: z.string().optional(),
    phone: z.string().min(6),
    occupation: z.string().optional(),
    householdId: z.coerce.number().int().positive().optional(),
    address: addressSchema.optional(),
    guarantor: z
      .object({
        guarantorName: z.string().min(1),
        guarantorPhone: z.string().optional(),
        relationship: z.string().optional(),
        note: z.string().optional(),
      })
      .optional(),
  })
  .refine((input) => Boolean(input.householdId || input.address), {
    message: 'householdId or address is required',
    path: ['address'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1, 'identifier (citizen ID or phone) is required'),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'identifier is required'),
  phone: z.string().min(6, 'phone is required'),
  note: z.string().max(500).optional(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'reset token is required'),
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Deliberately excludes role/status/id/memberCode - those are admin/committee-only
// fields, never accepted from the account owner.
export const updateMeSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
