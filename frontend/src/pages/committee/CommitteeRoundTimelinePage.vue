<template>
  <q-page class="muni-page">
    <div class="muni-shell timeline-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="assignment" />
          </div>
          <div class="hero-copy">
            <h1>คำขอขายขยะ</h1>
          </div>
          <q-btn
            flat
            no-caps
            icon="event_available"
            label="จัดการรอบรับซื้อ"
            class="hero-link-btn"
            to="/committee/rounds"
          />
        </div>
      </section>

      <!-- Filters -->
      <q-card flat class="panel-card toolbar-card q-mt-lg">
        <MidFilterBar
          v-model:search="search"
          search-label="ค้นหาวันที่ / ผู้รับซื้อ / จุดนัดหมาย"
          :search-debounce="300"
          title="กรองรอบรับซื้อ"
          :active="activeFilters"
          @clear="clearFilter"
          @clear-all="clearAllFilters"
        >
          <q-select
            v-model="period"
            dense
            outlined
            emit-value
            map-options
            label="ช่วงเวลา"
            :options="periodOptions"
          />
          <q-select
            v-model="stateFilter"
            dense
            outlined
            emit-value
            map-options
            label="สถานะรอบ"
            :options="stateOptions"
          />
        </MidFilterBar>
      </q-card>

      <div v-if="loading" class="loading-wrap"><q-spinner color="positive" size="42px" /></div>

      <q-banner v-else-if="error" rounded class="error-banner">
        <template #avatar><q-icon name="error_outline" color="negative" /></template>
        {{ error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadRounds" />
        </template>
      </q-banner>

      <div v-else class="timeline-layout">
        <!-- Timeline, grouped by month -->
        <div class="timeline-col">
          <div v-if="!visibleRounds.length" class="panel-card empty-state">
            <q-icon name="event_busy" size="32px" />
            ไม่พบรอบรับซื้อตามเงื่อนไขที่เลือก
          </div>

          <section v-for="group in monthGroups" :key="group.key" class="month-group">
            <div class="month-label">
              <span class="month-name">{{ group.label }}</span>
              <span class="month-count">{{ group.rounds.length }} รอบ</span>
            </div>

            <div class="month-rounds">
              <button
                v-for="round in group.rounds"
                :key="round.id"
                type="button"
                class="round-row"
                :class="{ 'is-active': selectedId === round.id }"
                @click="selectRound(round.id)"
              >
                <span class="rail-dot" :class="roundState(round).cls"></span>

                <div class="round-main">
                  <div class="round-day">{{ dayMonthLabel(round) }}</div>
                  <div class="round-seq">
                    รอบที่ {{ sequenceOf(round) }} · {{ round.startTime }}-{{ round.endTime }} น.
                  </div>
                </div>

                <span class="state-chip" :class="roundState(round).cls">
                  {{ roundState(round).label }}
                </span>

                <div class="round-buyer">{{ round.buyer.buyerName }}</div>

                <div class="round-count" :class="{ 'is-empty': requestCount(round) === 0 }">
                  {{ requestCount(round) }} คำขอ
                </div>
              </button>
            </div>
          </section>

          <div v-if="visibleRounds.length" class="pager-row">
            <q-pagination
              v-model="page"
              :max="totalPages"
              :max-pages="5"
              boundary-numbers
              direction-links
              flat
              color="grey-7"
              active-color="positive"
              class="pager"
            />
          </div>
        </div>

        <!-- Sticky detail of the selected round (below the timeline on mobile) -->
        <aside ref="detailCol" class="detail-col">
          <div v-if="selected" class="detail-card">
            <div class="detail-eyebrow">รอบที่เลือก</div>
            <div class="detail-seq">รอบที่ {{ sequenceOf(selected) }}</div>
            <h2 class="detail-date">{{ fullDateLabel(selected) }}</h2>

            <div class="detail-rows">
              <div class="detail-row">
                <span class="detail-label">สถานะ</span>
                <span class="state-chip" :class="roundState(selected).cls">
                  {{ roundState(selected).label }}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">ช่วงเวลา</span>
                <span class="detail-value">{{ selected.startTime }}-{{ selected.endTime }} น.</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">ผู้รับซื้อ</span>
                <span class="detail-value">{{ selected.buyer.buyerName }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">จุดนัดหมาย / หมายเหตุ</span>
                <span class="detail-value">{{ selected.locationNote || '-' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">พื้นที่</span>
                <span class="detail-value">{{ areaLabel(selected) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">คำร้องในรอบ</span>
                <span class="detail-value detail-value--strong"
                  >{{ requestCount(selected) }} คำร้อง</span
                >
              </div>
            </div>

            <q-btn
              unelevated
              no-caps
              class="detail-btn"
              icon-right="arrow_forward"
              label="เปิดคำร้องของรอบนี้"
              @click="openRequests(selected.id)"
            />
          </div>

          <div v-else class="detail-card detail-card--empty">
            <q-icon name="ads_click" size="28px" />
            เลือกรอบจากไทม์ไลน์เพื่อดูรายละเอียด
          </div>
        </aside>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCommitteeRoundStore, type CommitteeRound } from 'src/stores/committeeRoundStore';
import { apiErrorMessage } from 'src/utils/apiError';
import { MidFilterBar, midOptionLabel, type MidActiveFilter } from 'components/MID';
import {
  ROUND_STATE_LABELS,
  THAI_MONTH_NAMES,
  roundDisplayState,
  type RoundDisplayState,
} from '../municipality/format';

// Entry point for "คำร้องขอขายขยะ": every buying round the committee can see,
// newest month first, with a sticky panel that opens that round's sell requests
// (/committee/sell-requests/round/<id>). Requests are only ever read one round
// at a time, so this picker is the only way into the list.

const route = useRoute();
const router = useRouter();
const roundStore = useCommitteeRoundStore();

const rounds = ref<CommitteeRound[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const search = ref('');
const period = ref<'all' | '3m' | '6m' | 'year'>('all');
const stateFilter = ref<'all' | RoundDisplayState>('all');
const selectedId = ref<number | null>(null);

const periodOptions = [
  { label: 'ทุกช่วงเวลา', value: 'all' },
  { label: '3 เดือนล่าสุด', value: '3m' },
  { label: '6 เดือนล่าสุด', value: '6m' },
  { label: 'ปีนี้', value: 'year' },
];

const stateOptions = [
  { label: 'ทุกสถานะ', value: 'all' },
  ...(['open', 'ended', 'completed', 'cancelled'] as const).map((state) => ({
    label: ROUND_STATE_LABELS[state],
    value: state,
  })),
];

// Both selects default to an "all" entry rather than null, so that value is
// what counts as "not filtering".
const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (period.value !== 'all') {
    items.push({ key: 'period', label: 'ช่วงเวลา', value: midOptionLabel(periodOptions, period.value) });
  }
  if (stateFilter.value !== 'all') {
    items.push({ key: 'state', label: 'สถานะรอบ', value: midOptionLabel(stateOptions, stateFilter.value) });
  }
  return items;
});

function clearFilter(key: string) {
  if (key === 'period') period.value = 'all';
  if (key === 'state') stateFilter.value = 'all';
}

function clearAllFilters() {
  period.value = 'all';
  stateFilter.value = 'all';
}

// --- Dates ---------------------------------------------------------------------
// roundDate arrives as an ISO timestamp whose UTC part IS the calendar date the
// round was saved with, so every label reads the string instead of a local Date -
// otherwise a UTC+7 browser would shift dates across month boundaries.

function isoDate(round: CommitteeRound): string {
  return round.roundDate.slice(0, 10);
}

function monthKey(round: CommitteeRound): string {
  return round.roundDate.slice(0, 7);
}

function buddhistYear(round: CommitteeRound): number {
  return Number(round.roundDate.slice(0, 4)) + 543;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${THAI_MONTH_NAMES[(month ?? 1) - 1] ?? ''} ${(year ?? 0) + 543}`;
}

function dayMonthLabel(round: CommitteeRound): string {
  const [, month, day] = isoDate(round).split('-').map(Number);
  return `${day} ${THAI_MONTH_NAMES[(month ?? 1) - 1] ?? ''}`;
}

function fullDateLabel(round: CommitteeRound): string {
  return `${dayMonthLabel(round)} ${buddhistYear(round)}`;
}

// Newest first; time breaks the tie when a day holds several rounds.
function byNewest(a: CommitteeRound, b: CommitteeRound): number {
  const byDate = b.roundDate.localeCompare(a.roundDate);
  return byDate !== 0 ? byDate : b.startTime.localeCompare(a.startTime);
}

// --- Round state ----------------------------------------------------------------
// Same rule as CommitteeRoundsPage - both call roundDisplayState(), so "เปิดรับ"
// means the same thing on both screens: still planned AND its own time window has
// not closed yet. A planned round whose window has passed is "เลยกำหนด" - not
// cancelled, just overdue, and usually still has pickups to settle.

function roundState(round: CommitteeRound): { key: RoundDisplayState; label: string; cls: string } {
  const key = roundDisplayState(round);
  return { key, label: ROUND_STATE_LABELS[key], cls: `state-${key}` };
}

function requestCount(round: CommitteeRound): number {
  return round._count?.saleRequests ?? 0;
}

function areaLabel(round: CommitteeRound): string {
  if (!round.villageArea) return 'รอบกลางของเทศบาล';
  const { villageName, moo } = round.villageArea;
  return moo ? `${villageName} หมู่ ${moo}` : villageName;
}

// Running number within its own Buddhist year ("7/2569"), counted from the
// unfiltered list so the number of a round never changes as filters are applied.
const sequenceById = computed(() => {
  const byYear = new Map<number, CommitteeRound[]>();
  for (const round of rounds.value) {
    const year = buddhistYear(round);
    const list = byYear.get(year);
    if (list) list.push(round);
    else byYear.set(year, [round]);
  }

  const labels = new Map<number, string>();
  for (const [year, list] of byYear) {
    [...list]
      .sort((a, b) => byNewest(b, a))
      .forEach((round, index) => labels.set(round.id, `${index + 1}/${year}`));
  }
  return labels;
});

function sequenceOf(round: CommitteeRound): string {
  return sequenceById.value.get(round.id) ?? '-';
}

// --- Filtering ------------------------------------------------------------------

function periodCutoff(): string | null {
  const now = new Date();
  if (period.value === 'year') return `${now.getFullYear()}-01-01`;
  if (period.value === '3m' || period.value === '6m') {
    const months = period.value === '3m' ? 3 : 6;
    const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return null;
}

function matchesSearch(round: CommitteeRound, needle: string): boolean {
  const haystack = [
    dayMonthLabel(round),
    String(buddhistYear(round)),
    sequenceOf(round),
    round.startTime,
    round.endTime,
    round.buyer.buyerName,
    round.locationNote ?? '',
    areaLabel(round),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

const visibleRounds = computed(() => {
  const needle = search.value?.trim().toLowerCase() ?? '';
  const cutoff = periodCutoff();

  return rounds.value
    .filter((round) => {
      if (cutoff && isoDate(round) < cutoff) return false;
      if (stateFilter.value !== 'all' && roundState(round).key !== stateFilter.value) return false;
      return !needle || matchesSearch(round, needle);
    })
    .sort(byNewest);
});

const allMonthGroups = computed(() => {
  const groups: { key: string; label: string; rounds: CommitteeRound[] }[] = [];
  for (const round of visibleRounds.value) {
    const key = monthKey(round);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rounds.push(round);
    else groups.push({ key, label: monthLabel(key), rounds: [round] });
  }
  return groups;
});

// --- Paging by month --------------------------------------------------------------
// One month on screen at a time; older months are a page back rather than a
// long scroll. A month is never split across pages.

const MONTHS_PER_PAGE = 1;

const page = ref(1);

const totalPages = computed(() =>
  Math.max(Math.ceil(allMonthGroups.value.length / MONTHS_PER_PAGE), 1),
);

const monthGroups = computed(() =>
  allMonthGroups.value.slice((page.value - 1) * MONTHS_PER_PAGE, page.value * MONTHS_PER_PAGE),
);

const pagedRounds = computed(() => monthGroups.value.flatMap((group) => group.rounds));

// Filters change what the pages contain - start over from the newest month.
watch([search, period, stateFilter], () => {
  page.value = 1;
});

function goToPageOf(roundId: number) {
  const index = allMonthGroups.value.findIndex((group) =>
    group.rounds.some((round) => round.id === roundId),
  );
  if (index >= 0) page.value = Math.floor(index / MONTHS_PER_PAGE) + 1;
}

const selected = computed(
  () => pagedRounds.value.find((round) => round.id === selectedId.value) ?? null,
);

// Keep a round selected at all times: when a page turn or a filter drops the
// current pick, fall back to the newest round on screen.
watch(pagedRounds, (list) => {
  if (!list.length) {
    selectedId.value = null;
    return;
  }
  if (!list.some((round) => round.id === selectedId.value)) {
    selectedId.value = list[0]!.id;
  }
});

const detailCol = ref<HTMLElement | null>(null);

// One column below 1080px: the detail sits under the timeline, so bring it into
// view on pick - otherwise choosing a round means scrolling down to find it and
// back down again for the confirm button. Matches the CSS breakpoint exactly.
function selectRound(roundId: number) {
  selectedId.value = roundId;
  if (!window.matchMedia('(max-width: 1080px)').matches) return;
  void nextTick(() => {
    detailCol.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function openRequests(roundId: number) {
  void router.push(`/committee/sell-requests/round/${roundId}`);
}

async function loadRounds() {
  loading.value = true;
  error.value = null;
  try {
    const data = await roundStore.fetchRounds({ scope: 'all' });
    rounds.value = data.items;
    page.value = 1;

    // ?round=<id> - coming back from that round's request list; otherwise start
    // on the newest round. An older round also turns the page to where it sits.
    const requested = Number(route.query.round);
    const preselect =
      Number.isInteger(requested) && data.items.some((round) => round.id === requested);
    selectedId.value = preselect ? requested : ([...data.items].sort(byNewest)[0]?.id ?? null);
    if (preselect) goToPageOf(requested);
  } catch (err) {
    error.value = apiErrorMessage(err, 'ไม่สามารถโหลดรอบรับซื้อได้ กรุณาลองใหม่');
    rounds.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadRounds);
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.timeline-shell {
  width: min(1180px, 100%);
}

// The theme's `flex: 1` gives the title a zero basis, so on a phone it shrank to
// one word per line beside the button. Sizing it by its text makes the button
// wrap onto its own line instead.
.hero-copy {
  flex-basis: auto;
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

// --- Toolbar ---------------------------------------------------------------------

.toolbar-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
}

.toolbar-card :deep(.q-field__control) {
  border-radius: 12px;
  background: #fbfdfb;
}

// --- Layout ----------------------------------------------------------------------

.timeline-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
  margin-top: 20px;
}

.timeline-col {
  display: grid;
  gap: 22px;
  min-width: 0;
}

// --- Month group ------------------------------------------------------------------

.month-group {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 0;
}

.month-label {
  padding-top: 14px;
  padding-right: 16px;
  text-align: right;
}

.month-name {
  display: block;
  color: #16352a;
  font-size: 14.5px;
  font-weight: 700;
}

.month-count {
  display: block;
  margin-top: 2px;
  color: #98a19d;
  font-size: 12px;
  font-weight: 500;
}

// The rail: a hairline the month's rounds hang off, with a dot per round.
.month-rounds {
  display: grid;
  gap: 10px;
  padding-left: 24px;
  border-left: 2px solid #e4ebe5;
}

// --- Round row ---------------------------------------------------------------------

.round-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.2fr) auto;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 18px;
  text-align: left;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(23, 46, 34, 0.04);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.round-row:hover {
  border-color: #b8d8c2;
  transform: translateY(-1px);
}

.round-row.is-active {
  border-color: #17a24f;
  background: #f5fbf7;
  box-shadow: 0 8px 22px rgba(16, 116, 74, 0.12);
}

.rail-dot {
  position: absolute;
  top: 50%;
  left: -31px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border: 2px solid #cbd8cf;
  border-radius: 999px;
  transform: translateY(-50%);
}

.round-row.is-active .rail-dot {
  border-color: #17a24f;
  box-shadow: 0 0 0 4px rgba(23, 162, 79, 0.16);
}

.rail-dot.state-open {
  border-color: #13b84f;
}
.rail-dot.state-ended {
  border-color: #e0a12a;
}
.rail-dot.state-completed {
  border-color: #4a90d9;
}
.rail-dot.state-cancelled {
  border-color: #e53935;
}

.round-day {
  color: #16352a;
  font-size: 15.5px;
  font-weight: 700;
}

.round-seq {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 500;
}

.round-buyer {
  overflow: hidden;
  color: #43514a;
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.round-count {
  color: #0d7a44;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
}
.round-count.is-empty {
  color: #98a19d;
}

.state-chip {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}

.state-open {
  color: #0d7a44;
  background: #e9f7ee;
}
.state-ended {
  color: #8a5a12;
  background: #fff4e5;
}
.state-completed {
  color: #1565c0;
  background: #e3f0fd;
}
.state-cancelled {
  color: #c62828;
  background: #fdecea;
}

// --- Pager ------------------------------------------------------------------------

.pager-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 2px 4px;
}

.pager :deep(.q-btn) {
  font-weight: 700;
}

// --- Detail panel ---------------------------------------------------------------------

.detail-col {
  position: sticky;
  top: 24px;
}

.detail-card {
  padding: 22px 22px 20px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(23, 46, 34, 0.04);
}

.detail-card--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 44px 22px;
  color: #98a19d;
  text-align: center;
  font-size: 13.5px;
  font-weight: 500;
}

.detail-eyebrow {
  color: #98a19d;
  font-size: 12px;
  font-weight: 600;
}

.detail-seq {
  margin-top: 10px;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 600;
}

.detail-date {
  margin: 2px 0 18px;
  color: #0b4f36;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
}

.detail-rows {
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px dashed #e4ebe5;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-label {
  color: #83908a;
  font-size: 12.5px;
  font-weight: 500;
}

.detail-value {
  min-width: 0;
  color: #2c3b33;
  font-size: 13.5px;
  font-weight: 600;
  text-align: right;
}

.detail-value--strong {
  color: #0d7a44;
  font-weight: 700;
}

.detail-btn {
  width: 100%;
  min-height: 44px;
  margin-top: 20px;
  color: #ffffff;
  background: linear-gradient(135deg, #0f9d52, #17c13f);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(23, 193, 63, 0.24);
  font-weight: 700;
}

.detail-note {
  margin-top: 14px;
  color: #98a19d;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.6;
}

.timeline-col .empty-state {
  padding: 56px 0;
}

// --- Responsive -------------------------------------------------------------------

@media (max-width: 1080px) {
  .timeline-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  // Single column: pick a round first, read it second. selectRound() scrolls
  // the detail into view so the confirm button is never a scroll away.
  .detail-col {
    position: static;
  }
}

@media (max-width: 720px) {
  .month-group {
    grid-template-columns: minmax(0, 1fr);
  }

  .month-label {
    padding: 0 0 8px;
    text-align: left;
  }

  .month-rounds {
    padding-left: 18px;
  }

  .rail-dot {
    left: -25px;
  }

  .round-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }

  // Chip and count share the right column, sized per row by the wider of the
  // two; pin both to the right edge so a wide chip doesn't push the count left.
  .round-row > .state-chip,
  .round-count {
    justify-self: end;
  }
}

@media (max-width: 480px) {
  .hero-link-btn {
    width: 100%;
  }
}
</style>
