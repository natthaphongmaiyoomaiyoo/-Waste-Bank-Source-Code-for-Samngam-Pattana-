import { defineStore } from 'pinia';
import { api } from 'boot/axios';

export interface LowBalanceMember {
  id: number;
  name: string;
  villageId: string;
  balance: number;
}

export interface AdminDashboardData {
  summary: {
    totalBalance: number;
    memberCount: number;
    nextCollectionDate: string;
    daysRemaining: number;
  };
  lowBalanceMembers: LowBalanceMember[];
  chartCategories: string[];
  chartSeriesData: number[];
}

// Mirrors eligibilityService.checkAllMembersEligibility on the backend.
export interface MemberEligibilityResult {
  memberId: number;
  memberCode: string;
  fullName: string;
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

export interface EligibilityOverview {
  checkedAt: string;
  windowMonths: number;
  summary: { total: number; eligible: number; notEligible: number };
  results: MemberEligibilityResult[];
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    summary: {
      totalBalance: 0,
      memberCount: 0,
      nextCollectionDate: '',
      daysRemaining: 0,
    },
    lowBalanceMembers: [] as LowBalanceMember[],
    chartCategories: [] as string[],
    chartSeriesData: [] as number[],
    loading: false,
    eligibility: null as EligibilityOverview | null,
    eligibilityLoading: false,
    eligibilityError: null as string | null,
  }),

  actions: {
    async fetchAdminDashboard() {
      this.loading = true;
      try {
        const { data } = await api.get<AdminDashboardData>('/admin/dashboard');
        this.summary = data.summary;
        this.lowBalanceMembers = data.lowBalanceMembers;
        this.chartCategories = data.chartCategories;
        this.chartSeriesData = data.chartSeriesData;
      } catch (error) {
        console.error('Error fetching admin dashboard:', error);
      } finally {
        this.loading = false;
      }
    },

    async fetchMembersEligibility() {
      this.eligibilityLoading = true;
      this.eligibilityError = null;
      try {
        const { data } = await api.get<EligibilityOverview>('/admin/dashboard/eligibility');
        this.eligibility = data;
      } catch (error) {
        console.error('Error fetching members eligibility:', error);
        this.eligibilityError = 'ไม่สามารถโหลดข้อมูลการตรวจสอบคุณสมบัติได้';
      } finally {
        this.eligibilityLoading = false;
      }
    },
  },
});
