import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { ageOn } from '../utils/age.js';
import { deleteStoredObject, memberDocumentFolder, privateFileUrl, publicFileUrl, storeUpload } from './storageService.js';
import {
  FUNERAL_CASE_STATUS,
  MEMBER_FUND_FILTER,
  MEMBER_MAX_AGE,
  MEMBER_MIN_AGE,
  MEMBER_STATUS,
  USER_ACCOUNT_STATUS,
  VERIFICATION_RESULT,
} from '../config/constants.js';
import { evaluateMembersEligibility } from './eligibilityService.js';
import { belowMinimumContributionWhere } from './fundService.js';
import { createWithNextMemberCode, memberSearchWhere } from './memberService.js';
import type { VillageScope } from '../middleware/villageScope.js';
import {
  assertHouseholdInScope,
  assertMemberInScope,
  householdScopeWhere,
  memberScopeWhere,
  resolveAddressVillage,
} from './villageScopeService.js';
import type {
  CommitteeCreateMemberInput,
  CommitteeHouseholdListQuery,
  CommitteeMemberDocumentInput,
  CommitteeMemberListQuery,
  CommitteeUpdateMemberInput,
  CommitteeVerificationInput,
} from '../validators/committeeValidators.js';

// Member management for the Waste Bank / Village Committee role: walk-in
// applicants are registered at the desk (status 'pending'), screened
// (member_verification row: age / address / guarantor checks + result), then
// approved to 'active' - plus the cancel / deceased lifecycle actions.
// Anything other than 'active' flips the linked user_account to 'inactive' so
// the member can no longer log in (authService.login checks account status).
//
// Every entry point takes a `scope` (see middleware/villageScope.ts): a
// committee only ever reads/writes members of the village it was assigned by
// the admin, while `null` (admin) means unrestricted.

const SALT_ROUNDS = 10;

// A death report still waiting for the municipality (at most one): the member
// stays active meanwhile, so the member pages have to say so themselves.
const pendingDeathReport = {
  where: { status: FUNERAL_CASE_STATUS.PENDING },
  select: { id: true, eventDate: true, deathDate: true },
  take: 1,
};

const memberListInclude = {
  household: true,
  guarantors: true,
  // avatarUrl is the stored relative path; listMembers serializes it into an
  // absolute URL so the member list can show profile photos.
  userAccount: { select: { username: true, status: true, lastLogin: true, avatarUrl: true } },
  verifications: { orderBy: { checkDate: 'desc' as const }, take: 1 },
  // Feeds the fund-claim eligibility badge on the member-management page.
  fundBalance: { select: { totalContribution: true } },
  funeralCases: pendingDeathReport,
};

const memberDetailInclude = {
  household: true,
  guarantors: true,
  userAccount: { select: { username: true, fullName: true, status: true, lastLogin: true } },
  verifications: { orderBy: { checkDate: 'desc' as const } },
  fundBalance: true,
  statusHistories: { orderBy: { changedAt: 'desc' as const } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
  funeralCases: pendingDeathReport,
};

// Any age may apply - the committee certifies it in recordVerification. Only an
// impossible birth date, one after today, is refused.
function assertBirthDateNotFuture(birthDate: Date) {
  if (ageOn(birthDate, new Date()) < 0) {
    throw ApiError.badRequest('วันเกิดต้องไม่เกินวันนี้');
  }
}

function fullNameOf(prefix: string | null | undefined, firstName: string, lastName: string) {
  return `${prefix ?? ''}${firstName} ${lastName}`.trim();
}

async function serializeMemberDocument(document: {
  id: number;
  memberId: number;
  documentType: string;
  fileName: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  uploadedBy: number | null;
  uploadedAt: Date;
}) {
  return {
    ...document,
    fileUrl: await privateFileUrl('memberDocuments', document.storagePath),
  };
}

// Fund-claim (funeral benefit) eligibility as shown on the member-management
// page - same rule as eligibilityService.checkMemberEligibility, evaluated for
// a whole page of members at once. Only active members can claim, so everyone
// else is returned as null instead of as a failing evaluation (the UI shows
// "-" rather than a red badge for an applicant who isn't a member yet).
async function attachBenefitEligibility<
  T extends { id: number; status: string; approvedDate: Date | null; fundBalance: { totalContribution: number } | null },
>(members: T[], now: Date = new Date()) {
  const evaluations = await evaluateMembersEligibility(
    members.filter((member) => member.status === MEMBER_STATUS.ACTIVE),
    now,
  );

  return members.map((member) => ({
    ...member,
    benefitEligibility: evaluations.get(member.id) ?? null,
  }));
}

export async function createMember(input: CommitteeCreateMemberInput, scope: VillageScope | null) {
  const birthDate = new Date(input.birthDate);
  assertBirthDateNotFuture(birthDate);

  const [existingMember, existingAccount] = await Promise.all([
    prisma.member.findUnique({ where: { citizenId: input.citizenId } }),
    prisma.userAccount.findUnique({ where: { username: input.citizenId } }),
  ]);
  if (existingMember || existingAccount) {
    throw ApiError.conflict('citizenId is already registered');
  }

  // A committee may only register members into its own village - either by
  // picking an existing household there, or with an address whose moo is
  // theirs (blank moo is filled in for them).
  if (input.householdId) {
    await assertHouseholdInScope(input.householdId, scope);
  }
  const addressVillage = input.address
    ? await resolveAddressVillage(input.address.moo, scope)
    : null;
  const address =
    input.address && addressVillage
      ? { ...input.address, moo: addressVillage.moo, villageAreaId: addressVillage.villageAreaId }
      : undefined;

  // Walk-in applicants usually have no password in mind - default the initial
  // password to the citizen ID. Whatever the committee ends up handing the
  // member (their own choice or that default) IS the member's password: the
  // account is never flagged mustChangePassword, so the member logs straight
  // in instead of hitting the "set a new password" screen.
  const passwordHash = await bcrypt.hash(input.password ?? input.citizenId, SALT_ROUNDS);

  return createWithNextMemberCode((memberCode) =>
    prisma.$transaction(async (tx) => {
      if (input.householdId) {
        const household = await tx.household.findUnique({ where: { id: input.householdId } });
        if (!household) {
          throw ApiError.notFound('Household not found');
        }
      }

      const member = await tx.member.create({
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
          remark: input.remark,
          status: MEMBER_STATUS.PENDING,
          household: input.householdId
            ? { connect: { id: input.householdId } }
            : { create: { ...address! } },
          ...(input.guarantor ? { guarantors: { create: input.guarantor } } : {}),
          userAccount: {
            create: {
              username: input.citizenId,
              passwordHash,
              status: USER_ACCOUNT_STATUS.INACTIVE,
              mustChangePassword: false,
              fullName: fullNameOf(input.prefix, input.firstName, input.lastName),
              phone: input.phone,
              role: { connect: { roleName: 'member' } },
            },
          },
          fundBalance: { create: { totalContribution: 0 } },
        },
        include: memberListInclude,
      });

      await tx.memberStatusHistory.create({
        data: {
          memberId: member.id,
          fromStatus: null,
          toStatus: MEMBER_STATUS.PENDING,
          reason: 'สมัครสมาชิกหน้างาน',
        },
      });

      return member;
    }),
  );
}

export async function listHouseholds(query: CommitteeHouseholdListQuery, scope: VillageScope | null) {
  const { page, pageSize } = query;
  const where: Prisma.HouseholdWhereInput = {
    // AND (not spread) so a committee asking for another village's moo gets an
    // empty list instead of one filter silently replacing the other.
    AND: [...(query.moo ? [{ moo: query.moo }] : []), householdScopeWhere(scope)],
    ...(query.search
      ? {
          OR: [
            { houseNo: { contains: query.search } },
            { moo: { contains: query.search } },
            { subdistrict: { contains: query.search } },
            { district: { contains: query.search } },
            { province: { contains: query.search } },
            { postcode: { contains: query.search } },
            { members: { some: { memberCode: { contains: query.search } } } },
            { members: { some: { firstName: { contains: query.search } } } },
            { members: { some: { lastName: { contains: query.search } } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.household.count({ where }),
    prisma.household.findMany({
      where,
      include: {
        _count: { select: { members: true } },
        members: {
          select: { id: true, memberCode: true, firstName: true, lastName: true, status: true },
          orderBy: { memberCode: 'asc' },
          take: 3,
        },
      },
      orderBy: [{ moo: 'asc' }, { houseNo: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listMembers(query: CommitteeMemberListQuery, scope: VillageScope | null) {
  const { page, pageSize } = query;

  const where: Prisma.MemberWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? memberSearchWhere(query.search) : {}),
    // AND (not spread) so a committee asking for another village's moo gets an
    // empty list instead of one filter silently replacing the other.
    AND: [
      ...(query.moo ? [{ household: { moo: query.moo } }] : []),
      ...(query.fundStatus === MEMBER_FUND_FILTER.BELOW_MINIMUM
        ? [belowMinimumContributionWhere]
        : []),
      memberScopeWhere(scope),
    ],
  };

  const [total, items] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      include: memberListInclude,
      // Newest applicant first, so a member the committee just added lands at
      // the top of the list. id breaks the tie for same-day/imported rows.
      orderBy: [{ applyDate: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Same shape as memberService.getProfile: the absolute avatar URL rides at the
  // top level, the raw stored path stays where Prisma put it.
  const rows = (await attachBenefitEligibility(items)).map((member) => ({
    ...member,
    avatarUrl: publicFileUrl('avatars', member.userAccount?.avatarUrl ?? null),
  }));

  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getMembersSummary(scope: VillageScope | null) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const scopeWhere = memberScopeWhere(scope);

  const [total, byStatusRaw, newThisMonth, activeMembers] = await Promise.all([
    prisma.member.count({ where: scopeWhere }),
    prisma.member.groupBy({ by: ['status'], _count: { _all: true }, where: scopeWhere }),
    prisma.member.count({ where: { ...scopeWhere, applyDate: { gte: monthStart } } }),
    prisma.member.findMany({
      where: { AND: [scopeWhere, { status: MEMBER_STATUS.ACTIVE }] },
      select: { id: true, approvedDate: true, fundBalance: { select: { totalContribution: true } } },
    }),
  ]);

  const byStatus = Object.fromEntries(byStatusRaw.map((row) => [row.status, row._count._all]));

  // How many active members currently meet every condition for claiming money
  // from the funeral fund (fund >= 50 baht, tenure, active sale months).
  const evaluations = await evaluateMembersEligibility(activeMembers, now);
  const benefitEligible = [...evaluations.values()].filter((evaluation) => evaluation.eligible).length;

  return { total, byStatus, newThisMonth, benefitEligible };
}

export async function getMemberDetail(memberId: number, scope: VillageScope | null) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: memberDetailInclude,
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  const [withEligibility] = await attachBenefitEligibility([member]);

  return {
    ...withEligibility!,
    documents: await Promise.all(member.documents.map(serializeMemberDocument)),
    // Screening context the UI shows next to the verification form.
    currentAge: ageOn(member.birthDate, new Date()),
    ageRule: { min: MEMBER_MIN_AGE, max: MEMBER_MAX_AGE },
  };
}

export async function listMemberDocuments(memberId: number, scope: VillageScope | null) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  const documents = await prisma.memberDocument.findMany({
    where: { memberId },
    orderBy: { uploadedAt: 'desc' },
  });
  return Promise.all(documents.map(serializeMemberDocument));
}

export async function addMemberDocument(
  memberId: number,
  input: CommitteeMemberDocumentInput,
  file: Express.Multer.File | undefined,
  uploadedBy: number,
  scope: VillageScope | null,
) {
  if (!file) {
    throw ApiError.badRequest('document file is required');
  }

  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  const objectPath = await storeUpload('memberDocuments', file, memberDocumentFolder(input.documentType));
  let document;
  try {
    document = await prisma.memberDocument.create({
      data: { memberId, documentType: input.documentType, fileName: objectPath, originalName: file.originalname, storagePath: objectPath, mimeType: file.mimetype, fileSize: file.size, note: input.note, uploadedBy },
    });
  } catch (error) {
    await deleteStoredObject('memberDocuments', objectPath).catch(() => undefined);
    throw error;
  }

  return await serializeMemberDocument(document);
}

export async function deleteMemberDocument(
  memberId: number,
  documentId: number,
  scope: VillageScope | null,
) {
  await assertMemberInScope(memberId, scope);

  const document = await prisma.memberDocument.findFirst({
    where: { id: documentId, memberId },
    include: { member: { select: { status: true, funeralCases: pendingDeathReport } } },
  });
  if (!document) {
    throw ApiError.notFound('Document not found');
  }
  // The death certificate behind a recorded death is the evidence for the
  // funeral-fund deductions taken from every member, so it has to stay - and
  // so does one behind a report the municipality still has to check.
  const deathOnRecord =
    document.member.status === MEMBER_STATUS.DECEASED || document.member.funeralCases.length > 0;
  if (document.documentType === 'death_certificate' && deathOnRecord) {
    throw ApiError.badRequest('The death certificate of a recorded death cannot be deleted');
  }

  await prisma.memberDocument.delete({ where: { id: document.id } });
  await deleteStoredObject('memberDocuments', document.storagePath).catch(() => undefined);
}

export async function updateMember(
  memberId: number,
  input: CommitteeUpdateMemberInput,
  scope: VillageScope | null,
) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { guarantors: true, userAccount: { select: { id: true } } },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  const birthDate = input.birthDate ? new Date(input.birthDate) : undefined;
  if (birthDate) {
    assertBirthDateNotFuture(birthDate);
  }

  const { address, guarantor, birthDate: _rawBirthDate, ...memberFields } = input;
  // A committee cannot move one of its members into another village by editing
  // the address; the village FK is re-stamped on every address edit so it never
  // drifts from the address that is actually stored.
  const addressVillage = address ? await resolveAddressVillage(address.moo, scope) : null;
  const scopedAddress =
    address && addressVillage
      ? { ...address, moo: addressVillage.moo, villageAreaId: addressVillage.villageAreaId }
      : undefined;
  const primaryGuarantor = member.guarantors[0];

  // Keep the login account's display name/phone in sync with the member row.
  const fullName = fullNameOf(
    input.prefix ?? member.prefix,
    input.firstName ?? member.firstName,
    input.lastName ?? member.lastName,
  );

  return prisma.member.update({
    where: { id: memberId },
    data: {
      ...memberFields,
      ...(birthDate ? { birthDate } : {}),
      ...(scopedAddress ? { household: { update: scopedAddress } } : {}),
      ...(guarantor
        ? {
            guarantors: primaryGuarantor
              ? { update: { where: { id: primaryGuarantor.id }, data: guarantor } }
              : { create: guarantor },
          }
        : {}),
      ...(member.userAccount
        ? {
            userAccount: {
              update: { fullName, ...(input.phone ? { phone: input.phone } : {}) },
            },
          }
        : {}),
    },
    include: memberListInclude,
  });
}

export async function recordVerification(
  memberId: number,
  input: CommitteeVerificationInput,
  verifiedBy: number,
  scope: VillageScope | null,
) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }
  if (member.status !== MEMBER_STATUS.PENDING) {
    throw ApiError.badRequest('Eligibility verification is only recorded for pending applicants');
  }

  // The system only works the age out; whether it qualifies is entirely the
  // committee's call (ageVerified), inside MEMBER_MIN_AGE..MEMBER_MAX_AGE or not.
  const ageYears = ageOn(member.birthDate, new Date());
  const ageEligible = input.ageVerified;

  const allChecksPassed = ageEligible && input.addressVerified && input.guarantorVerified;
  if (input.result === VERIFICATION_RESULT.PASSED && !allChecksPassed) {
    throw ApiError.badRequest(
      'result cannot be "passed" unless age, address, and guarantor checks all pass',
    );
  }

  return prisma.memberVerification.create({
    data: {
      memberId,
      ageYears,
      ageEligible,
      addressVerified: input.addressVerified,
      guarantorVerified: input.guarantorVerified,
      result: input.result,
      note: input.note,
      verifiedBy,
    },
  });
}

// Status change + keep the linked login account usable only for active members.
// Sets a new login password for one of the committee's own members. Same rule
// as createMember: what the committee hands the member IS the password, so no
// forced "set a new password" screen. Also lifts a login lockout and voids any
// pending self-service reset token.
export async function resetMemberPassword(
  memberId: number,
  newPassword: string,
  scope: VillageScope | null,
) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { status: true, userAccount: { select: { id: true, username: true } } },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }
  if (member.status === MEMBER_STATUS.RESIGNED || member.status === MEMBER_STATUS.DECEASED) {
    throw ApiError.badRequest('Membership is already ended');
  }
  if (!member.userAccount) {
    throw ApiError.badRequest('Member has no login account');
  }

  await prisma.userAccount.update({
    where: { id: member.userAccount.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });

  return { username: member.userAccount.username };
}

async function setMemberStatus(
  memberId: number,
  status: string,
  extra: { approvedDate?: Date; remark?: string | undefined; changedBy?: number; reason?: string } = {},
) {
  // A pending applicant has a credential record for account ownership, but
  // must not be able to authenticate until the membership is approved.
  const accountStatus =
    status === MEMBER_STATUS.ACTIVE
      ? USER_ACCOUNT_STATUS.ACTIVE
      : USER_ACCOUNT_STATUS.INACTIVE;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { userAccount: { select: { id: true } } },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: memberId },
      data: {
        status,
        ...(extra.approvedDate ? { approvedDate: extra.approvedDate } : {}),
        ...(extra.remark !== undefined ? { remark: extra.remark } : {}),
        ...(member.userAccount ? { userAccount: { update: { status: accountStatus } } } : {}),
      },
      include: memberListInclude,
    });

    if (member.status !== status) {
      await tx.memberStatusHistory.create({
        data: {
          memberId,
          fromStatus: member.status,
          toStatus: status,
          reason: extra.reason ?? extra.remark,
          changedBy: extra.changedBy,
        },
      });
    }

    return updated;
  });
}

export async function approveMember(
  memberId: number,
  scope: VillageScope | null,
  changedBy?: number,
) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { verifications: { orderBy: { checkDate: 'desc' }, take: 1 } },
  });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }
  if (member.status !== MEMBER_STATUS.PENDING) {
    throw ApiError.badRequest('Only pending applicants can be approved');
  }

  const latestVerification = member.verifications[0];
  if (!latestVerification || latestVerification.result !== VERIFICATION_RESULT.PASSED) {
    throw ApiError.badRequest(
      'Applicant must pass eligibility verification before approval',
    );
  }

  return setMemberStatus(memberId, MEMBER_STATUS.ACTIVE, {
    approvedDate: new Date(),
    changedBy,
    reason: 'อนุมัติสมาชิก',
  });
}

export async function cancelMember(
  memberId: number,
  scope: VillageScope | null,
  note?: string,
  changedBy?: number,
) {
  await assertMemberInScope(memberId, scope);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw ApiError.notFound('Member not found');
  }
  if (member.status === MEMBER_STATUS.RESIGNED || member.status === MEMBER_STATUS.DECEASED) {
    throw ApiError.badRequest('Membership is already ended');
  }

  return setMemberStatus(memberId, MEMBER_STATUS.RESIGNED, {
    remark: note,
    changedBy,
    reason: note ?? 'ยกเลิกสมาชิกภาพ',
  });
}

