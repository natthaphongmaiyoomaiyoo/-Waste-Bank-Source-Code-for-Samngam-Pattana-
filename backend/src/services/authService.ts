import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../database/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { signAuthToken } from "../utils/jwt.js";
import { ageOn } from "../utils/age.js";
import { env } from '../config/env.js';
import {
  MEMBER_STATUS,
  USER_ACCOUNT_STATUS,
} from "../config/constants.js";
import { deleteStoredObject, publicFileUrl, storeUpload } from './storageService.js';
import { createWithNextMemberCode } from "./memberService.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
} from "../validators/authValidators.js";

const SALT_ROUNDS = 10;
const RESET_TOKEN_MINUTES = 30;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Relative path under backend/uploads -> absolute URL, same pattern as
// newsService.serialize (imageUrl).
function serializeAvatarUrl(avatarUrl: string | null): string | null {
  return publicFileUrl('avatars', avatarUrl);
}

interface PublicVillageArea {
  id: number;
  villageName: string;
  moo: string | null;
  subdistrict: string | null;
  status: string;
}

interface PublicBuyer {
  id: number;
  buyerName: string;
  status: string;
}

function publicUser(userAccount: {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: { roleName: string };
  mustChangePassword: boolean;
  lastLogin: Date | null;
  villageArea?: PublicVillageArea | null;
  buyer?: PublicBuyer | null;
}) {
  return {
    id: userAccount.id,
    username: userAccount.username,
    fullName: userAccount.fullName,
    phone: userAccount.phone,
    avatarUrl: serializeAvatarUrl(userAccount.avatarUrl),
    roleName: userAccount.role.roleName,
    mustChangePassword: userAccount.mustChangePassword,
    lastLogin: userAccount.lastLogin,
    // The village a committee account is responsible for (null for other
    // roles) - the committee UI reads this to scope/label what it shows.
    villageArea: userAccount.villageArea ?? null,
    // The shop a buyer account works for (null for other roles) - the buyer UI
    // reads this to label the pickup route plans addressed to it.
    buyer: userAccount.buyer ?? null,
  };
}

// Only the fields the frontend needs; keeps publicUser's shape stable.
const villageAreaSelect = {
  select: {
    id: true,
    villageName: true,
    moo: true,
    subdistrict: true,
    status: true,
  },
} as const;

const buyerSelect = {
  select: { id: true, buyerName: true, status: true },
} as const;

async function writeLoginAudit(input: {
  identifier: string;
  userId?: number;
  success: boolean;
  failureReason?: string;
  meta?: RequestMeta;
}) {
  await prisma.loginAudit.create({
    data: {
      identifier: input.identifier,
      userId: input.userId,
      success: input.success,
      failureReason: input.failureReason,
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
    },
  });
}

export async function register(input: RegisterInput) {
  // Any age may apply - the committee certifies it when screening the applicant
  // (committeeService.recordVerification). Only a birth date after today is refused.
  const birthDate = new Date(input.birthDate);
  if (ageOn(birthDate, new Date()) < 0) {
    throw ApiError.badRequest('วันเกิดต้องไม่เกินวันนี้');
  }

  const [existingMember, existingAccount] = await Promise.all([
    prisma.member.findUnique({ where: { citizenId: input.citizenId } }),
    prisma.userAccount.findUnique({ where: { username: input.citizenId } }),
  ]);
  if (existingMember || existingAccount) {
    throw ApiError.conflict("citizenId is already registered");
  }

  const passwordHash = await bcrypt.hash(
    input.password ?? input.citizenId,
    SALT_ROUNDS,
  );

  const member = await createWithNextMemberCode((memberCode) =>
    prisma.$transaction(async (tx) => {
      if (input.householdId) {
        const household = await tx.household.findUnique({
          where: { id: input.householdId },
        });
        if (!household) {
          throw ApiError.notFound("Household not found");
        }
      }

      const created = await tx.member.create({
        data: {
          memberCode,
          citizenId: input.citizenId,
          prefix: input.prefix,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate,
          gender: input.gender,
          phone: input.phone,
          occupation: input.occupation,
          status: MEMBER_STATUS.PENDING,
          household: input.householdId
            ? { connect: { id: input.householdId } }
            : { create: { ...input.address! } },
          ...(input.guarantor
            ? { guarantors: { create: input.guarantor } }
            : {}),
          userAccount: {
            create: {
              username: input.citizenId,
              passwordHash,
              status: USER_ACCOUNT_STATUS.INACTIVE,
              mustChangePassword: !input.password,
              fullName:
                `${input.prefix ?? ""}${input.firstName} ${input.lastName}`.trim(),
              phone: input.phone,
              role: { connect: { roleName: "member" } },
            },
          },
          fundBalance: { create: { totalContribution: 0 } },
        },
        include: { userAccount: { include: { role: true } } },
      });

      await tx.memberStatusHistory.create({
        data: {
          memberId: created.id,
          fromStatus: null,
          toStatus: MEMBER_STATUS.PENDING,
          reason: "สมัครสมาชิกออนไลน์",
        },
      });

      return created;
    }),
  );

  const token = signAuthToken({
    userId: member.userAccount!.id,
    memberId: member.id,
    roleName: member.userAccount!.role.roleName,
  });

  return { token, member };
}

export async function login(input: LoginInput, meta: RequestMeta = {}) {
  const userAccount = await prisma.userAccount.findFirst({
    where: {
      OR: [{ username: input.identifier }, { phone: input.identifier }],
    },
    include: {
      role: true,
      member: true,
      villageArea: villageAreaSelect,
      buyer: buyerSelect,
    },
  });

  if (!userAccount) {
    await writeLoginAudit({
      identifier: input.identifier,
      success: false,
      failureReason: "invalid_identifier",
      meta,
    });
    throw ApiError.unauthorized("Invalid credentials");
  }

  // Only member-role accounts require a linked member row - admin/committee/
  // municipality/buyer accounts intentionally have member: null.
  if (userAccount.role.roleName === "member" && !userAccount.member) {
    await writeLoginAudit({
      identifier: input.identifier,
      userId: userAccount.id,
      success: false,
      failureReason: "member_missing",
      meta,
    });
    throw ApiError.unauthorized("Invalid credentials");
  }

  if (userAccount.role.roleName === "member" && userAccount.member?.status !== MEMBER_STATUS.ACTIVE) {
    await writeLoginAudit({
      identifier: input.identifier,
      userId: userAccount.id,
      success: false,
      failureReason: "membership_pending",
      meta,
    });
    throw ApiError.unauthorized("Membership approval is required");
  }

  // Suspended/cancelled members get their account flipped to 'inactive' by the
  // committee (committeeService.setMemberStatus) - block their login here.
  if (userAccount.status !== USER_ACCOUNT_STATUS.ACTIVE) {
    await writeLoginAudit({
      identifier: input.identifier,
      userId: userAccount.id,
      success: false,
      failureReason: "inactive",
      meta,
    });
    throw ApiError.unauthorized("Account is disabled");
  }

  const passwordOk = await bcrypt.compare(
    input.password,
    userAccount.passwordHash,
  );
  if (!passwordOk) {
    await writeLoginAudit({
      identifier: input.identifier,
      userId: userAccount.id,
      success: false,
      failureReason: "invalid_password",
      meta,
    });
    throw ApiError.unauthorized("Invalid credentials");
  }

  const lastLogin = new Date();
  await prisma.userAccount.update({
    where: { id: userAccount.id },
    // Clear values left by versions that locked accounts after failed logins.
    data: { lastLogin, failedLoginCount: 0, lockedUntil: null },
  });
  await writeLoginAudit({
    identifier: input.identifier,
    userId: userAccount.id,
    success: true,
    meta,
  });

  const token = signAuthToken({
    userId: userAccount.id,
    memberId: userAccount.member?.id ?? null,
    roleName: userAccount.role.roleName,
  });

  return {
    token,
    user: publicUser({ ...userAccount, lastLogin }),
    member: userAccount.member,
  };
}

export async function getCurrentSession(userId: number) {
  const userAccount = await prisma.userAccount.findUnique({
    where: { id: userId },
    include: {
      role: true,
      member: true,
      villageArea: villageAreaSelect,
      buyer: buyerSelect,
    },
  });

  if (!userAccount || userAccount.status !== USER_ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.unauthorized("Account is disabled");
  }

  if (userAccount.role.roleName === "member" && !userAccount.member) {
    throw ApiError.unauthorized("Invalid credentials");
  }

  return {
    user: publicUser(userAccount),
    member: userAccount.member,
  };
}

// Self-service profile edit - fullName/phone only. Role/status/id/memberCode
// are never accepted here (updateMeSchema doesn't even parse them); those stay
// admin/committee-only via their own endpoints.
export async function updateCurrentUser(userId: number, input: UpdateMeInput) {
  const userAccount = await prisma.userAccount.findUnique({
    where: { id: userId },
  });
  if (!userAccount) {
    throw ApiError.notFound("User account not found");
  }

  const updated = await prisma.userAccount.update({
    where: { id: userId },
    data: input,
    include: {
      role: true,
      member: true,
      villageArea: villageAreaSelect,
      buyer: buyerSelect,
    },
  });

  return { user: publicUser(updated), member: updated.member };
}

export async function updateAvatar(
  userId: number,
  file: Express.Multer.File | undefined,
) {
  if (!file) {
    throw ApiError.badRequest("avatar image is required");
  }

  const userAccount = await prisma.userAccount.findUnique({
    where: { id: userId },
  });
  if (!userAccount) {
    throw ApiError.notFound("User account not found");
  }

  const objectPath = await storeUpload('avatars', file);
  let updated;
  try {
    updated = await prisma.userAccount.update({
      where: { id: userId },
      data: { avatarUrl: objectPath },
      include: { role: true, member: true, villageArea: villageAreaSelect, buyer: buyerSelect },
    });
  } catch (error) {
    await deleteStoredObject('avatars', objectPath).catch(() => undefined);
    throw error;
  }

  // Best-effort cleanup of the replaced file - not worth failing the request over.
  await deleteStoredObject('avatars', userAccount.avatarUrl).catch(() => undefined);

  return { user: publicUser(updated), member: updated.member };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const userAccount = await prisma.userAccount.findUnique({
    where: { id: userId },
  });
  if (!userAccount) {
    throw ApiError.notFound("User account not found");
  }

  const passwordOk = await bcrypt.compare(
    currentPassword,
    userAccount.passwordHash,
  );
  if (!passwordOk) {
    throw ApiError.badRequest("Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.userAccount.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const account = await prisma.userAccount.findFirst({
    where: {
      OR: [{ username: input.identifier }, { phone: input.identifier }],
    },
    include: { member: true, role: { select: { roleName: true } } },
  });

  const phoneMatches =
    account && normalizePhone(account.phone) === normalizePhone(input.phone);
  if (
    !account ||
    !phoneMatches ||
    account.status !== USER_ACCOUNT_STATUS.ACTIVE
  ) {
    return {
      message:
        "If the account exists, a password reset request has been recorded.",
    };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await prisma.userAccount.update({
    where: { id: account.id },
    data: {
      resetTokenHash: hashToken(resetToken),
      resetTokenExpiresAt: new Date(
        Date.now() + RESET_TOKEN_MINUTES * 60 * 1000,
      ),
    },
  });

  // There is no SMS/e-mail channel to deliver the token, so a committee account
  // that proved itself with username + registered phone gets it straight back
  // and sets the new password on the same page (also in production). Other
  // roles keep the old behaviour: the token is only echoed outside production.
  const directReset = account.role.roleName === "committee";
  return {
    message: "Password reset request recorded.",
    ...(directReset || env.nodeEnv !== "production" ? { resetToken } : {}),
    ...(directReset ? { directReset: true } : {}),
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  const account = await prisma.userAccount.findFirst({
    where: {
      resetTokenHash: hashToken(input.token),
      resetTokenExpiresAt: { gt: new Date() },
      status: USER_ACCOUNT_STATUS.ACTIVE,
    },
  });
  if (!account) {
    throw ApiError.badRequest("Reset token is invalid or expired");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await prisma.userAccount.update({
    where: { id: account.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
}
