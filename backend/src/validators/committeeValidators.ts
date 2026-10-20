import { z } from "zod";
import {
  MEMBER_FUND_FILTER,
  MEMBER_STATUS,
  SALE_REQUEST_STATUS,
  VERIFICATION_RESULT,
} from "../config/constants.js";

// Committee (Waste Bank / Village Committee) member-management endpoints.
// Bodies are JSON; list filters arrive as query strings - hence z.coerce there.

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

const dateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

export const committeeIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const committeeMemberDocumentParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  documentId: z.coerce.number().int().positive(),
});

const addressSchema = z.object({
  houseNo: z.string().optional(),
  moo: z.string().optional(),
  subdistrict: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  postcode: z.string().optional(),
});

const guarantorSchema = z.object({
  guarantorName: z.string().min(1),
  guarantorPhone: z.string().optional(),
  relationship: z.string().optional(),
  note: z.string().optional(),
});

export const committeeMemberListQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  // Matches name / citizen ID / phone / member code (contains).
  search: z.string().trim().min(1).optional(),
  status: z
    .enum(Object.values(MEMBER_STATUS) as [string, ...string[]])
    .optional(),
  // Not a member.status: selects members still under the 50-baht minimum.
  fundStatus: z
    .enum(Object.values(MEMBER_FUND_FILTER) as [string, ...string[]])
    .optional(),
  moo: z.string().trim().min(1).optional(),
  villageAreaId: z.coerce.number().int().positive().optional(),
});
export type CommitteeMemberListQuery = z.infer<
  typeof committeeMemberListQuerySchema
>;

export const committeeHouseholdListQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: z.string().trim().min(1).optional(),
  moo: z.string().trim().min(1).optional(),
  villageAreaId: z.coerce.number().int().positive().optional(),
});
export type CommitteeHouseholdListQuery = z.infer<
  typeof committeeHouseholdListQuerySchema
>;

// Walk-in applicant registered at the desk by the committee. Mirrors the public
// registerSchema, except the password is optional - when omitted the account's
// initial password defaults to the citizen ID (committeeService.createMember).
export const committeeCreateMemberSchema = z
  .object({
    citizenId: z.string().regex(/^\d{13}$/, "citizenId must be 13 digits"),
    password: z
      .string()
      .min(8, "password must be at least 8 characters")
      .optional(),
    prefix: z.string().optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    birthDate: dateStringSchema,
    gender: z.string().optional(),
    phone: z.string().min(6),
    occupation: z.string().optional(),
    remark: z.string().optional(),
    householdId: z.coerce.number().int().positive().optional(),
    address: addressSchema.optional(),
    guarantor: guarantorSchema.optional(),
  })
  .refine((input) => Boolean(input.householdId || input.address), {
    message: "householdId or address is required",
    path: ["address"],
  });
export type CommitteeCreateMemberInput = z.infer<
  typeof committeeCreateMemberSchema
>;

export const committeeUpdateMemberSchema = z.object({
  prefix: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  birthDate: dateStringSchema.optional(),
  gender: z.string().optional(),
  phone: z.string().min(6).optional(),
  occupation: z.string().optional(),
  remark: z.string().optional(),
  address: addressSchema.optional(),
  // Replaces the member's primary guarantor (or creates one if none yet).
  guarantor: guarantorSchema.optional(),
});
export type CommitteeUpdateMemberInput = z.infer<
  typeof committeeUpdateMemberSchema
>;

// A member who forgot their password asks the committee at the desk; the
// committee types the new one (committeeService.resetMemberPassword).
export const committeeResetMemberPasswordSchema = z.object({
  newPassword: z.string().min(8, "password must be at least 8 characters"),
});
export type CommitteeResetMemberPasswordInput = z.infer<
  typeof committeeResetMemberPasswordSchema
>;

// Age is not accepted from the client - committeeService.recordVerification
// computes it from the stored birth date so the record can't be forged.
export const committeeVerificationSchema = z.object({
  // The committee certifies the age; the system only calculates it.
  ageVerified: z.boolean(),
  addressVerified: z.boolean(),
  guarantorVerified: z.boolean(),
  result: z.enum(Object.values(VERIFICATION_RESULT) as [string, ...string[]]),
  note: z.string().optional(),
});
export type CommitteeVerificationInput = z.infer<
  typeof committeeVerificationSchema
>;

// Optional note stored on the member's remark when cancelling a membership.
export const committeeStatusNoteSchema = z.object({
  note: z.string().optional(),
});
export type CommitteeStatusNoteInput = z.infer<
  typeof committeeStatusNoteSchema
>;

// Marking a member deceased (multipart/form-data: fields arrive as strings,
// death certificate file is validated separately via req.file in the
// controller). deathDate stays a validated string here, same as birthDate
// above - committeeService converts it with `new Date(...)`.
export const committeeMarkDeceasedSchema = z.object({
  deathDate: dateStringSchema,
  causeOfDeath: z.string().trim().min(1, "causeOfDeath is required").max(500),
  note: z.string().optional(),
});
export type CommitteeMarkDeceasedInput = z.infer<
  typeof committeeMarkDeceasedSchema
>;

export const committeeMemberDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(50),
  note: z.string().trim().max(500).optional(),
});
export type CommitteeMemberDocumentInput = z.infer<
  typeof committeeMemberDocumentSchema
>;

// --- Sell-request management (pickup planning + actual purchase recording) ---

export const committeeSellRequestListQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  status: z
    .enum(Object.values(SALE_REQUEST_STATUS) as [string, ...string[]])
    .optional(),
  roundId: z.coerce.number().int().positive().optional(),
  // Matches member name / code / phone (contains).
  search: z.string().trim().min(1).optional(),
  // Route planner: leave out requests already sitting on a live route stop
  // (routePlanService.activeRouteStopWhere). Query strings carry 'true'/'false'.
  unrouted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // located=false: only requests without a pinned location (they can't be on
  // the round's run). Query strings carry 'true'/'false'.
  located: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  villageAreaId: z.coerce.number().int().positive().optional(),
});
export type CommitteeSellRequestListQuery = z.infer<
  typeof committeeSellRequestListQuerySchema
>;
export const committeeSellRequestSummaryQuerySchema = z.object({
  roundId: z.coerce.number().int().positive().optional(),
});

// Actual purchase recorded at pickup. Lines are NOT restricted to the waste
// types the member declared - the committee may add types found on site.
// unitPrice omitted -> waste_type.default_price at recording time.
// depositAmount: after the automatic top-up to FUND_MINIMUM_BAHT, how much of
// the remaining money the member keeps in their savings (default 0 = all
// cash). Capped at that remainder by recordPurchase. Savings can't be withdrawn.
export const committeePurchaseSchema = z.object({
  items: z
    .array(
      z.object({
        wasteTypeId: z.number().int().positive(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0).optional(),
      }),
    )
    .min(1, "at least one purchased item is required"),
  depositAmount: z.number().min(0).optional().default(0),
  note: z.string().optional(),
});
export type CommitteePurchaseInput = z.infer<typeof committeePurchaseSchema>;
