import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

// Overview dashboard for the Waste Bank / Village Committee role - one GET
// (/api/committee/dashboard) behind the committee's landing page. The backend
// already scopes every figure to the committee's own village, so nothing here
// sends a village id.
//
// Read shape follows committeeStore's slice pattern (loading / error / data)
// so the page can render skeletons, an error banner and a retry the same way
// the rest of the committee pages do.

export interface DashboardVillage {
  id: number;
  villageName: string;
  moo: string;
}

export interface DashboardFund {
  // Every member's savings balance in this village, added up.
  totalBalance: number;
  minimumPerMember: number;
  activeMemberCount: number;
  requiredTotal: number;
  belowMinimumCount: number;
  belowMinimumShortfall: number;
  fullyContributedCount: number;
}

export interface DashboardMonthly {
  sellRequestMemberCount: number;
  sellRequestCount: number;
  wasteQuantity: number;
  completedSaleCount: number;
  saleAmount: number;
  netPaidAmount: number;
  fundContribution: number;
  fundContributionCount: number;
  newMemberCount: number;
  funeralCaseCount: number;
}

export interface DashboardSellRequests {
  total: number;
  byStatus: Record<string, number>;
  waitingReview: number;
  confirmed: number;
}

export interface DashboardCurrentRound {
  id: number;
  roundDate: string;
  startTime: string;
  endTime: string;
  status: string;
  locationNote: string | null;
  buyer: { id: number; buyerName: string; phone: string | null } | null;
  villageArea: { id: number; villageName: string; moo: string | null } | null;
  requestCount: number;
  plannedRequestCount: number;
  readyToPlanCount: number;
  missingLocationCount: number;
}

export interface DashboardAreaGroup {
  label: string;
  requestCount: number;
  memberCount: number;
  estimatedQuantity: number;
  plannedCount: number;
}

export interface DashboardRoutePlan {
  id: number;
  planDate: string;
  status: string;
  buyerName: string | null;
  totalDistanceKm: number | null;
  stopCount: number;
  collectedCount: number;
}

export interface DashboardApprovals {
  funeralShortfallCount: number;
  funeralShortfallAmount: number;
}

export interface DashboardAtRiskMember {
  id: number;
  memberCode: string;
  fullName: string;
  phone: string;
  contribution: number;
  activeMonths: number;
  requiredMonths: number;
  reasons: string[];
}

export interface DashboardBelowMinimumMember {
  id: number;
  memberCode: string;
  fullName: string;
  phone: string;
  contribution: number;
  shortfall: number;
}

export interface DashboardMembers {
  total: number;
  byStatus: Record<string, number>;
  pendingApproval: number;
  activeCount: number;
  benefitEligible: number;
  atRiskCount: number;
  atRiskMembers: DashboardAtRiskMember[];
  belowMinimumCount: number;
  belowMinimumMembers: DashboardBelowMinimumMember[];
}

export interface CommitteeDashboard {
  generatedAt: string;
  village: DashboardVillage | null;
  month: { start: string; end: string };
  fund: DashboardFund;
  monthly: DashboardMonthly;
  sellRequests: DashboardSellRequests;
  currentRound: DashboardCurrentRound | null;
  areaGroups: DashboardAreaGroup[];
  routePlans: DashboardRoutePlan[];
  approvals: DashboardApprovals;
  members: DashboardMembers;
}

const LOAD_ERROR = 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง';

export const useCommitteeDashboardStore = defineStore('committeeDashboard', {
  state: () => ({
    loading: false,
    error: null as string | null,
    data: null as CommitteeDashboard | null,
    // Guards against an older in-flight refresh overwriting a newer one.
    requestId: 0,
  }),

  actions: {
    async fetchDashboard() {
      const requestId = this.requestId + 1;
      this.requestId = requestId;
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<CommitteeDashboard>('/committee/dashboard');
        if (this.requestId !== requestId) return false;
        this.data = data;
        return true;
      } catch {
        if (this.requestId !== requestId) return false;
        this.error = LOAD_ERROR;
        return false;
      } finally {
        if (this.requestId === requestId) {
          this.loading = false;
        }
      }
    },
  },
});
