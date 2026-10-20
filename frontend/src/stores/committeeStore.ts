import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

// Member-management store for the Waste Bank / Village Committee role. Wraps
// the /api/committee/members endpoints (backend/src/routes/committeeRoutes.ts).
// Read slices follow municipalityStore's loading/error/data pattern; write
// actions (create / update / verify / status changes) throw on failure so the
// pages can notify and decide what to reload.

// --- Response shapes (subset of backend JSON the UI actually reads) ----------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CommitteeHousehold {
  id: number;
  houseNo: string | null;
  moo: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postcode: string | null;
  _count?: { members: number };
  members?: Array<{
    id: number;
    memberCode: string;
    firstName: string;
    lastName: string;
    status: string;
  }>;
}

export interface CommitteeGuarantor {
  id: number;
  guarantorName: string;
  guarantorPhone: string | null;
  relationship: string | null;
  note: string | null;
}

export interface CommitteeVerification {
  id: number;
  checkDate: string;
  ageYears: number;
  ageEligible: boolean;
  addressVerified: boolean;
  guarantorVerified: boolean;
  result: string; // passed, failed
  note: string | null;
  verifiedBy: number | null;
}

export interface CommitteeStatusHistory {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedBy: number | null;
  changedAt: string;
}

export interface CommitteeMemberDocument {
  id: number;
  memberId: number;
  documentType: string;
  fileName: string;
  originalName: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  uploadedBy: number | null;
  uploadedAt: string;
}

// Whether a member currently meets every condition for claiming money from the
// funeral fund (backend: eligibilityService.evaluateEligibility). Null for
// anyone who isn't an active member - they can't claim regardless.
export interface CommitteeBenefitEligibility {
  eligible: boolean;
  fundCheck: { passed: boolean; amount: number; required: number };
  membershipAgeCheck: { passed: boolean; months: number; required: number };
  wasteSaleActivityCheck: {
    passed: boolean;
    activeMonths: number;
    required: number;
    windowMonths: number;
  };
  reason: string[];
}

export interface CommitteeMember {
  id: number;
  memberCode: string;
  citizenId: string;
  prefix: string | null;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string | null;
  phone: string;
  occupation: string | null;
  applyDate: string;
  approvedDate: string | null;
  status: string;
  remark: string | null;
  household: CommitteeHousehold | null;
  guarantors: CommitteeGuarantor[];
  userAccount: { username: string; status: string; lastLogin: string | null } | null;
  // Absolute URL, and only the list endpoint serializes it - the create/update
  // responses reuse this type without it.
  avatarUrl?: string | null;
  // List endpoints include only the latest verification; detail includes all.
  verifications: CommitteeVerification[];
  // Present on list rows too - backend memberListInclude selects
  // totalContribution so the list can flag members under the 50-baht minimum.
  fundBalance: { totalContribution: number } | null;
  benefitEligibility: CommitteeBenefitEligibility | null;
  // A death report still waiting for the municipality (at most one entry). The
  // member stays active until it is approved.
  funeralCases?: PendingDeathReport[] | undefined;
}

export interface PendingDeathReport {
  id: number;
  eventDate: string;
  deathDate: string;
}

export interface CommitteeMemberDetail extends CommitteeMember {
  fundBalance: { totalContribution: number; lastContributionDate: string | null } | null;
  currentAge: number;
  ageRule: { min: number; max: number };
  statusHistories: CommitteeStatusHistory[];
  documents: CommitteeMemberDocument[];
}

// The funeral-fund conditions for one member as the server evaluated them
// (backend funeralCaseService.getFuneralEligibility).
export interface FuneralEligibilitySnapshot {
  fundBalance: number;
  membershipMonths: number;
  activeMonthCount: number;
  continuousMonthCount: number;
  isEligible: boolean;
  reason: string;
  unmetConditions: string[];
}

// The committee only reports a death; the municipality's approval is what marks
// the member deceased and moves money.
export interface DeathReportResult {
  funeralCaseId: number;
  status: 'pending';
  // As it stood at report time - evaluated again on approval.
  eligibility: FuneralEligibilitySnapshot;
}

export interface CommitteeMembersSummary {
  total: number;
  byStatus: Record<string, number>;
  newThisMonth: number;
  // Active members who meet every fund-claim condition right now.
  benefitEligible: number;
}

// --- Request payloads ---------------------------------------------------------
// `| undefined` is spelled out because tsconfig sets exactOptionalPropertyTypes -
// callers pass `value || undefined` for cleared/blank fields.

export interface MemberAddressInput {
  houseNo?: string | undefined;
  moo?: string | undefined;
  subdistrict?: string | undefined;
  district?: string | undefined;
  province?: string | undefined;
  postcode?: string | undefined;
}

export interface MemberGuarantorInput {
  guarantorName: string;
  guarantorPhone?: string | undefined;
  relationship?: string | undefined;
  note?: string | undefined;
}

export interface CreateMemberInput {
  citizenId: string;
  password?: string | undefined;
  prefix?: string | undefined;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: string | undefined;
  phone: string;
  occupation?: string | undefined;
  remark?: string | undefined;
  householdId?: number | undefined;
  address?: MemberAddressInput | undefined;
  guarantor?: MemberGuarantorInput | undefined;
}

export interface UpdateMemberInput {
  prefix?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  birthDate?: string | undefined;
  gender?: string | undefined;
  phone?: string | undefined;
  occupation?: string | undefined;
  remark?: string | undefined;
  address?: MemberAddressInput | undefined;
  guarantor?: MemberGuarantorInput | undefined;
}

export interface VerificationInput {
  // The committee certifies the age - the system only calculates it.
  ageVerified: boolean;
  addressVerified: boolean;
  guarantorVerified: boolean;
  result: 'passed' | 'failed';
  note?: string | undefined;
}

// `| undefined` spelled out because tsconfig sets exactOptionalPropertyTypes.
export interface CommitteeMemberFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  status?: string | undefined;
  // Backend member-list filter for members under the 50-baht fund minimum.
  fundStatus?: string | undefined;
  moo?: string | undefined;
  villageAreaId?: number | undefined;
}

export interface CommitteeHouseholdFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  moo?: string | undefined;
  villageAreaId?: number | undefined;
}

// Drop undefined / empty-string params so the backend zod schemas see them as absent.
function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

interface Slice<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  requestId: number;
}

function emptySlice<T>(): Slice<T> {
  return { loading: false, error: null, data: null, requestId: 0 };
}

const LOAD_ERROR = 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง';

export const useCommitteeStore = defineStore('committee', {
  state: () => ({
    summary: emptySlice<CommitteeMembersSummary>(),
    members: emptySlice<Paginated<CommitteeMember>>(),
    memberDetail: emptySlice<CommitteeMemberDetail>(),
    households: emptySlice<Paginated<CommitteeHousehold>>(),
  }),

  actions: {
    async fetchInto<T>(
      slice: Slice<T>,
      url: string,
      params?: Record<string, unknown>,
    ): Promise<boolean> {
      const requestId = slice.requestId + 1;
      slice.requestId = requestId;
      slice.loading = true;
      slice.error = null;
      try {
        const { data } = await api.get<T>(
          url,
          params ? { params: cleanParams(params) } : undefined,
        );
        if (slice.requestId !== requestId) return false;
        slice.data = data;
        return true;
      } catch {
        if (slice.requestId !== requestId) return false;
        slice.error = LOAD_ERROR;
        slice.data = null;
        return false;
      } finally {
        if (slice.requestId === requestId) {
          slice.loading = false;
        }
      }
    },

    async fetchSummary(filters: { villageAreaId?: number } = {}) {
      return this.fetchInto(this.summary, '/committee/members/summary', { ...filters });
    },

    async fetchMembers(filters: CommitteeMemberFilters = {}) {
      return this.fetchInto(this.members, '/committee/members', { ...filters });
    },

    async fetchHouseholds(filters: CommitteeHouseholdFilters = {}) {
      return this.fetchInto(this.households, '/committee/households', { ...filters });
    },

    async fetchMemberDetail(memberId: number) {
      this.memberDetail.data = null;
      return this.fetchInto(this.memberDetail, `/committee/members/${memberId}`);
    },

    // --- Write actions (throw on failure; callers notify + reload) -------------

    async createMember(input: CreateMemberInput) {
      const { data } = await api.post<CommitteeMember>('/committee/members', input);
      return data;
    },

    async updateMember(memberId: number, input: UpdateMemberInput) {
      const { data } = await api.patch<CommitteeMember>(`/committee/members/${memberId}`, input);
      return data;
    },

    async recordVerification(memberId: number, input: VerificationInput) {
      const { data } = await api.post<CommitteeVerification>(
        `/committee/members/${memberId}/verification`,
        input,
      );
      return data;
    },

    async approveMember(memberId: number) {
      const { data } = await api.patch<CommitteeMember>(`/committee/members/${memberId}/approve`);
      return data;
    },

    async resetMemberPassword(memberId: number, newPassword: string) {
      await api.patch(`/committee/members/${memberId}/password`, { newPassword });
    },

    async cancelMember(memberId: number, note?: string) {
      const { data } = await api.patch<CommitteeMember>(
        `/committee/members/${memberId}/cancel`,
        note ? { note } : {},
      );
      return data;
    },

    // Sends the report to the municipality for approval - nothing changes for
    // the member or the fund until it is approved.
    async reportMemberDeath(
      memberId: number,
      input: { deathDate: string; causeOfDeath: string; note?: string | undefined },
      file: File,
    ) {
      const formData = new FormData();
      formData.append('deathDate', input.deathDate);
      formData.append('causeOfDeath', input.causeOfDeath);
      if (input.note) formData.append('note', input.note);
      formData.append('deathCertificate', file);
      const { data } = await api.patch<DeathReportResult>(
        `/committee/members/${memberId}/deceased`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },

    async uploadMemberDocument(
      memberId: number,
      input: { documentType: string; file: File; note?: string | undefined },
    ) {
      const formData = new FormData();
      formData.append('documentType', input.documentType);
      formData.append('document', input.file);
      if (input.note) formData.append('note', input.note);
      const { data } = await api.post<CommitteeMemberDocument>(
        `/committee/members/${memberId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },

    async deleteMemberDocument(memberId: number, documentId: number) {
      await api.delete(`/committee/members/${memberId}/documents/${documentId}`);
    },
  },
});
