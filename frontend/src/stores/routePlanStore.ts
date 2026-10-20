import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import type { Paginated, SellRequestItem, SellRequestMember } from 'src/stores/committeeRequestStore';

// Pickup route plans: one run per round per village, built by the server as the
// committee accepts sell requests (the committee reads it and picks where it
// starts), and worked by the buyer (GET/PATCH /buyer/route-plans). One store
// serves both sides because they read the exact same plan shape - only the
// endpoint and who may write differs.

export type RouteStopStatus = 'pending' | 'next' | 'collected' | 'skipped';
export type RoutePlanStatus = 'sent' | 'in_progress' | 'completed' | 'cancelled';

export interface RouteStopRequest {
  id: number;
  estimatedQuantity: number;
  pickupAddress: string | null;
  status: string;
  note: string | null;
  member: SellRequestMember;
  items: SellRequestItem[];
}

export interface RouteStop {
  id: number;
  planId: number;
  requestId: number;
  sequence: number;
  lat: number;
  lng: number;
  legDistanceKm: number | null;
  status: RouteStopStatus;
  markedAt: string | null;
  note: string | null;
  request: RouteStopRequest;
}

export interface RoutePlan {
  id: number;
  roundId: number | null;
  villageAreaId: number | null;
  buyerId: number;
  planDate: string;
  startLat: number | null;
  startLng: number | null;
  totalDistanceKm: number | null;
  note: string | null;
  status: RoutePlanStatus;
  confirmedAt: string;
  buyer: { id: number; buyerName: string; phone: string | null } | null;
  villageArea: { id: number; villageName: string; moo: string | null } | null;
  round: { id: number; roundDate: string; startTime: string; endTime: string } | null;
  stops: RouteStop[];
}

interface StatusMeta {
  label: string;
  color: string;
  textColor: string;
  icon: string;
}

// Shared by the committee's "sent plans" panel and the buyer's board so one
// status never reads two different ways across the two roles.
const PLAN_STATUS_META: Record<RoutePlanStatus, StatusMeta> = {
  sent: { label: 'ส่งแล้ว รอเริ่ม', color: 'blue-1', textColor: 'blue-9', icon: 'send' },
  in_progress: { label: 'กำลังดำเนินการ', color: 'amber-1', textColor: 'amber-9', icon: 'local_shipping' },
  completed: { label: 'รับครบแล้ว', color: 'green-1', textColor: 'green-9', icon: 'check_circle' },
  cancelled: { label: 'ยกเลิก', color: 'grey-3', textColor: 'grey-8', icon: 'cancel' },
};

const STOP_STATUS_META: Record<RouteStopStatus, StatusMeta> = {
  pending: { label: 'ยังไม่ไป', color: 'grey-3', textColor: 'grey-8', icon: 'schedule' },
  next: { label: 'กำลังไปจุดนี้', color: 'amber-1', textColor: 'amber-9', icon: 'navigation' },
  collected: { label: 'รับแล้ว', color: 'green-1', textColor: 'green-9', icon: 'check_circle' },
  skipped: { label: 'ข้ามจุดนี้', color: 'red-1', textColor: 'red-9', icon: 'block' },
};

export function planStatusMeta(status: string): StatusMeta {
  return PLAN_STATUS_META[status as RoutePlanStatus] ?? PLAN_STATUS_META.sent;
}

export function stopStatusMeta(status: string): StatusMeta {
  return STOP_STATUS_META[status as RouteStopStatus] ?? STOP_STATUS_META.pending;
}

export const useRoutePlanStore = defineStore('routePlan', {
  state: () => ({
    plans: [] as RoutePlan[],
    loading: false,
    error: null as string | null,
    // Set while a specific stop is being marked, so only that row shows a spinner.
    markingStopId: null as number | null,
    // Committee "sent plans" panel only - the buyer board loads its list unpaged.
    committeePage: 1,
    committeePageSize: 10,
    committeeTotal: 0,
    committeeTotalPages: 1,
  }),

  getters: {
    // The stop the buyer is currently driving to (at most one per plan,
    // enforced server-side in routePlanService.markStop).
    nextStopOf:
      () =>
      (plan: RoutePlan): RouteStop | null =>
        plan.stops.find((stop) => stop.status === 'next') ?? null,

    remainingCountOf:
      () =>
      (plan: RoutePlan): number =>
        plan.stops.filter((stop) => stop.status === 'pending' || stop.status === 'next').length,
  },

  actions: {
    // --- Committee side ---

    // Where the run starts. The server re-orders the unvisited stops from it and
    // returns the plan as it now stands.
    async setStartPoint(planId: number, lat: number, lng: number) {
      const { data } = await api.patch<RoutePlan>(`/committee/route-plans/${planId}/start`, {
        lat,
        lng,
      });
      this.replacePlan(data);
      return data;
    },

    // No page = reload whichever page the panel is showing. Passing `page`
    // is what makes GET /committee/route-plans answer with one page instead of
    // every plan the village ever sent. `roundId` keeps the panel to the plans
    // of the round being planned.
    async fetchCommitteePlans(roundId: number, page?: number) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<Paginated<RoutePlan>>('/committee/route-plans', {
          params: { roundId, page: page ?? this.committeePage, pageSize: this.committeePageSize },
        });
        this.plans = data.items;
        this.committeePage = data.page;
        this.committeeTotal = data.total;
        this.committeeTotalPages = data.totalPages;
      } catch {
        this.error = 'ไม่สามารถโหลดแผนเส้นทางได้';
      } finally {
        this.loading = false;
      }
    },

    // --- Buyer side ---

    // Defaults to the plans the buyer still has work on; pass 'all' for history.
    async fetchBuyerPlans(status?: RoutePlanStatus | 'all') {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<RoutePlan[]>('/buyer/route-plans', {
          params: status ? { status } : {},
        });
        this.plans = data;
      } catch {
        this.error = 'ไม่สามารถโหลดแผนที่รับซื้อได้';
      } finally {
        this.loading = false;
      }
    },

    async markStop(planId: number, stopId: number, status: RouteStopStatus, note?: string) {
      this.markingStopId = stopId;
      try {
        const { data } = await api.patch<RoutePlan>(
          `/buyer/route-plans/${planId}/stops/${stopId}`,
          { status, ...(note !== undefined ? { note } : {}) },
        );
        this.replacePlan(data);
        return data;
      } finally {
        this.markingStopId = null;
      }
    },

    // The API returns the whole plan after every write, so the board never has
    // to guess what a mark did to the plan's own status.
    replacePlan(plan: RoutePlan) {
      const index = this.plans.findIndex((row) => row.id === plan.id);
      if (index === -1) {
        this.plans.unshift(plan);
      } else {
        this.plans.splice(index, 1, plan);
      }
    },
  },
});
