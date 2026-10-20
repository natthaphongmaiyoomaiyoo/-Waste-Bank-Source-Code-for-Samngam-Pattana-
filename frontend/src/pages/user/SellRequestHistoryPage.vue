<template>
  <q-page class="history-page">
    <div class="page-shell">
      <section class="page-hero">
        <div class="hero-heading">
          <div class="hero-icon"><q-icon name="history" /></div>
          <div>
            <div class="eyebrow">คำขอขายขยะ</div>
            <div class="page-title">คำขอขายขยะล่าสุด</div>
          </div>
        </div>
        <q-btn
          unelevated
          no-caps
          icon="add"
          label="แจ้งขายขยะใหม่"
          class="primary-btn"
          to="/sell-request"
        />
      </section>

      <div class="stat-grid q-mt-lg">
        <div class="stat-card">
          <div class="stat-icon icon-dark"><q-icon name="inventory_2" /></div>
          <div>
            <div class="stat-value">{{ summary.total }}</div>
            <div class="stat-label">คำขอทั้งหมด</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-wait"><q-icon name="hourglass_top" /></div>
          <div>
            <div class="stat-value">{{ countByStatus('requested') }}</div>
            <div class="stat-label">รอรับเรื่อง</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-going"><q-icon name="local_shipping" /></div>
          <div>
            <div class="stat-value">{{ countByStatus('confirmed') }}</div>
            <div class="stat-label">กรรมการกำลังไปรับ</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-done"><q-icon name="task_alt" /></div>
          <div>
            <div class="stat-value">{{ countByStatus('completed') }}</div>
            <div class="stat-label">รับซื้อแล้ว</div>
          </div>
        </div>
      </div>

      <q-card flat class="content-card table-card q-mt-lg">
        <div class="table-head">
          <div class="section-head">
            <div class="section-icon icon-blue"><q-icon name="fact_check" /></div>
            <div>
              <div class="section-title">รายการคำขอขายขยะ</div>
            </div>
          </div>
        </div>

        <div class="filter-row">
          <MidFilterBar
            v-model:search="requestSearch"
            search-label="ค้นหาพื้นที่ ประเภทขยะ หรือสถานะ"
            :search-debounce="250"
            title="กรองคำขอขายขยะ"
            :active="activeFilters"
            @clear="clearFilter"
            @clear-all="clearAllFilters"
          >
            <q-select
              v-model="requestStatusFilter"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="สถานะ"
              :options="requestStatusOptions"
            />
            <template #actions>
              <q-badge v-if="summary.total" class="count-badge">
                {{ pagination.rowsNumber }} / {{ summary.total }} รายการ
              </q-badge>
            </template>
          </MidFilterBar>
        </div>

        <q-table
          flat
          row-key="id"
          class="request-table"
          v-model:pagination="pagination"
          :rows="requests"
          :columns="requestColumns"
          :grid="isPhone"
          :loading="requestsLoading"
          :rows-per-page-options="requestRowsOptions"
          no-data-label="ไม่พบคำขอขายขยะ"
          @request="onTableRequest"
          @row-click="(_evt, row) => openRequestDetail(row as WasteRequest)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <!-- Phone: one card per request - the five columns are unreadable
               squeezed into a phone width. -->
          <template #item="props">
            <div class="request-card-wrap col-12">
              <article class="request-card" @click="openRequestDetail(props.row as WasteRequest)">
                <div class="request-card-head">
                  <div class="request-card-title">
                    <div class="cell-strong">{{ props.row.villageName || 'ไม่ระบุพื้นที่' }}</div>
                    <div class="round-meta">
                      <span class="round-meta-item">
                        <q-icon name="event" size="14px" />
                        รอบวันที่ {{ formatDate(props.row.roundDate) }}
                      </span>
                      <span
                        v-if="props.row.timeStart && props.row.timeEnd"
                        class="round-meta-item"
                      >
                        <q-icon name="schedule" size="14px" />
                        {{ props.row.timeStart }}–{{ props.row.timeEnd }} น.
                      </span>
                    </div>
                    <div v-if="props.row.roundNote" class="round-note">
                      <q-icon name="sticky_note_2" size="13px" />
                      <span>หมายเหตุรอบ: {{ props.row.roundNote }}</span>
                    </div>
                  </div>
                  <q-badge class="status-chip" :class="statusMeta(props.row.status).cls">
                    <q-icon :name="statusMeta(props.row.status).icon" size="13px" class="q-mr-xs" />
                    {{ statusMeta(props.row.status).label }}
                  </q-badge>
                </div>

                <dl class="request-card-rows">
                  <div>
                    <dt>ส่งคำขอเมื่อ</dt>
                    <dd>{{ formatDate(props.row.requestedAt) }}</dd>
                  </div>
                </dl>

                <div v-if="props.row.note" class="note-box">
                  <q-icon name="sticky_note_2" size="16px" />
                  <span>{{ props.row.note }}</span>
                </div>

                <div v-if="canCancel(props.row.status)" class="request-card-actions">
                  <q-btn
                    flat
                    no-caps
                    icon="delete_outline"
                    label="ลบคำขอ"
                    class="request-card-delete"
                    @click.stop="confirmCancel(props.row as WasteRequest)"
                  />
                </div>
              </article>
            </div>
          </template>

          <template #body-cell-date="props">
            <q-td :props="props">
              <div class="text-weight-medium">{{ formatDate(props.row.requestedAt) }}</div>
            </q-td>
          </template>

          <template #body-cell-round="props">
            <q-td :props="props">
              <div class="round-cell">
                <span class="text-weight-medium">
                  {{ props.row.villageName || 'ไม่ระบุพื้นที่' }}
                  <q-icon v-if="props.row.note" name="sticky_note_2" class="note-flag">
                    <q-tooltip>หมายเหตุ: {{ props.row.note }}</q-tooltip>
                  </q-icon>
                </span>
                <span class="round-time">
                  {{ formatDate(props.row.roundDate) }}
                  <template v-if="props.row.timeStart && props.row.timeEnd">
                    · {{ props.row.timeStart }}-{{ props.row.timeEnd }} น.
                  </template>
                </span>
                <span v-if="props.row.roundNote" class="round-note">
                  <q-icon name="sticky_note_2" size="13px" />
                  <span>หมายเหตุรอบ: {{ props.row.roundNote }}</span>
                </span>
              </div>
            </q-td>
          </template>

          <template #body-cell-quantity="props">
            <q-td :props="props" class="text-right text-weight-medium">
              {{ totalRequestQuantity(props.row).toLocaleString() }} กก.
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props" class="text-center">
              <q-badge class="status-chip" :class="statusMeta(props.row.status).cls">
                <q-icon :name="statusMeta(props.row.status).icon" size="13px" class="q-mr-xs" />
                {{ statusMeta(props.row.status).label }}
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" class="text-right" @click.stop>
              <q-btn
                v-if="canCancel(props.row.status)"
                flat
                round
                dense
                color="negative"
                icon="delete_outline"
                @click="confirmCancel(props.row as WasteRequest)"
              >
                <q-tooltip>ลบคำขอ</q-tooltip>
              </q-btn>
              <span v-else class="text-caption text-grey-6">-</span>
            </q-td>
          </template>

          <template #no-data>
            <div class="empty-state table-empty">
              <q-icon name="recycling" size="34px" />
              <div class="text-weight-bold q-mt-sm">
                {{ summary.total ? 'ไม่พบคำขอที่ตรงกับเงื่อนไข' : 'ยังไม่มีคำขอขายขยะ' }}
              </div>
              <q-btn
                v-if="!summary.total"
                unelevated
                no-caps
                icon="add"
                label="แจ้งขายขยะใหม่"
                class="primary-btn q-mt-md"
                to="/sell-request"
              />
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <q-dialog v-model="detailOpen">
      <q-card v-if="detailRequest" class="request-detail-card">
        <q-card-section class="detail-head">
          <div>
            <div class="section-title">รายละเอียดคำขอขายขยะ</div>
            <div class="detail-sub">ส่งคำขอเมื่อ {{ formatDate(detailRequest.requestedAt) }}</div>
          </div>
          <q-badge class="status-chip" :class="statusMeta(detailRequest.status).cls">
            <q-icon :name="statusMeta(detailRequest.status).icon" size="13px" class="q-mr-xs" />
            {{ statusMeta(detailRequest.status).label }}
          </q-badge>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="detail-row">
            <span>รอบรับซื้อ / พื้นที่</span>
            <strong>{{ detailRequest.villageName || 'ไม่ระบุพื้นที่' }}</strong>
          </div>
          <div class="detail-row">
            <span>วันที่รับซื้อ</span>
            <strong>{{ formatDate(detailRequest.roundDate) }}</strong>
          </div>
          <div v-if="detailRequest.timeStart && detailRequest.timeEnd" class="detail-row">
            <span>เวลา</span>
            <strong>{{ detailRequest.timeStart }}-{{ detailRequest.timeEnd }} น.</strong>
          </div>
          <div v-if="detailRequest.roundNote" class="detail-row">
            <span>หมายเหตุรอบ</span>
            <strong>{{ detailRequest.roundNote }}</strong>
          </div>

          <div v-if="detailRequest.note" class="note-box">
            <q-icon name="sticky_note_2" size="16px" />
            <span>หมายเหตุ: {{ detailRequest.note }}</span>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="detail-actions">
          <MidButton
            v-if="canCancel(detailRequest.status)"
            variant="danger"
            icon="delete_outline"
            label="ลบคำขอ"
            @click="cancelFromDetail"
          />
          <MidButton v-close-popup label="ปิด" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableProps } from 'quasar';
import {
  MidButton,
  MidFilterBar,
  midOptionLabel,
  midConfirm,
  midNotify,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  midRowsPerPageOptions,
} from 'components/MID';
import { api } from 'src/boot/axios';
import { apiErrorMessage as backendErrorMessage } from 'src/utils/apiError';

// 5/10/20/50 plus this list's own default of 8.
const requestRowsOptions = midRowsPerPageOptions(8);

interface WasteRequestItem {
  name: string;
  quantity: number;
}

interface WasteRequest {
  id: number;
  // When the member sent it, and the date of the round they sent it for - the
  // page used to show the round date under a 'วันที่ส่งคำขอ' heading.
  requestedAt: string;
  roundDate: string;
  status: string;
  items: WasteRequestItem[];
  // What the member wrote for the committee when they sent the request. The
  // committee appends its own lines here when it cancels or records a purchase,
  // so this is the whole conversation on the request, not just the member's part.
  note: string;
  // Buyer of the round (the name the round goes by on the member's pages).
  villageName?: string;
  // The committee's "จุดนัดหมาย / หมายเหตุ" on the round itself.
  roundNote?: string;
  timeStart?: string;
  timeEnd?: string;
}

interface BackendSaleRequest {
  id: number;
  requestDate: string;
  status: string;
  note: string | null;
  items: { estimatedQuantity: number; wasteType: { wasteName: string } }[];
  round: {
    roundDate: string;
    startTime: string;
    endTime: string;
    locationNote: string | null;
    buyer?: { buyerName: string } | null;
  };
}

const $q = useQuasar();

// The table's five columns don't fit a phone, so small screens get one card per
// request instead (q-table grid mode), like the history page.
const isPhone = computed(() => $q.screen.lt.sm);

const requests = ref<WasteRequest[]>([]);
const requestsLoading = ref(false);
const requestSearch = ref('');
// null = every status, which is what clearing the select in the filter dialog
// leaves behind.
const requestStatusFilter = ref<string | null>(null);
const detailOpen = ref(false);
const detailRequest = ref<WasteRequest | null>(null);

// Paged, filtered and sorted by the server; the search covers the same text
// the list shows (area, waste types, status, dates, notes).
const pagination = useRememberedPagination('member-sell-requests', {
  page: 1,
  rowsPerPage: 8,
  rowsNumber: 0,
  sortBy: null as string | null,
  descending: false,
});

// Every request of the member, by status - the cards above the table.
const summary = ref({ total: 0, byStatus: {} as Record<string, number> });

const requestStatusOptions = [
  { label: 'รอรับเรื่อง', value: 'requested' },
  { label: 'กรรมการกำลังไปรับ', value: 'confirmed' },
  { label: 'รับซื้อแล้ว', value: 'completed' },
  { label: 'ยกเลิกแล้ว', value: 'cancelled' },
];

const activeFilters = computed<MidActiveFilter[]>(() =>
  requestStatusFilter.value
    ? [
        {
          key: 'status',
          label: 'สถานะ',
          value: midOptionLabel(requestStatusOptions, requestStatusFilter.value),
        },
      ]
    : [],
);

function clearFilter(key: string) {
  if (key === 'status') requestStatusFilter.value = null;
}

function clearAllFilters() {
  requestStatusFilter.value = null;
}

const requestColumns: QTableProps['columns'] = [
  { name: 'date', label: 'วันที่ส่งคำขอ', field: 'requestedAt', align: 'left', sortable: true },
  { name: 'round', label: 'รอบรับซื้อ / พื้นที่', field: 'villageName', align: 'left' },
  {
    name: 'quantity',
    label: 'ปริมาณรวม',
    field: (row: WasteRequest) => totalRequestQuantity(row),
    align: 'right',
    sortable: true,
  },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'center', sortable: true },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

function countByStatus(status: string) {
  return summary.value.byStatus[status] ?? 0;
}

function mapSaleRequest(request: BackendSaleRequest): WasteRequest {
  return {
    id: request.id,
    requestedAt: request.requestDate,
    roundDate: request.round.roundDate.slice(0, 10),
    status: request.status,
    note: request.note ?? '',
    items: (request.items ?? []).map((item) => ({
      name: item.wasteType.wasteName,
      quantity: item.estimatedQuantity,
    })),
    timeStart: request.round.startTime,
    timeEnd: request.round.endTime,
    ...(request.round.buyer?.buyerName ? { villageName: request.round.buyer.buyerName } : {}),
    ...(request.round.locationNote ? { roundNote: request.round.locationNote } : {}),
  };
}

function totalRequestQuantity(request: WasteRequest) {
  return (
    Math.round(request.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) * 100) / 100
  );
}

function statusMeta(status: string) {
  switch (status) {
    case 'confirmed':
      return { label: 'กรรมการกำลังไปรับ', icon: 'local_shipping', cls: 'chip-going' };
    case 'completed':
      return { label: 'รับซื้อแล้ว', icon: 'task_alt', cls: 'chip-done' };
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', icon: 'cancel', cls: 'chip-off' };
    default:
      return { label: 'รอรับเรื่อง', icon: 'hourglass_top', cls: 'chip-wait' };
  }
}

// Only while the request is still waiting: once the committee has taken it on
// (กรรมการกำลังไปรับ) the member can no longer remove it.
function canCancel(status: string) {
  return status === 'requested';
}

async function fetchSummary() {
  try {
    const { data } = await api.get<{ total: number; byStatus: Record<string, number> }>(
      '/sell-requests/summary',
    );
    summary.value = data;
  } catch {
    // The cards just stay at their last numbers; the list reports its own error.
  }
}

async function fetchRequests(next?: Omit<typeof pagination.value, 'rowsNumber'>) {
  const request = { ...pagination.value, ...next };
  requestsLoading.value = true;
  try {
    const { data } = await api.get<{ items: BackendSaleRequest[]; total: number }>('/sell-requests', {
      params: {
        page: request.page,
        pageSize: request.rowsPerPage,
        ...(requestStatusFilter.value ? { status: requestStatusFilter.value } : {}),
        ...(requestSearch.value.trim() ? { search: requestSearch.value.trim() } : {}),
        ...(request.sortBy
          ? { sortBy: request.sortBy, descending: String(request.descending) }
          : {}),
      },
    });
    requests.value = data.items.map(mapSaleRequest);
    pagination.value = { ...request, rowsNumber: data.total };
  } catch (err) {
    midNotify({
      type: 'error',
      message: backendErrorMessage(err, 'ไม่สามารถโหลดคำขอขายขยะได้'),
    });
  } finally {
    requestsLoading.value = false;
  }
}

function openRequestDetail(request: WasteRequest) {
  detailRequest.value = request;
  detailOpen.value = true;
}

function cancelFromDetail() {
  if (!detailRequest.value) return;
  void confirmCancel(detailRequest.value);
}

// The request isn't erased - it stays in the list as "ยกเลิกแล้ว" so the
// committee's records still show it. The dialog says so before it happens:
// a short question, the request in its own box, and that as a note below.
async function confirmCancel(request: WasteRequest) {
  const confirmed = await midConfirm({
    title: 'ลบคำขอขายขยะ',
    message: 'ต้องการลบคำขอนี้ใช่หรือไม่?',
    item: {
      name: `รอบวันที่ ${formatDate(request.roundDate)}`,
      details: [
        request.villageName || 'ไม่ระบุพื้นที่',
        request.timeStart && request.timeEnd
          ? `เวลา ${request.timeStart} - ${request.timeEnd} น.`
          : null,
      ],
    },
    note: 'คำขอจะแสดงในรายการเป็น "ยกเลิกแล้ว"',
    tone: 'danger',
    cancelLabel: 'ไม่ลบ',
    confirmLabel: 'ลบคำขอ',
  });
  if (confirmed) await cancelRequest(request.id);
}

async function cancelRequest(id: number) {
  try {
    await api.patch(`/sell-requests/${id}/cancel`);
    detailOpen.value = false;
    await Promise.all([fetchRequests(), fetchSummary()]);
    midNotify({ type: 'success', message: 'ลบคำขอขายขยะแล้ว' });
  } catch (err) {
    midNotify({ type: 'error', message: backendErrorMessage(err, 'ลบคำขอไม่สำเร็จ') });
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function onTableRequest(props: { pagination: Omit<typeof pagination.value, 'rowsNumber'> }) {
  void fetchRequests(props.pagination);
}

// A new filter changes what the pages hold - start from the first page again.
watch([requestSearch, requestStatusFilter], () => {
  void fetchRequests({ ...pagination.value, page: 1 });
});

onMounted(() => {
  void fetchRequests();
  void fetchSummary();
});
</script>

<style scoped>
.history-page {
  min-height: 100%;
  padding: 24px;
  background: #f3f7f1;
}

.page-shell {
  max-width: 1180px;
  margin: 0 auto;
}

.page-hero,
.content-card {
  border: 1px solid #dfe9df;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(31, 71, 45, 0.07);
}

.page-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  color: #063f27;
}

.hero-heading {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.hero-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  color: #087f49;
  background: #e6f5ea;
  border-radius: 14px;
  font-size: 26px;
}

.eyebrow {
  color: #087f49;
  font-weight: 800;
}

.page-title {
  margin-top: 4px;
  color: #063f27;
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 900;
  line-height: 1.15;
}

.primary-btn {
  color: #ffffff;
  background: #087f49;
  border-radius: 10px;
  font-weight: 800;
  padding: 10px 18px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid #dfe9df;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(31, 71, 45, 0.07);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  border-radius: 12px;
  font-size: 22px;
}

.icon-dark {
  color: #1f2d27;
  background: #eef1f0;
}

.icon-wait {
  color: #8a5a12;
  background: #fff4e5;
}

.icon-going {
  color: #1565c0;
  background: #e3f0fd;
}

.icon-done {
  color: #087f49;
  background: #eef8ef;
}

.stat-value {
  color: #111f18;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.1;
}

.stat-label {
  margin-top: 2px;
  color: #6f7f76;
  font-size: 12.5px;
  font-weight: 700;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.section-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  font-size: 20px;
  flex: 0 0 auto;
}

.icon-blue {
  color: #1565c0;
  background: #e3f0fd;
}

.section-title {
  color: #111f18;
  font-size: 17px;
  font-weight: 900;
}

.table-card {
  overflow: hidden;
}

.table-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 22px 24px 0;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
}

.count-badge {
  padding: 6px 12px;
  color: #087f49;
  background: #eef8ef;
  border-radius: 999px;
  font-weight: 800;
}

.request-table {
  border-top: 1px solid #edf2ee;
}

.request-table :deep(.q-table__middle) {
  overflow-x: auto;
}

.request-table :deep(table) {
  min-width: 640px;
}

.request-table :deep(thead th) {
  color: #43514a;
  font-size: 13px;
  font-weight: 700;
}

.request-table :deep(tbody td) {
  color: #2c3b33;
  font-weight: 400;
  vertical-align: middle;
}

.round-cell {
  display: grid;
  gap: 2px;
}

.round-time {
  color: #718178;
  font-size: 12px;
  font-weight: 700;
}

/* Round date and time as two separate pieces: each stays whole and drops to
   its own line when the card is narrow, instead of the time splitting mid-way
   ("09:00–" / "20:00 น."). */
.round-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-top: 4px;
  color: #718178;
  font-size: 12.5px;
  font-weight: 600;
}

.round-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.round-meta-item .q-icon {
  color: #8a9a91;
}

.round-note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 2px;
  color: #718178;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.round-note .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #35a463;
}

.request-table :deep(tbody tr) {
  cursor: pointer;
}

/* --- Phone cards (q-table grid mode) --- */

.request-card-wrap {
  padding: 6px 12px;
}

.request-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  cursor: pointer;
}

.request-card-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.request-card-title {
  min-width: 0;
  flex: 1;
}

.cell-strong {
  color: #18231e;
  font-size: 14.5px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.cell-sub {
  margin-top: 2px;
  color: #718178;
  font-size: 12.5px;
  font-weight: 600;
}

.request-card-rows {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #e3ece2;
}

.request-card-rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.request-card-rows dt {
  color: #7f8f85;
  font-size: 13px;
  font-weight: 600;
}

.request-card-rows dd {
  margin: 0;
  color: #18231e;
  font-size: 13.5px;
  font-weight: 800;
  text-align: right;
  overflow-wrap: anywhere;
}

.request-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.request-card-delete {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  font-weight: 800;
  color: #c62828;
  background: #fdecec;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px;
  color: #6f7f76;
  font-weight: 700;
}

.table-empty {
  width: 100%;
  min-height: 160px;
  justify-content: center;
}

.request-detail-card {
  width: min(460px, calc(100vw - 32px));
  border-radius: 16px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-sub {
  margin-top: 2px;
  color: #6f7f76;
  font-size: 13px;
  font-weight: 600;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  color: #24372d;
  font-weight: 600;
}

.detail-actions {
  gap: 8px;
  padding: 8px 16px 16px;
}

/* The member's own message to the committee, plus whatever the committee added
   to it later (it appends its cancel/purchase notes to the same field). */
.note-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  color: #6b5312;
  background: #fff8e6;
  border: 1px solid #f2e3bd;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.note-box .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.note-flag {
  margin-left: 4px;
  color: #c08a1e;
  font-size: 16px;
  vertical-align: -2px;
}

.detail-row span {
  color: #6f7f76;
  font-weight: 600;
}

.status-chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.chip-wait {
  color: #8a5a12;
  background: #fff4e5;
}

.chip-going {
  color: #1565c0;
  background: #e3f0fd;
}

.chip-done {
  color: #087f49;
  background: #eef8ef;
}

.chip-off {
  color: #667066;
  background: #eef1f0;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .history-page {
    padding: 16px;
  }

  .page-hero {
    padding: 20px;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }

  .table-head {
    padding: 18px 16px 0;
  }

  .filter-row {
    padding: 12px 16px;
  }

  /* One column, with 'แจ้งขายขยะใหม่' above the heading rather than squeezed
     beside it. */
  .page-hero {
    flex-direction: column;
    align-items: stretch;
  }

  /* No "แจ้งขายขยะใหม่" up here on a phone: it crowds the heading, and the
     dashboard's own "แจ้งขาย" button already leads there. The empty state still
     offers one when there is nothing to list. */
  .page-hero .primary-btn {
    display: none;
  }

  .detail-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
