import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import type { FuneralEligibilitySnapshot } from 'src/stores/committeeStore';

// Read-only monitoring/reporting store for the Municipality role. Wraps the
// GET /api/municipality/* endpoints (backend/src/routes/municipalityRoutes.ts).
// Every slice carries its own loading/error so pages can render loading, empty,
// and error states independently.

// --- Response shapes (subset of backend JSON the UI actually reads) ----------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MuniHousehold {
  houseNo: string | null;
  moo: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postcode: string | null;
}

export interface MuniMember {
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
  household: MuniHousehold | null;
  fundBalance: { totalContribution: number; lastContributionDate: string | null } | null;
  userAccount: { status: string; lastLogin: string | null } | null;
  // Absolute URL of the photo the member uploaded, or null.
  avatarUrl: string | null;
}

export interface MembersSummary {
  total: number;
  byStatus: Record<string, number>;
  newThisMonth: number;
  householdCount: number;
  // Every หมู่ that has members, numeric order - options for the list's
  // "หมู่ที่" dropdown (taken from households, not village_area master data).
  moos: string[];
}

export interface MuniSaleDetail {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  wasteType: { id: number; wasteName: string; unit: string };
}

export interface MuniSale {
  id: number;
  saleNo: string;
  saleDate: string;
  totalAmount: number;
  fundDeductAmount: number;
  netAmount: number;
  status: string;
  member?: { memberCode: string; prefix: string | null; firstName: string; lastName: string };
  details: MuniSaleDetail[];
  round?: { id: number; roundDate: string; locationNote: string | null };
  // The member's receipt for this sale (RC-...), sent by the operations list.
  receipt?: { receiptNo: string } | null;
}

export interface WasteTypeBreakdown {
  wasteTypeId: number;
  wasteName: string;
  unit: string;
  quantity: number;
  amount: number;
}

export interface MonthlyPoint {
  month: string; // "YYYY-MM"
  saleCount: number;
  totalAmount: number;
  fundDeductAmount: number;
  netAmount: number;
  quantity: number;
}

export interface OperationsSummary {
  completedSaleCount: number;
  totalAmount: number;
  totalFundDeduct: number;
  totalNetPaid: number;
  // เงินส่วนเกินจากการขายที่สมาชิกเลือกฝากไว้กับกองทุนแทนการรับเงินสด
  totalMemberDeposit: number;
  totalQuantity: number;
  memberParticipatedCount: number;
  byWasteType: WasteTypeBreakdown[];
  monthlySeries: MonthlyPoint[];
  recentSales: MuniSale[];
}

// The three welfare conditions (backend eligibilityService.evaluateEligibility),
// each with the member's figure and the requirement it is held against.
export interface EligibilityEvaluation {
  eligible: boolean;
  fundCheck: { passed: boolean; amount: number; required: number };
  membershipAgeCheck: { passed: boolean; months: number; required: number };
  wasteSaleActivityCheck: { passed: boolean; activeMonths: number; required: number; windowMonths: number };
  reason: string[];
}

export interface MemberDetail {
  member: MuniMember & {
    remark: string | null;
    guarantors: { id: number; guarantorName: string; guarantorPhone: string | null; relationship: string | null }[];
    // Absolute URL of the photo the member uploaded, or null.
    avatarUrl: string | null;
  };
  participation: {
    completedSaleCount: number;
    totalAmount: number;
    totalFundDeduct: number;
    totalNetIncome: number;
    totalQuantity: number;
    activeMonthCount: number;
  };
  recentSales: MuniSale[];
  fundTransactions: MuniFundTransaction[];
  latestEligibility: {
    checkDate: string;
    activeMonthCount: number;
    continuousMonthCount: number;
    isEligible: boolean;
    reason: string | null;
  } | null;
  // Evaluated against today's data on every load (not a stored snapshot).
  eligibility: EligibilityEvaluation | null;
}

export interface MuniFundTransaction {
  id: number;
  transactionDate: string;
  transactionType: string;
  amountIn: number;
  amountOut: number;
  balanceAfter: number;
  note: string | null;
  member?: { memberCode: string; prefix: string | null; firstName: string; lastName: string } | null;
  fundAccount?: { accountName: string };
}

export interface FundTypeStats {
  count: number;
  amountIn: number;
  amountOut: number;
}

export interface FundSummary {
  accounts: { id: number; accountName: string; balance: number; updatedAt: string }[];
  totalBalance: number;
  totalIn: number;
  totalOut: number;
  // Every member's savings balance (ยอดเงินสะสม) added up.
  contributionBalance: number;
  // Mandatory stake per member (backend FUND_MINIMUM_BAHT), so the dashboard
  // target does not hardcode the rule.
  minimumPerMember: number;
  // Active members, and how many of them still hold less than the minimum.
  activeMemberCount: number;
  belowMinimumCount: number;
  byType: Record<string, FundTypeStats>;
  welfarePayments: FundTypeStats;
  recentTransactions: MuniFundTransaction[];
}

export interface ReportMembers {
  // Members who had applied by the end of the reported period.
  total: number;
  // Status breakdown is a snapshot as of snapshotAsOf (status history is not
  // tracked in the backend), not the state during the reported period.
  currentByStatus: Record<string, number>;
  snapshotAsOf: string;
  newInPeriod: number;
  approvedInPeriod: number;
}

export interface ReportOperations {
  completedSaleCount: number;
  totalAmount: number;
  totalFundDeduct: number;
  totalNetPaid: number;
  totalQuantity: number;
  memberParticipatedCount: number;
  byWasteType: WasteTypeBreakdown[];
}

export interface ReportFund {
  totalIn: number;
  totalOut: number;
  net: number;
  byType: Record<string, FundTypeStats>;
  balanceAtPeriodEnd: number;
}

// One bucket of the CO2 chart: the month's total plus the waste types it came
// from, so the bars can be stacked by type.
export interface Co2MonthlySlice {
  wasteTypeId: number;
  wasteName: string;
  quantity: number;
  estimatedKgCo2e: number;
}

export interface Co2MonthlyPoint {
  month: string; // "YYYY-MM"
  estimatedKgCo2e: number;
  byWasteType: Co2MonthlySlice[];
}

export interface Co2CreditBreakdown extends WasteTypeBreakdown {
  emissionReductionFactor: number;
  estimatedKgCo2e: number;
  estimatedTCo2e: number;
}

export interface Co2CreditSummary {
  totalWasteSold: number;
  estimatedKgCo2e: number;
  estimatedTCo2e: number;
  defaultEmissionReductionFactor: number;
  byWasteType: Co2CreditBreakdown[];
  // Waste types sold in non-kg units - excluded from the kgCO2e estimate.
  excludedWasteTypes: WasteTypeBreakdown[];
  // Rolling 6-month composition, matching trends.last6Months.
  monthlySeries: Co2MonthlyPoint[];
}

export interface MonthlyReport {
  reportType: 'monthly';
  period: { year: number; month: number; from: string; to: string };
  generatedAt: string;
  members: ReportMembers;
  operations: ReportOperations;
  fund: ReportFund;
  trends: {
    previousMonth: { completedSaleCount: number; totalAmount: number; totalQuantity: number };
    totalAmountChange: number;
    totalQuantityChange: number;
    saleCountChange: number;
  };
}

export interface YearlyBreakdownRow {
  month: number;
  saleCount: number;
  totalAmount: number;
  fundDeductAmount: number;
  netAmount: number;
  quantity: number;
  fundIn: number;
  fundOut: number;
}

export interface YearlyReport {
  reportType: 'yearly';
  period: { year: number; from: string; to: string };
  generatedAt: string;
  members: ReportMembers;
  operations: ReportOperations;
  fund: ReportFund;
  monthlyBreakdown: YearlyBreakdownRow[];
  co2MonthlySeries: Co2MonthlyPoint[];
}

export interface ExecutiveReport {
  reportType: 'executive';
  generatedAt: string;
  members: MembersSummary;
  operations: ReportOperations;
  co2Credit: Co2CreditSummary;
  fund: {
    totalBalance: number;
    totalIn: number;
    totalOut: number;
    contributionBalance: number;
    minimumPerMember: number;
    activeMemberCount: number;
    belowMinimumCount: number;
    byType: Record<string, FundTypeStats>;
    welfarePayments: FundTypeStats;
  };
  trends: { last6Months: MonthlyPoint[]; topWasteTypes: WasteTypeBreakdown[] };
}

// One village of the dashboard's per-village comparison. A village is the
// member household's moo; villageName is filled in only when those households
// are attached to a village_area row, so it can be null.
export interface VillageSummaryRow {
  moo: string | null;
  villageName: string | null;
  subdistrict: string | null;
  // 'หมู่ 1' for a chart axis; fullLabel adds the village and subdistrict names.
  label: string;
  fullLabel: string;
  memberCount: number;
  activeMemberCount: number;
  // Per-village member breakdown, so the dashboard's status donut can switch
  // between "ทุกหมู่บ้าน" and one village without a second request.
  byStatus: Record<string, number>;
  householdCount: number;
  newThisMonth: number;
  sellerCount: number;
  completedSaleCount: number;
  totalQuantity: number;
  totalAmount: number;
  totalFundDeduct: number;
  co2Credit: {
    totalWasteSold: number;
    estimatedKgCo2e: number;
    estimatedTCo2e: number;
    excludedWasteTypes: WasteTypeBreakdown[];
  };
  // Savings held by this village's members.
  fund: { contributionBalance: number };
}

// All-time by design (see municipalityService section 6) - the fund balances in
// it are a live snapshot, so this report ignores the dashboard's period switch.
export interface VillageReport {
  reportType: 'villages';
  generatedAt: string;
  minimumPerMember: number;
  defaultEmissionReductionFactor: number;
  villages: VillageSummaryRow[];
  totals: {
    villageCount: number;
    memberCount: number;
    totalQuantity: number;
    totalAmount: number;
    estimatedKgCo2e: number;
    contributionBalance: number;
  };
}

// --- Query params -------------------------------------------------------------

// `| undefined` is spelled out because tsconfig sets exactOptionalPropertyTypes -
// callers pass `value ?? undefined` for cleared filters.
// --- Funeral (death) cases --------------------------------------------------

export interface FuneralSummary {
  requiredAmount: number;
  chargedMemberCount: number;
  paidInFullCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  // เก็บจากสมาชิกคนอื่นได้เท่าไร + เงินสะสมของผู้เสียชีวิตเองที่ปิดบัญชีเข้ามา
  // = totalPayout คือยอดที่ทายาทได้รับจริง
  totalCollected: number;
  deceasedOwnSavings: number;
  totalPayout: number;
  totalShortfall: number;
  expectedTotal: number;
}

export interface FuneralDeceased {
  id: number;
  memberCode: string;
  citizenId: string;
  prefix: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  phone: string;
  household: MuniHousehold | null;
}

// pending = the committee reported it and nothing has happened yet; approved =
// the municipality approved it, the member is deceased and the money moved.
export type FuneralCaseStatus = 'pending' | 'approved';

export interface FuneralCaseRow {
  id: number;
  deceasedMemberId: number;
  requiredAmount: number;
  deathDate: string;
  // When the committee reported it.
  eventDate: string;
  causeOfDeath: string;
  status: FuneralCaseStatus;
  reportNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  deceasedMember: FuneralDeceased;
  summary: FuneralSummary;
}

export interface FuneralApprovalResult {
  funeralCaseId: number;
  ownSavingsOnly: boolean;
  deduction: {
    amountPerMember: number;
    memberCount: number;
    paidMemberCount: number;
    totalDeducted: number;
    deceasedOwnSavings: number;
    totalPayout: number;
  };
}

// What approving a pending report would do right now.
export interface FuneralApprovalPreview {
  eligibility: FuneralEligibilitySnapshot;
  // Misses the funeral conditions: nobody is charged, the heirs get only the
  // member's own savings - the officer must confirm that explicitly.
  ownSavingsOnly: boolean;
  amountPerMember: number;
  payerCount: number;
  deceasedOwnSavings: number;
}

export interface FuneralContributionRow {
  id: number;
  memberId: number;
  memberCode: string;
  fullName: string;
  moo: string | null;
  requiredAmount: number;
  totalPaid: number;
  shortfall: number;
  status: 'completed' | 'partially_paid' | 'shortfall_remaining';
  balanceAfter: number;
  createdAt: string;
}

// เงินสมทบของการเสียชีวิต 1 ครั้ง แยกตามหมู่บ้านของผู้จ่าย
// (หมู่บ้านที่ยังไม่ได้ผูกกับครัวเรือนจะรวมอยู่แถวเดียวที่ villageAreaId = null)
export interface FuneralVillageContribution {
  villageAreaId: number | null;
  villageName: string | null;
  moo: string | null;
  memberCount: number;
  paidInFullCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  totalPaid: number;
  totalShortfall: number;
  expectedTotal: number;
}

export interface FuneralCaseDetail extends FuneralCaseRow {
  reportedByName: string | null;
  approvedByName: string | null;
  // The certificate the committee attached (a short-lived signed URL).
  deathCertificate: { originalName: string; mimeType: string; fileUrl: string } | null;
  // Only while pending.
  approval: FuneralApprovalPreview | null;
  villageBreakdown: FuneralVillageContribution[];
  contributions: FuneralContributionRow[];
}

// Totals over every case matching the filter, not only the current page.
export interface FuneralCaseList extends Paginated<FuneralCaseRow> {
  totals: { totalPayout: number; totalShortfall: number };
}

export interface FuneralCaseFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  villageAreaId?: number | undefined;
  status?: FuneralCaseStatus | undefined;
}

export interface MemberListFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  status?: string | undefined;
  // Backend member-list filter for members under the 50-baht fund minimum.
  fundStatus?: string | undefined;
  moo?: string | undefined;
}

export interface OperationFilters {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  month?: number | undefined;
  year?: number | undefined;
  memberId?: number | undefined;
  wasteTypeId?: number | undefined;
  roundId?: number | undefined;
  // Sale number, or the selling member's name / member code.
  search?: string | undefined;
}

export interface FundTransactionFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  transactionType?: string | undefined;
  memberId?: number | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  // Transaction note, or the member's name / member code.
  search?: string | undefined;
}

// Drop undefined / empty-string params so the backend zod schemas see them as absent.
function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
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

export const useMunicipalityStore = defineStore('municipality', {
  state: () => ({
    membersSummary: emptySlice<MembersSummary>(),
    members: emptySlice<Paginated<MuniMember>>(),
    memberDetail: emptySlice<MemberDetail>(),
    // One member's fund ledger and sales, a page at a time (member detail page) -
    // kept apart from fundTransactions / sales so they never clobber the fund
    // and operations pages' lists.
    memberFundTransactions: emptySlice<Paginated<MuniFundTransaction>>(),
    memberSales: emptySlice<Paginated<MuniSale>>(),
    operationsSummary: emptySlice<OperationsSummary>(),
    sales: emptySlice<Paginated<MuniSale>>(),
    fundSummary: emptySlice<FundSummary>(),
    fundTransactions: emptySlice<Paginated<MuniFundTransaction>>(),
    monthlyReport: emptySlice<MonthlyReport>(),
    yearlyReport: emptySlice<YearlyReport>(),
    executiveReport: emptySlice<ExecutiveReport>(),
    villageReport: emptySlice<VillageReport>(),
    funeralCases: emptySlice<FuneralCaseList>(),
    funeralCase: emptySlice<FuneralCaseDetail>(),
    // Committee death reports waiting for approval, shown above the list.
    pendingFuneralCases: emptySlice<FuneralCaseList>(),
  }),

  actions: {
    // keepData leaves the slice's current data in place while the refresh is in
    // flight, instead of clearing it. Only where the cached copy cannot belong to
    // something else: a report that takes no parameters (the same report, just
    // older - a page that renders it straight away is then not torn down and
    // rebuilt a tick later, which is what left ApexCharts drawing into a detached
    // element: "Element not found"), or the next page of the same list.
    // Filtered fetches keep the default, so they never show the old filter's data.
    async fetchInto<T>(
      slice: Slice<T>,
      url: string,
      params?: Record<string, unknown>,
      options: { keepData?: boolean } = {},
    ): Promise<boolean> {
      const requestId = slice.requestId + 1;
      slice.requestId = requestId;
      slice.loading = true;
      slice.error = null;
      if (!options.keepData) slice.data = null;
      try {
        const { data } = await api.get<T>(url, params ? { params: cleanParams(params) } : undefined);
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

    async fetchMembersSummary() {
      return this.fetchInto(this.membersSummary, '/municipality/members/summary');
    },

    async fetchMembers(filters: MemberListFilters = {}) {
      return this.fetchInto(this.members, '/municipality/members', { ...filters });
    },

    async fetchMemberDetail(memberId: number) {
      this.memberDetail.data = null;
      return this.fetchInto(this.memberDetail, `/municipality/members/${memberId}`);
    },

    // keepData is for page changes: the current page stays up until the next
    // one arrives, so the list does not collapse under the pager. Loading a
    // different member must leave it false, or their rows would mix.
    async fetchMemberFundTransactions(memberId: number, page: number, pageSize: number, keepData = false) {
      return this.fetchInto(
        this.memberFundTransactions,
        '/municipality/fund/transactions',
        { memberId, page, pageSize },
        { keepData },
      );
    },

    // Completed sales only (the operations list's rule), newest first; keepData
    // as in fetchMemberFundTransactions.
    async fetchMemberSales(memberId: number, page: number, pageSize: number, keepData = false) {
      return this.fetchInto(
        this.memberSales,
        '/municipality/operations/sales',
        { memberId, page, pageSize },
        { keepData },
      );
    },

    async fetchOperationsSummary(filters: OperationFilters = {}) {
      return this.fetchInto(this.operationsSummary, '/municipality/operations/summary', { ...filters });
    },

    async fetchSales(
      filters: OperationFilters & { page?: number | undefined; pageSize?: number | undefined } = {},
    ) {
      return this.fetchInto(this.sales, '/municipality/operations/sales', { ...filters });
    },

    async fetchFundSummary() {
      return this.fetchInto(this.fundSummary, '/municipality/fund/summary');
    },

    async fetchFundTransactions(filters: FundTransactionFilters = {}) {
      return this.fetchInto(this.fundTransactions, '/municipality/fund/transactions', { ...filters });
    },

    async fetchMonthlyReport(year: number, month: number) {
      return this.fetchInto(this.monthlyReport, '/municipality/reports/monthly', { year, month });
    },

    async fetchYearlyReport(year: number) {
      return this.fetchInto(this.yearlyReport, '/municipality/reports/yearly', { year });
    },

    async fetchFuneralCases(filters: FuneralCaseFilters = {}) {
      return this.fetchInto(this.funeralCases, '/municipality/funeral-cases', { ...filters });
    },

    // Every case matching the filter (for the PDF export), walking the pages at
    // the backend's max page size. Does not touch the funeralCases slice.
    async fetchAllFuneralCases(filters: Omit<FuneralCaseFilters, 'page' | 'pageSize'> = {}) {
      const all: FuneralCaseRow[] = [];
      for (let page = 1; ; page += 1) {
        const { data } = await api.get<FuneralCaseList>('/municipality/funeral-cases', {
          params: { ...filters, page, pageSize: 100 },
        });
        all.push(...data.items);
        if (page >= data.totalPages) return all;
      }
    },

    async fetchFuneralCase(caseId: number) {
      this.funeralCase.data = null;
      return this.fetchInto(this.funeralCase, `/municipality/funeral-cases/${caseId}`);
    },

    // Every report still waiting - there are only ever a handful, so one page.
    async fetchPendingFuneralCases() {
      return this.fetchInto(
        this.pendingFuneralCases,
        '/municipality/funeral-cases',
        { status: 'pending', pageSize: 100 },
        { keepData: true },
      );
    },

    // Approving marks the member deceased and moves the money. Throws on failure
    // (the page shows the message); on success the case is reloaded in place.
    async approveFuneralCase(caseId: number, ownSavingsOnly: boolean) {
      const { data } = await api.post<FuneralApprovalResult>(
        `/municipality/funeral-cases/${caseId}/approve`,
        ownSavingsOnly ? { ownSavingsOnly: true } : {},
      );
      await this.fetchInto(this.funeralCase, `/municipality/funeral-cases/${caseId}`, undefined, {
        keepData: true,
      });
      return data;
    },

    // Cash a member brought later towards a funeral contribution they were short
    // on - it goes on to that death's family. Throws on failure (the page shows
    // the message); on success the case is reloaded in place, without blanking it.
    async recordFuneralPayment(
      caseId: number,
      contributionId: number,
      input: { amount: number; note?: string | undefined },
    ) {
      await api.post(
        `/municipality/funeral-cases/${caseId}/contributions/${contributionId}/payments`,
        input,
      );
      await this.fetchInto(this.funeralCase, `/municipality/funeral-cases/${caseId}`, undefined, {
        keepData: true,
      });
    },

    async fetchExecutiveReport() {
      return this.fetchInto(this.executiveReport, '/municipality/reports/executive', undefined, {
        keepData: true,
      });
    },

    async fetchVillageReport() {
      return this.fetchInto(this.villageReport, '/municipality/reports/villages', undefined, {
        keepData: true,
      });
    },
  },
});
