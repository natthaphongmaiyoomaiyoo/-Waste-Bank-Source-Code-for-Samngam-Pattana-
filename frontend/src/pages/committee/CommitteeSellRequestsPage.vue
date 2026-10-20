<template>
  <q-page class="muni-page">
    <div class="muni-shell requests-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="round-hero">
          <div class="hero-icon">
            <q-icon name="assignment" />
          </div>
          <div class="hero-copy">
            <h1>คำขอขายขยะ</h1>
            <p class="hero-buyer">{{ roundInfo?.buyer ?? roundMessage }}</p>
          </div>
          <div v-if="roundInfo" class="hero-meta">
            <span class="hero-chip">
              <q-icon name="event" size="16px" />
              {{ roundInfo.date }}
            </span>
            <span class="hero-chip">
              <q-icon name="schedule" size="16px" />
              {{ roundInfo.time }}
            </span>
            <span v-if="roundInfo.note" class="hero-chip hero-chip--note">
              <q-icon name="sticky_note_2" size="16px" />
              <span>หมายเหตุ: {{ roundInfo.note }}</span>
            </span>
          </div>
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="เลือกรอบอื่น"
            class="hero-link-btn"
            :to="`/committee/sell-requests?round=${roundId}`"
          />
        </div>
      </section>

      <!-- Status summary -->
      <div class="summary-grid">
        <div v-for="card in summaryCards" :key="card.key" class="summary-card">
          <div class="summary-icon" :class="card.iconCls">
            <q-icon :name="card.icon" />
          </div>
          <div class="summary-content">
            <div class="summary-label">{{ card.label }}</div>
            <div class="summary-value">
              {{ store.summary.data ? (card.key === 'total' ? store.summary.data.total : (store.summary.data.byStatus[card.key] ?? 0)) : '-' }}
              <span>รายการ</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters + table -->
      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">รายการคำร้อง</div>
          </div>
        </div>

        <div class="filter-row">
          <MidFilterBar
            v-model:search="search"
            search-label="ค้นหาชื่อ / รหัสสมาชิก / เบอร์โทร"
            :search-debounce="400"
            title="กรองคำร้องขายขยะ"
            :active="activeFilters"
            @update:search="reload(1)"
            @clear="setStatus(null)"
            @clear-all="setStatus(null)"
          >
            <q-select
              :model-value="statusFilter"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="สถานะ"
              :options="statusOptions"
              @update:model-value="setStatus"
            />
          </MidFilterBar>
        </div>

        <q-banner v-if="store.requests.error" dense rounded class="error-banner q-ma-md">
          <template #avatar><q-icon name="error_outline" color="negative" /></template>
          {{ store.requests.error }}
        </q-banner>

        <q-table
          v-else
          flat
          row-key="id"
          class="muni-table requests-table"
          :rows="rows"
          :columns="columns"
          :grid="isPhone"
          :loading="store.requests.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
          @row-click="(_evt, row) => goDetail((row as CommitteeSellRequest).id)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <!-- Phone: one card per request - eight columns don't fit a phone width.
               The round column is left out: every request here is in the hero's round. -->
          <template #item="props">
            <div class="request-card-wrap col-12">
              <article class="request-card" @click="goDetail((props.row as CommitteeSellRequest).id)">
                <div class="request-card-head">
                  <div class="member-cell request-card-title">
                    <div class="member-name">
                      {{ props.row.member.prefix ?? '' }}{{ props.row.member.firstName }} {{ props.row.member.lastName }}
                    </div>
                    <div class="member-sub">รหัส {{ props.row.member.memberCode }} · {{ props.row.member.phone }}</div>
                  </div>
                  <q-badge class="status-chip" :class="statusMeta(props.row.status).cls">
                    <q-icon :name="statusMeta(props.row.status).icon" size="12px" class="q-mr-xs" />
                    {{ statusMeta(props.row.status).label }}
                  </q-badge>
                </div>

                <dl class="request-card-rows">
                  <div>
                    <dt>วันที่แจ้ง</dt>
                    <dd>{{ formatDate(props.row.requestDate) }}</dd>
                  </div>
                  <div>
                    <dt>รวม (กก.)</dt>
                    <dd>{{ props.row.estimatedQuantity }}</dd>
                  </div>
                  <div>
                    <dt>มูลค่าประมาณ (บาท)</dt>
                    <dd>
                      <span v-if="estimatedValue(props.row) !== null" class="value-cell">
                        {{ estimatedValue(props.row)!.toLocaleString() }}
                      </span>
                      <span v-else class="text-grey-6">-</span>
                    </dd>
                  </div>
                  <div>
                    <dt>ตำแหน่ง</dt>
                    <dd @click.stop>
                      <q-btn
                        v-if="props.row.pickupLat !== null && props.row.pickupLng !== null"
                        flat
                        dense
                        no-caps
                        size="sm"
                        icon="near_me"
                        label="นำทาง"
                        class="map-link-btn"
                        :href="`https://www.google.com/maps/dir/?api=1&destination=${props.row.pickupLat},${props.row.pickupLng}`"
                        target="_blank"
                      />
                      <span v-else class="no-geo-text">
                        <q-icon name="location_off" size="14px" /> ไม่ได้แชร์
                      </span>
                    </dd>
                  </div>
                </dl>

                <!-- A tooltip can't be hovered on a phone, so the member's note is spelled out. -->
                <div v-if="props.row.note" class="request-card-note">
                  <q-icon name="sticky_note_2" size="15px" />
                  <span>{{ props.row.note }}</span>
                </div>

                <div
                  v-if="props.row.status === 'requested' || props.row.status === 'confirmed'"
                  class="request-card-actions"
                >
                  <q-btn
                    v-if="props.row.status === 'requested'"
                    unelevated
                    no-caps
                    icon="how_to_reg"
                    label="รับเรื่อง"
                    class="card-btn act-btn--accept"
                    :loading="actingId === props.row.id"
                    @click.stop="confirmRequest(props.row as CommitteeSellRequest)"
                  />
                  <q-btn
                    v-if="props.row.status === 'confirmed'"
                    unelevated
                    no-caps
                    icon="scale"
                    label="บันทึกรับซื้อ"
                    class="card-btn act-btn--record"
                    @click.stop="goDetail((props.row as CommitteeSellRequest).id)"
                  />
                  <q-btn
                    unelevated
                    no-caps
                    icon="close"
                    label="ยกเลิก"
                    class="card-btn act-btn--cancel"
                    @click.stop="promptCancel(props.row as CommitteeSellRequest)"
                  />
                </div>
              </article>
            </div>
          </template>
          <template #body-cell-member="props">
            <q-td :props="props">
              <div class="member-cell">
                <div class="member-name">
                  {{ props.row.member.prefix ?? '' }}{{ props.row.member.firstName }} {{ props.row.member.lastName }}
                  <!-- The member asked for something in particular - worth
                       seeing before the request is even opened. -->
                  <q-icon v-if="props.row.note" name="sticky_note_2" class="note-flag">
                    <q-tooltip>หมายเหตุ: {{ props.row.note }}</q-tooltip>
                  </q-icon>
                </div>
                <div class="member-sub">รหัส {{ props.row.member.memberCode }} · {{ props.row.member.phone }}</div>
              </div>
            </q-td>
          </template>

          <template #body-cell-estimatedValue="props">
            <q-td :props="props">
              <span v-if="estimatedValue(props.row) !== null" class="value-cell">
                {{ estimatedValue(props.row)!.toLocaleString() }}
              </span>
              <span v-else class="text-grey-6">-</span>
            </q-td>
          </template>

          <template #body-cell-location="props">
            <q-td :props="props" @click.stop>
              <q-btn
                v-if="props.row.pickupLat !== null && props.row.pickupLng !== null"
                flat
                dense
                no-caps
                size="sm"
                icon="near_me"
                label="นำทาง"
                class="map-link-btn"
                :href="`https://www.google.com/maps/dir/?api=1&destination=${props.row.pickupLat},${props.row.pickupLng}`"
                target="_blank"
              >
                <q-tooltip>เปิดเส้นทางไปหาสมาชิกด้วย Google Maps</q-tooltip>
              </q-btn>
              <span v-else class="no-geo-text">
                <q-icon name="location_off" size="14px" /> ไม่ได้แชร์
              </span>
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge class="status-chip" :class="statusMeta(props.row.status).cls">
                <q-icon :name="statusMeta(props.row.status).icon" size="12px" class="q-mr-xs" />
                {{ statusMeta(props.row.status).label }}
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" @click.stop>
              <!-- Fixed slots (main action / view / cancel) so the buttons line up
                   down the column whichever ones a row has. -->
              <div class="action-btns">
                <q-btn
                  v-if="props.row.status === 'requested'"
                  unelevated dense no-caps icon="how_to_reg" label="รับเรื่อง"
                  class="row-btn slot-main act-btn--accept"
                  :loading="actingId === props.row.id"
                  @click="confirmRequest(props.row as CommitteeSellRequest)"
                >
                  <q-tooltip>รับเรื่อง (กำลังไปรับ)</q-tooltip>
                </q-btn>
                <!-- Only after the request has been accepted: the purchase form
                     itself is gated the same way on the detail page. -->
                <q-btn
                  v-if="props.row.status === 'confirmed'"
                  unelevated dense no-caps icon="scale" label="บันทึกรับซื้อ"
                  class="row-btn slot-main act-btn--record"
                  @click="goDetail((props.row as CommitteeSellRequest).id)"
                >
                  <q-tooltip>บันทึกรับซื้อจริง</q-tooltip>
                </q-btn>
                <q-btn
                  unelevated dense icon="visibility"
                  class="row-icon-btn slot-view act-btn--view"
                  aria-label="ดูรายละเอียด"
                  @click="goDetail((props.row as CommitteeSellRequest).id)"
                >
                  <q-tooltip>ดูรายละเอียด</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="props.row.status === 'requested' || props.row.status === 'confirmed'"
                  unelevated dense icon="close"
                  class="row-icon-btn slot-cancel act-btn--cancel"
                  aria-label="ยกเลิกคำร้อง"
                  @click="promptCancel(props.row as CommitteeSellRequest)"
                >
                  <q-tooltip>ยกเลิกคำร้อง</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="inbox" size="32px" />
              ไม่พบคำร้องขายขยะ{{ statusFilter ? 'ในสถานะนี้' : '' }}
            </div>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableProps } from 'quasar';
import {
  useCommitteeRequestStore,
  type CommitteeSellRequest,
} from 'src/stores/committeeRequestStore';
import { useCommitteeRoundStore } from 'src/stores/committeeRoundStore';
import { apiErrorMessage } from 'src/utils/apiError';
import { sellRequestStatusMeta as statusMeta } from 'src/utils/sellRequestStatus';
import { formatShortDate as formatDate } from 'src/utils/format';
import {
  MidFilterBar,
  midOptionLabel,
  midNotify,
  midPrompt,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const store = useCommitteeRequestStore();
const roundStore = useCommitteeRoundStore();

const search = ref('');
// Opens on the requests still waiting to be accepted - that is the committee's
// actual queue for a round. Clearing the status shows every request.
const statusFilter = ref<string | null>('requested');
const actingId = ref<number | null>(null);
const isPhone = computed(() => $q.screen.lt.sm);

// Server-side pagination, same pattern as CommitteeMembersPage.
const pagination = useRememberedPagination('committee-sell-requests', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
});

const rows = computed(() => store.requests.data?.items ?? []);

const statusOptions = [
  { label: 'รอรับเรื่อง', value: 'requested' },
  { label: 'กำลังไปรับ', value: 'confirmed' },
  { label: 'รับซื้อแล้ว', value: 'completed' },
  { label: 'ยกเลิก', value: 'cancelled' },
];

// The default 'รอรับเรื่อง' still shows as a chip: it hides most of a finished
// round, so the committee should always see that the list is narrowed.
const activeFilters = computed<MidActiveFilter[]>(() =>
  statusFilter.value
    ? [{ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, statusFilter.value) }]
    : [],
);

const summaryCards = [
  { key: 'total', label: 'คำร้องทั้งหมด', icon: 'assignment', iconCls: 'icon-green' },
  { key: 'requested', label: 'รอรับเรื่อง', icon: 'hourglass_top', iconCls: 'icon-amber' },
  { key: 'confirmed', label: 'กำลังไปรับ', icon: 'local_shipping', iconCls: 'icon-blue' },
  { key: 'completed', label: 'รับซื้อแล้ว', icon: 'task_alt', iconCls: 'icon-green' },
];

const columns: QTableProps['columns'] = [
  { name: 'member', align: 'left', label: 'สมาชิก', field: (row: CommitteeSellRequest) => row.member.firstName },
  {
    name: 'requestDate',
    align: 'left',
    label: 'วันที่แจ้ง',
    field: (row: CommitteeSellRequest) => formatDate(row.requestDate),
  },
  {
    name: 'round',
    align: 'left',
    label: 'รอบรับซื้อ',
    field: (row: CommitteeSellRequest) =>
      `${formatDate(row.round.roundDate)} · ${row.round.startTime}-${row.round.endTime} น.`,
  },
  {
    name: 'estimatedQuantity',
    align: 'center',
    label: 'รวม (กก.)',
    field: 'estimatedQuantity',
  },
  {
    name: 'estimatedValue',
    align: 'center',
    label: 'มูลค่าประมาณ (บาท)',
    field: () => '',
  },
  { name: 'location', align: 'center', label: 'ตำแหน่ง', field: () => '' },
  { name: 'status', align: 'center', label: 'สถานะ', field: 'status' },
  { name: 'actions', align: 'right', label: 'จัดการ', field: () => '' },
];

// --- The round being worked on ----------------------------------------------------
// Comes from the path (/committee/sell-requests/round/:roundId), never from a
// picker on this page: requests are always read one round at a time, entered
// through CommitteeRoundTimelinePage.

// Computed, not read once: vue-router reuses this component when only the param
// changes, so a round-to-round navigation has to re-read the id.
const roundId = computed(() => Number(route.params.roundId));
// `note` is the round's "จุดนัดหมาย / หมายเหตุ" - the same note members see on the round.
const roundInfo = ref<{ date: string; time: string; buyer: string; note: string } | null>(null);
// Shown in place of the buyer name while the round is loading or can't be found.
const roundMessage = ref('กำลังโหลด...');

// Only the id is in the URL, so the round list is fetched once to fill the hero.
async function loadRoundLabel() {
  roundInfo.value = null;
  roundMessage.value = 'กำลังโหลด...';
  try {
    const data = await roundStore.fetchRounds({ scope: 'all' });
    const round = data.items.find((item) => item.id === roundId.value);
    if (!round) {
      roundMessage.value = 'ไม่พบรอบนี้';
      return;
    }
    roundInfo.value = {
      date: formatDate(round.roundDate),
      time: `${round.startTime}-${round.endTime} น.`,
      buyer: round.buyer.buyerName,
      note: round.locationNote ?? '',
    };
  } catch {
    roundMessage.value = '-';
  }
}

function refreshSummary() {
  void store.fetchSummary(roundId.value);
}

// Estimated value = declared quantity x the waste type's current default
// price. Old requests created before per-type items existed have no items -
// show '-' for those.
function estimatedValue(request: CommitteeSellRequest): number | null {
  if (!request.items.length) return null;
  const total = request.items.reduce(
    (sum, item) => sum + item.estimatedQuantity * item.wasteType.defaultPrice,
    0,
  );
  return Math.round(total * 100) / 100;
}

async function loadRequests() {
  const applied = await store.fetchRequests({
    page: pagination.value.page,
    pageSize: pagination.value.rowsPerPage,
    status: statusFilter.value ?? undefined,
    search: search.value?.trim() || undefined,
    roundId: roundId.value,
  });
  if (applied) {
    pagination.value.rowsNumber = store.requests.data?.total ?? 0;
  }
}

function reload(toPage?: number) {
  if (toPage) pagination.value.page = toPage;
  void loadRequests();
}

function onTableRequest(props: { pagination: { page: number; rowsPerPage: number } }) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  void loadRequests();
}

function setStatus(value: string | null) {
  statusFilter.value = value;
  reload(1);
}

function goDetail(requestId: number) {
  void router.push(`/committee/sell-requests/${requestId}`);
}

async function confirmRequest(request: CommitteeSellRequest) {
  actingId.value = request.id;
  try {
    await store.confirmRequest(request.id);
    midNotify({ type: 'success', message: 'รับเรื่องคำร้องแล้ว สถานะเปลี่ยนเป็น "กำลังไปรับ"' });
    reload();
    refreshSummary();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'รับเรื่องไม่สำเร็จ กรุณาลองใหม่') });
  } finally {
    actingId.value = null;
  }
}

async function promptCancel(request: CommitteeSellRequest) {
  const note = await midPrompt({
    title: 'ยกเลิกคำร้องขายขยะ',
    message: `ยกเลิกคำร้องของ ${request.member.firstName} ${request.member.lastName}?`,
    inputLabel: 'เหตุผล (ไม่บังคับ)',
    tone: 'danger',
    cancelLabel: 'กลับ',
    confirmLabel: 'ยืนยันยกเลิกคำร้อง',
  });
  if (note === null) return;
  try {
    await store.cancelRequest(request.id, note || undefined);
    midNotify({ type: 'success', message: 'ยกเลิกคำร้องแล้ว' });
    reload();
    refreshSummary();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ยกเลิกคำร้องไม่สำเร็จ') });
  }
}

function loadRound() {
  // A hand-typed or stale round id just yields an empty list; send them back to
  // the picker instead of showing an empty page with no way forward.
  if (!Number.isInteger(roundId.value) || roundId.value <= 0) {
    void router.replace('/committee/sell-requests');
    return;
  }

  void loadRoundLabel();
  reload(1);
  refreshSummary();
}

watch(roundId, loadRound);
onMounted(loadRound);
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.requests-shell {
  width: min(1280px, 100%);
}

// Title + buyer beside the icon, the round's date/time/note as pills underneath,
// and the back button on the right - or, on a phone, full width at the bottom.
.round-hero {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'icon copy action'
    '.    meta action';
  align-items: center;
  column-gap: 18px;
  row-gap: 14px;
}

.round-hero .hero-icon {
  grid-area: icon;
}

.round-hero .hero-copy {
  grid-area: copy;
}

.hero-copy .hero-buyer {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.hero-meta {
  grid-area: meta;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
}

// A long note wraps inside the pill, so it gets softer corners than a full pill.
.hero-chip--note {
  align-items: flex-start;
  max-width: 100%;
  border-radius: 12px;
  overflow-wrap: anywhere;
}

.hero-chip--note .q-icon {
  margin-top: 2px;
}

.round-hero .hero-link-btn {
  grid-area: action;
}

@media (max-width: 599px) {
  .round-hero {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'icon copy'
      'meta meta'
      'action action';
    column-gap: 14px;
  }

  .round-hero .hero-icon {
    width: 50px;
    height: 50px;
    min-width: 50px;
    border-radius: 14px;
    font-size: 26px;
  }

  .round-hero .hero-link-btn {
    width: 100%;
  }
}

.summary-grid {
  margin-top: 20px;
}

.panel-card--flush .panel-head {
  padding: 22px 26px 0;
}

.hero-link-btn {
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  padding: 4px 18px;
  font-weight: 700;
  transition: background 0.2s ease;
}

.hero-link-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.filter-row {
  padding: 14px 26px;
}

.requests-table :deep(tbody tr) {
  cursor: pointer;
}

.member-cell .member-name {
  color: #16352a;
  font-weight: 500;
}

.member-cell .note-flag {
  margin-left: 4px;
  color: #c08a1e;
  font-size: 16px;
  vertical-align: -2px;
}

.member-cell .member-sub {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.value-cell {
  color: #0d7a44;
  font-weight: 600;
}

.map-link-btn {
  color: #1565c0;
  font-weight: 700;
}

.no-geo-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #a3aca6;
  font-size: 12px;
  font-weight: 600;
}

.status-chip {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 800;
  white-space: nowrap;
}

.chip-wait { color: #8a5a12; background: #fff4e5; }
.chip-going { color: #1565c0; background: #e3f0fd; }
.chip-done { color: #0d7a44; background: #e9f7ee; }
.chip-off { color: #667066; background: #eef1f0; }

.action-btns {
  display: grid;
  grid-template-columns: 136px 34px 34px;
  justify-content: end;
  align-items: center;
  gap: 6px;
}

.slot-main { grid-column: 1; }
.slot-view { grid-column: 2; }
.slot-cancel { grid-column: 3; }

.row-btn {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.row-icon-btn {
  width: 34px;
  min-width: 34px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 10px;
  font-size: 12px;
}

// Action colours, shared by the table buttons and the phone cards.
.act-btn--accept {
  color: #ffffff;
  background: #0d7a44;
}

.act-btn--record {
  color: #ffffff;
  background: #00796b;
}

.act-btn--view {
  color: #0d7a44;
  background: #e9f7ee;
}

.act-btn--cancel {
  color: #c62828;
  background: #fdecec;
}

// --- Phone cards ----------------------------------------------------------------

.request-card-wrap {
  padding: 6px 16px;
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
  justify-content: space-between;
  gap: 10px;
}

.request-card-title {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}

.request-card-rows dt {
  flex-shrink: 0;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 600;
}

.request-card-rows dd {
  margin: 0;
  color: #18231e;
  font-size: 13.5px;
  font-weight: 700;
  text-align: right;
}

.request-card-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  color: #6b5320;
  background: #fff8e8;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.request-card-note .q-icon {
  margin-top: 2px;
  color: #c08a1e;
}

.request-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.card-btn {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  font-weight: 700;
}

// Phone: the panel's 26px side padding is tighter so the cards keep their width,
// and the header and search line up with the cards' edge.
@media (max-width: 599px) {
  .panel-card--flush .panel-head {
    padding: 20px 16px 0;
  }

  .filter-row {
    padding: 12px 16px;
  }
}
</style>
