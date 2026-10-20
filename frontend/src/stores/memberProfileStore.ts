import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import type { Paginated } from 'src/stores/committeeRequestStore';

export interface MemberFundTransaction {
  id: string;
  kind: 'sale' | 'fund';
  title: string;
  detail: string;
  date: string;
  time: string;
  receiptNo: string;
  amount: number;
  balance: number;
  positive: boolean;
}

// Sale-statement view (dedicated "ขายขยะ" tab): one row per sale, split into
// its money flows instead of one lump amount - totalAmount always equals
// fundDeductAmount (automatic top-up to the minimum) + surplusDeposit (kept in
// savings by choice) + cashReceived.
export interface MemberSaleBreakdown {
  id: string;
  // waste_sale id, for GET /history/sales/:id (the detail dialog).
  saleId: number;
  date: string;
  time: string;
  detail: string;
  receiptNo: string;
  totalAmount: number;
  fundDeductAmount: number;
  cashReceived: number;
  surplusDeposit: number;
}

// Placeholders until GET /eligibility answers - the rule itself lives in
// backend/src/config/constants.ts, and fetchSummary takes every threshold from the
// response so the page can never show a stale copy of it.
const FUND_MINIMUM = 50;
const SALE_ACTIVITY_MONTHS_REQUIRED = 6;
const SALE_ACTIVITY_WINDOW_MONTHS = 12;
const MEMBERSHIP_MONTHS_REQUIRED = 6;

interface BackendHousehold {
  moo?: string | null;
  subdistrict?: string | null;
}

interface BackendMember {
  memberCode: string;
  prefix?: string | null;
  firstName: string;
  lastName: string;
  household?: BackendHousehold | null;
  avatarUrl?: string | null;
}

interface BackendFundBalance {
  // The member's one savings balance (ยอดเงินสะสม).
  totalContribution: number;
}

interface BackendFundTransaction {
  id: number;
  saleId: number | null;
  transactionDate: string;
  transactionType: string;
  amountIn: number;
  amountOut: number;
  balanceAfter: number;
  note?: string | null;
  // This member's own savings balance after the row (paged ledger only).
  personalBalance: number;
}

interface BackendWasteSaleDetail {
  quantity: number;
  wasteType: { wasteName: string; unit: string };
}

interface BackendWasteSale {
  id: number;
  saleDate: string;
  status: string;
  totalAmount: number;
  fundDeductAmount: number;
  netAmount: number;
  details: BackendWasteSaleDetail[];
  receipt?: { receiptNo: string; paidAmount: number } | null;
}

interface BackendEligibility {
  activeMonthCount: number;
  membershipMonths: number;
  fundCheck: { required: number };
  membershipAgeCheck: { required: number };
  wasteSaleActivityCheck: { required: number; windowMonths: number };
}

const FUND_TRANSACTION_TITLES: Record<string, string> = {
  contribution: 'เติมเงินสะสมให้ครบขั้นต่ำ',
  benefit_payment: 'หักเงินสะสมเข้ากองทุนฌาปนกิจ',
  funeral_late_payment: 'ชำระเงินฌาปนกิจค้างจ่าย (เงินสด)',
  donation: 'เงินบริจาคเข้ากองทุน',
  adjustment: 'ปรับปรุงยอดเงินสะสม',
  deposit: 'เก็บเงินขายขยะเข้าเงินสะสม',
};

// Effect of each fund_transaction type on THIS member's savings balance -
// mirrors the increment/decrement calls in committeeSellRequestService and
// funeralFundService (fundService.listTransactionsPage replays the running
// balance with the same signs). Here it only decides + or - on a ledger row.
// funeral_late_payment is cash the member paid (shown as money out) that never
// passed through their savings, so the running balance stays where it was.
const FUND_TRANSACTION_SIGN: Record<string, 1 | -1> = {
  contribution: 1,
  deposit: 1,
  benefit_payment: -1,
  funeral_late_payment: -1,
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

// Sort/paging request of the two history tables (q-table's pagination model).
export interface MemberHistoryPageRequest {
  page: number;
  pageSize: number;
  sortBy?: 'date' | 'amount' | undefined;
  descending?: boolean | undefined;
}

function historyParams(request: MemberHistoryPageRequest) {
  return {
    page: request.page,
    pageSize: request.pageSize,
    sortBy: request.sortBy ?? 'date',
    ...(request.descending !== undefined ? { descending: String(request.descending) } : {}),
  };
}

function toSaleBreakdown(sale: BackendWasteSale): MemberSaleBreakdown {
  // totalAmount always equals fundDeductAmount + surplusDeposit + cashReceived,
  // all derived straight from WasteSale/Receipt fields.
  const cashReceived = sale.receipt?.paidAmount ?? sale.netAmount;
  return {
    id: `sale-${sale.id}`,
    saleId: sale.id,
    date: formatDate(sale.saleDate),
    time: formatTime(sale.saleDate),
    detail: sale.details
      .map((d) => `${d.wasteType.wasteName} ${d.quantity} ${d.wasteType.unit}`)
      .join(', '),
    receiptNo: sale.receipt?.receiptNo ?? '-',
    totalAmount: sale.totalAmount,
    fundDeductAmount: sale.fundDeductAmount,
    cashReceived,
    surplusDeposit: roundMoney(sale.netAmount - cashReceived),
  };
}

function toLedgerRow(tx: BackendFundTransaction): MemberFundTransaction {
  return {
    id: `fund-${tx.id}`,
    kind: 'fund',
    title: FUND_TRANSACTION_TITLES[tx.transactionType] ?? 'รายการเงินสะสม',
    detail: tx.note ?? '-',
    date: formatDate(tx.transactionDate),
    time: formatTime(tx.transactionDate),
    receiptNo: '-',
    amount: tx.amountIn || tx.amountOut,
    balance: tx.personalBalance,
    positive: (FUND_TRANSACTION_SIGN[tx.transactionType] ?? 1) > 0,
  };
}

// The notification bell and the page under it both load the summary on
// arrival; the second caller joins the request already in flight.
let summaryRequest: Promise<void> | null = null;

// สถานะสมาชิกฝั่งสมาชิก (Dashboard / แจ้งขายขยะ / ประวัติและเงินสะสม) ใช้ร่วมกันที่นี่ที่เดียว
// เพื่อไม่ให้ยอดเงินและประวัติธุรกรรมแต่ละหน้าขัดแย้งกัน
export const useMemberProfileStore = defineStore('memberProfile', {
  state: () => ({
    profile: {
      name: '',
      code: '',
      village: '',
      avatarUrl: null as string | null,
      // ยอดเงินสะสม - the member's only balance; it can't be withdrawn.
      fundBalance: 0,
      fundMinimum: FUND_MINIMUM,
      // Whole months approved as a member (funeral eligibility + credit panel).
      membershipMonths: 0,
      membershipTarget: MEMBERSHIP_MONTHS_REQUIRED,
      // Distinct calendar months with a completed sale (non-consecutive OK),
      // counted over the last saleActivityWindow months.
      saleActivityMonths: 0,
      saleActivityTarget: SALE_ACTIVITY_MONTHS_REQUIRED,
      saleActivityWindow: SALE_ACTIVITY_WINDOW_MONTHS,
    },
    loading: false,
    error: null as string | null,
  }),

  getters: {
    hasMinimumFund: (state) => state.profile.fundBalance >= state.profile.fundMinimum,
    // How far savings still are from the minimum (0 once the minimum is met).
    fundShortfall: (state) =>
      roundMoney(Math.max(state.profile.fundMinimum - state.profile.fundBalance, 0)),
    // Funeral eligibility: approved as a member for >= target months.
    hasRequiredMembership: (state) =>
      state.profile.membershipMonths >= state.profile.membershipTarget,
    // Funeral eligibility: sold in >= target distinct months (non-consecutive OK).
    hasRequiredSaleActivity: (state) =>
      state.profile.saleActivityMonths >= state.profile.saleActivityTarget,
    passesConditions(): boolean {
      return this.hasMinimumFund && this.hasRequiredMembership && this.hasRequiredSaleActivity;
    },
    remainingMonths: (state) =>
      Math.max(state.profile.membershipTarget - state.profile.membershipMonths, 0),
  },

  actions: {
    // Profile, savings balance and eligibility - everything the dashboard, the
    // notification bell and the history page header show. The sale history and
    // savings ledger are paged separately (fetchSalesPage / fetchLedgerPage).
    fetchSummary(): Promise<void> {
      summaryRequest ??= this.loadSummary().finally(() => {
        summaryRequest = null;
      });
      return summaryRequest;
    },

    async loadSummary() {
      this.loading = true;
      this.error = null;
      try {
        const [profileRes, fundBalanceRes, eligibilityRes] = await Promise.all([
          api.get<BackendMember>('/member/profile'),
          api.get<BackendFundBalance>('/fund/balance'),
          api.get<BackendEligibility>('/eligibility'),
        ]);

        const member = profileRes.data;
        const eligibility = eligibilityRes.data;

        const village =
          [
            member.household?.moo ? `หมู่ ${member.household.moo}` : null,
            member.household?.subdistrict,
          ]
            .filter(Boolean)
            .join(' ') || '-';

        this.profile = {
          name: `${member.prefix ?? ''}${member.firstName} ${member.lastName}`.trim(),
          code: member.memberCode,
          village,
          avatarUrl: member.avatarUrl ?? null,
          fundBalance: fundBalanceRes.data.totalContribution,
          fundMinimum: eligibility.fundCheck.required,
          membershipMonths: eligibility.membershipMonths,
          membershipTarget: eligibility.membershipAgeCheck.required,
          saleActivityMonths: eligibility.activeMonthCount,
          saleActivityTarget: eligibility.wasteSaleActivityCheck.required,
          saleActivityWindow: eligibility.wasteSaleActivityCheck.windowMonths,
        };
      } catch {
        this.error = 'ไม่สามารถโหลดข้อมูลเงินสะสมได้ กรุณาลองใหม่อีกครั้ง';
      } finally {
        this.loading = false;
      }
    },

    // One page of the "ขายขยะ" statement. Throws so the page can show an error.
    async fetchSalesPage(request: MemberHistoryPageRequest) {
      const { data } = await api.get<Paginated<BackendWasteSale>>('/history/sales', {
        params: historyParams(request),
      });
      return { rows: data.items.map(toSaleBreakdown), total: data.total };
    },

    // One page of the "เงินสะสม" ledger, each row carrying the member's own
    // running savings balance (worked out by the backend over the whole ledger).
    async fetchLedgerPage(request: MemberHistoryPageRequest) {
      const { data } = await api.get<Paginated<BackendFundTransaction>>('/fund/transactions', {
        params: historyParams(request),
      });
      return { rows: data.items.map(toLedgerRow), total: data.total };
    },
  },
});
