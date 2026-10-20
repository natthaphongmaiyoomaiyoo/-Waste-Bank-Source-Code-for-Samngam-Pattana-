import { z } from 'zod';
import { USER_ACCOUNT_STATUS } from '../config/constants.js';

// Admin-side CRUD for village-committee accounts ("กรรมการหมู่บ้าน").
// A committee account is meaningless without the village it is responsible for,
// so villageAreaId is required on create and can never be cleared on update.

const statusSchema = z.enum([USER_ACCOUNT_STATUS.ACTIVE, USER_ACCOUNT_STATUS.INACTIVE]);

export const adminCommitteeIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const adminCommitteeListQuerySchema = z.object({
  // Matches username / full name / phone / village name / moo (contains).
  search: z.string().trim().min(1).optional(),
  status: statusSchema.optional(),
  villageAreaId: z.coerce.number().int().positive().optional(),
});
export type AdminCommitteeListQuery = z.infer<typeof adminCommitteeListQuerySchema>;

export const adminCommitteeCreateSchema = z.object({
  username: z.string().trim().min(3, 'ชื่อผู้ใช้อย่างน้อย 3 ตัวอักษร').max(50),
  password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร'),
  fullName: z.string().trim().min(1, 'กรุณาระบุชื่อ-นามสกุล').max(150),
  phone: z.string().trim().min(6).max(20).optional(),
  villageAreaId: z.coerce.number().int().positive({ message: 'กรุณาเลือกหมู่บ้านที่รับผิดชอบ' }),
  status: statusSchema.default(USER_ACCOUNT_STATUS.ACTIVE),
});
export type AdminCommitteeCreateInput = z.infer<typeof adminCommitteeCreateSchema>;

export const adminCommitteeUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  // Optional here (partial update), but never nullable - reassigning is fine,
  // unassigning is not.
  villageAreaId: z.coerce.number().int().positive().optional(),
  status: statusSchema.optional(),
  password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร').optional(),
});
export type AdminCommitteeUpdateInput = z.infer<typeof adminCommitteeUpdateSchema>;
