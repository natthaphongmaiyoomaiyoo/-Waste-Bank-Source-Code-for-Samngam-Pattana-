import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

// Sell-request management store for the Waste Bank Committee role. Wraps the
// /api/committee/sell-requests endpoints (backend/src/routes/committeeRoutes.ts).
// Same Slice pattern as committeeStore: read slices track loading/error, write
// actions throw so pages can notify and reload.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RequestWasteType {
  id: number;
  wasteName: string;
  unit: string;
  defaultPrice: number;
  status: string;
}

export interface SellRequestItem {
  id: number;
  wasteTypeId: number;
  estimatedQuantity: number;
  wasteType: RequestWasteType;
}

export interface SellRequestMember {
  id: number;
  memberCode: string;
  prefix: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  household: {
    houseNo: string | null;
    moo: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string | null;
  } | null;
  // Detail endpoint only.
  fundBalance?: { totalContribution: number } | null;
}

export interface CommitteeSellRequest {
  id: number;
  memberId: number;
  roundId: number;
  requestDate: string;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  estimatedQuantity: number;
  status: string; // requested, confirmed, completed, cancelled
  note: string | null;
  member: SellRequestMember;
  round: {
    buyerId: number;
    // Present on list/detail responses (listInclude); a route plan may only go
    // to one buyer, so the planner groups selections by it.
    buyer?: { id: number; buyerName: string } | undefined;
    id: number;
    roundDate: string;
    startTime: string;
    endTime: string;
    locationNote: string | null;
    status: string;
  };
  items: SellRequestItem[];
}

export interface SaleDetailLine {
  id: number;
  wasteTypeId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  wasteType: RequestWasteType;
}

// หลักฐานการรับซื้อที่กรรมการแนบไว้ (รูปถ่าย/สลิป) รูปถูกย่อในเบราว์เซอร์ก่อนส่ง
export interface SaleDocument {
  id: number;
  saleId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  uploadedAt: string;
  fileUrl: string;
}

export interface CommitteeSellRequestDetail extends CommitteeSellRequest {
  fundMinimum: number;
  // Sale money the member chose to keep in savings on top of the automatic
  // top-up (0 when they took all of it as cash).
  savingsDeposit: number;
  sale: {
    id: number;
    saleNo: string;
    saleDate: string;
    totalAmount: number;
    fundDeductAmount: number;
    netAmount: number;
    details: SaleDetailLine[];
    receipt: { receiptNo: string } | null;
    documents: SaleDocument[];
  } | null;
}

export interface SellRequestsSummary {
  total: number;
  byStatus: Record<string, number>;
}

// `| undefined` spelled out because tsconfig sets exactOptionalPropertyTypes.
export interface SellRequestFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: string | undefined;
  search?: string | undefined;
  roundId?: number | undefined;
}

export interface PurchaseItemInput {
  wasteTypeId: number;
  quantity: number;
  unitPrice?: number | undefined;
}

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

export const useCommitteeRequestStore = defineStore('committeeRequest', {
  state: () => ({
    summary: emptySlice<SellRequestsSummary>(),
    requests: emptySlice<Paginated<CommitteeSellRequest>>(),
    requestDetail: emptySlice<CommitteeSellRequestDetail>(),
    wasteTypes: emptySlice<RequestWasteType[]>(),
  }),

  actions: {
    async fetchInto<T>(slice: Slice<T>, url: string, params?: Record<string, unknown>): Promise<boolean> {
      const requestId = slice.requestId + 1;
      slice.requestId = requestId;
      slice.loading = true;
      slice.error = null;
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

    // Takes the round filter so the cards match the list the page is showing.
    async fetchSummary(roundId?: number) {
      return this.fetchInto(this.summary, '/committee/sell-requests/summary', { roundId });
    },

    async fetchRequests(filters: SellRequestFilters = {}) {
      return this.fetchInto(this.requests, '/committee/sell-requests', { ...filters });
    },

    async fetchRequestDetail(requestId: number) {
      this.requestDetail.data = null;
      return this.fetchInto(this.requestDetail, `/committee/sell-requests/${requestId}`);
    },

    async fetchWasteTypes() {
      if (this.wasteTypes.data?.length) return true;
      return this.fetchInto(this.wasteTypes, '/committee/waste-types');
    },

    // --- Write actions (throw on failure; callers notify + reload) -------------

    async confirmRequest(requestId: number) {
      const { data } = await api.patch<CommitteeSellRequest>(
        `/committee/sell-requests/${requestId}/confirm`,
      );
      return data;
    },

    async cancelRequest(requestId: number, note?: string) {
      const { data } = await api.patch<CommitteeSellRequest>(
        `/committee/sell-requests/${requestId}/cancel`,
        note ? { note } : {},
      );
      return data;
    },

    // multipart: หลักฐานการรับซื้อ (ใบเสร็จ/รูปถ่าย) ต้องส่งไปพร้อมกัน อย่างน้อย 1 ไฟล์
    // backend ปฏิเสธถ้าไม่มีไฟล์ ทำให้ไม่มีการขายที่ไร้หลักฐาน (ดู recordPurchase)
    // ผู้เรียกควรย่อรูปด้วย compressImage() ก่อน
    async recordPurchase(
      requestId: number,
      items: PurchaseItemInput[],
      depositAmount: number,
      documents: File[],
      note?: string,
    ) {
      const form = new FormData();
      form.append('payload', JSON.stringify({ items, depositAmount, ...(note ? { note } : {}) }));
      for (const file of documents) {
        form.append('documents', file);
      }

      const { data } = await api.post<CommitteeSellRequestDetail>(
        `/committee/sell-requests/${requestId}/purchase`,
        form,
      );
      return data;
    },

    // แนบหลักฐานการรับซื้อ (ทำได้หลังบันทึกรับซื้อแล้ว) - ผู้เรียกควรย่อรูปด้วย
    // compressImage() ก่อนส่งเข้ามา
    async uploadSaleDocument(requestId: number, file: File, note?: string) {
      const form = new FormData();
      form.append('document', file);
      if (note) form.append('note', note);

      const { data } = await api.post<SaleDocument>(
        `/committee/sell-requests/${requestId}/documents`,
        form,
      );
      return data;
    },
  },
});
