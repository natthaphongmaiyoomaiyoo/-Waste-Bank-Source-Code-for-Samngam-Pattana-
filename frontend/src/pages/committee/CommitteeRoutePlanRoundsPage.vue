<template>
  <q-page class="muni-page">
    <div class="muni-shell timeline-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="route" />
          </div>
          <div class="hero-copy">
            <h1>แสดงเส้นทางการรับซื้อ</h1>
          </div>
        </div>
      </section>

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
            v-model="workFilter"
            dense
            outlined
            emit-value
            map-options
            label="จุดบนแผนที่"
            :options="workOptions"
          />
        </MidFilterBar>
      </q-card>

      <div v-if="loading" class="loading-wrap"><q-spinner color="positive" size="42px" /></div>

      <q-banner v-else-if="error" rounded class="error-banner q-mt-lg">
        <template #avatar><q-icon name="error_outline" color="negative" /></template>
        {{ error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="load" />
        </template>
      </q-banner>

      <div v-else class="timeline-layout">
        <!-- One month per page on a rail, newest first - the same reading as the
             sell-request rounds, so the two pickers feel like one flow. -->
        <div class="timeline-col">
          <div v-if="!monthGroups.length" class="panel-card empty-state">
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

                <div class="round-counts">
                  <span
                    class="count-cell count-on-map"
                    :class="{ 'is-zero': onMapCount(round.id) === 0 }"
                  >
                    <span class="count-num">{{ onMapCount(round.id) }}</span>
                    <span class="count-label">บนแผนที่</span>
                  </span>
                  <span
                    class="count-cell count-no-location"
                    :class="{ 'is-zero': noLocationCount(round.id) === 0 }"
                  >
                    <span class="count-num">{{ noLocationCount(round.id) }}</span>
                    <span class="count-label">ไม่มีตำแหน่ง</span>
                  </span>
                </div>
              </button>
            </div>
          </section>

          <div v-if="totalPages > 1" class="pager-row">
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
                <span class="detail-label">จุดบนแผนที่</span>
                <span class="detail-value detail-value--strong">
                  {{ onMapCount(selected.id) }} จุด
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">ไม่มีตำแหน่ง</span>
                <span class="detail-value">{{ noLocationCount(selected.id) }} คำขอ</span>
              </div>
            </div>

            <q-btn
              unelevated
              no-caps
              class="detail-btn"
              icon-right="arrow_forward"
              label="ดูเส้นทางของรอบนี้"
              @click="openRound(selected.id)"
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
import { useRouter } from 'vue-router';
import { api } from 'src/boot/axios';
import { MidFilterBar, midOptionLabel, type MidActiveFilter } from 'components/MID';
import { useAuthStore } from 'src/stores/authStore';
import { useCommitteeRoundStore, type CommitteeRound } from 'src/stores/committeeRoundStore';
import {
  ROUND_STATE_LABELS,
  THAI_MONTH_NAMES,
  roundDisplayState,
  type RoundDisplayState,
} from '../municipality/format';

// Step one of viewing a pickup run: which round? Same timeline as the
// sell-request rounds (/committee/sell-requests), so the two pickers read alike -
// only the numbers on the right differ: here, how many stops the round's run has
// and how many accepted requests can't be on it (no pinned location).

const router = useRouter();
const roundStore = useCommitteeRoundStore();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref<string | null>(null);
const rounds = ref<CommitteeRound[]>([]);
// Per round, this village's requests: on the round's run (routed), and accepted
// but without a pinned location, so off the map (noLocation).
interface RouteCounts {
  roundId: number;
  noLocation: number;
  routed: number;
}
const routeCounts = ref<Map<number, RouteCounts>>(new Map());

const search = ref('');
const workFilter = ref<'all' | 'onMap'>('all');
const page = ref(1);
const selectedId = ref<number | null>(null);
const detailCol = ref<HTMLElement | null>(null);

const workOptions = [
  { label: 'ทุกรอบ', value: 'all' },
  { label: 'เฉพาะรอบที่มีจุดบนแผนที่', value: 'onMap' },
];

const activeFilters = computed<MidActiveFilter[]>(() =>
  workFilter.value === 'all'
    ? []
    : [
        {
          key: 'work',
          label: 'จุดบนแผนที่',
          value: midOptionLabel(workOptions, workFilter.value),
        },
      ],
);

function clearFilter(key: string) {
  if (key === 'work') workFilter.value = 'all';
}

function clearAllFilters() {
  workFilter.value = 'all';
}

function onMapCount(roundId: number): number {
  return routeCounts.value.get(roundId)?.routed ?? 0;
}

function noLocationCount(roundId: number): number {
  return routeCounts.value.get(roundId)?.noLocation ?? 0;
}

// --- Dates --------------------------------------------------------------------
// roundDate is an ISO timestamp whose UTC part IS the calendar date the round
// was saved with, so every label reads the string instead of a local Date - a
// UTC+7 browser would otherwise shift dates across month boundaries.

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
  const [, month, day] = round.roundDate.slice(0, 10).split('-').map(Number);
  return `${day} ${THAI_MONTH_NAMES[(month ?? 1) - 1] ?? ''}`;
}

function fullDateLabel(round: CommitteeRound): string {
  return `${dayMonthLabel(round)} ${buddhistYear(round)}`;
}

function roundState(round: CommitteeRound): { key: RoundDisplayState; label: string; cls: string } {
  const key = roundDisplayState(round);
  return { key, label: ROUND_STATE_LABELS[key], cls: `state-${key}` };
}

// Running number within its own Buddhist year ("7/2569"), counted from the
// unfiltered list so a round keeps its number as filters are applied.
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
      .sort((a, b) => a.roundDate.localeCompare(b.roundDate))
      .forEach((round, index) => labels.set(round.id, `${index + 1}/${year}`));
  }
  return labels;
});

function sequenceOf(round: CommitteeRound): string {
  return sequenceById.value.get(round.id) ?? '-';
}

function openRound(roundId: number) {
  void router.push(`/committee/route-plan/round/${roundId}`);
}

// Single column: pick a round first, read it second - scroll the detail into
// view so the plan button is never a scroll away.
function selectRound(roundId: number) {
  selectedId.value = roundId;
  if (!window.matchMedia('(max-width: 1080px)').matches) return;
  void nextTick(() => {
    detailCol.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// --- Filtering + one month per page -------------------------------------------

function matchesSearch(round: CommitteeRound, needle: string): boolean {
  return [
    dayMonthLabel(round),
    String(buddhistYear(round)),
    sequenceOf(round),
    round.startTime,
    round.endTime,
    round.buyer.buyerName,
    round.locationNote ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

const visibleRounds = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return rounds.value.filter((round) => {
    if (workFilter.value === 'onMap' && onMapCount(round.id) === 0) return false;
    return !needle || matchesSearch(round, needle);
  });
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

const totalPages = computed(() => Math.max(allMonthGroups.value.length, 1));

// One month on screen at a time; an older month is a page back, not a long
// scroll. A month is never split across pages.
const monthGroups = computed(() => allMonthGroups.value.slice(page.value - 1, page.value));

const pagedRounds = computed(() => monthGroups.value.flatMap((group) => group.rounds));

const selected = computed(
  () => pagedRounds.value.find((round) => round.id === selectedId.value) ?? null,
);

// Filters change what the pages hold - start over from the newest month.
watch([search, workFilter], () => {
  page.value = 1;
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [roundData, countData] = await Promise.all([
      roundStore.fetchRounds({ scope: 'all' }),
      // Counted per round by the server, so no round is undercounted however
      // many requests are waiting.
      api.get<RouteCounts[]>('/committee/sell-requests/route-counts'),
    ]);

    const counts = new Map(countData.data.map((row) => [row.roundId, row]));
    routeCounts.value = counts;

    // Own village only. The endpoint also returns the municipality-wide rounds
    // (villageArea = null) that any village may book - those are kept only while
    // they actually hold requests from this village, so another village's pickup
    // point never shows up here. Cancelled rounds can never receive a run.
    const myVillageId = authStore.myVillage?.id ?? null;
    rounds.value = roundData.items
      .filter(
        (round) =>
          round.status !== 'cancelled' &&
          (round.villageArea?.id === myVillageId || counts.has(round.id)),
      )
      // Newest first, so page 1 is the month being worked on now.
      .sort((a, b) => {
        const byDate = b.roundDate.localeCompare(a.roundDate);
        return byDate !== 0 ? byDate : b.startTime.localeCompare(a.startTime);
      });
    page.value = 1;
    // Open on the newest round that has a run to look at.
    selectedId.value = rounds.value.find((round) => onMapCount(round.id) > 0)?.id ?? null;
  } catch {
    error.value = 'ไม่สามารถโหลดรอบรับซื้อได้ กรุณาลองใหม่อีกครั้ง';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.timeline-shell {
  width: min(1180px, 100%);
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

.timeline-col .empty-state {
  padding: 56px 0;
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

// This village's requests in the round: stops on the round's run (green) beside
// accepted requests that can't be on it for want of a pinned location (amber).
.round-counts {
  display: flex;
  gap: 8px;
}

.count-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 78px;
  padding: 6px 10px;
  border-radius: 10px;
}

.count-num {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}

.count-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.count-on-map {
  color: #0d7a44;
  background: #e9f7ee;
}

.count-no-location {
  color: #b45309;
  background: #fff4e5;
}

.count-cell.is-zero {
  color: #98a19d;
  background: #f3f6f4;
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

// --- Detail panel ------------------------------------------------------------------

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

// --- Responsive -------------------------------------------------------------------

@media (max-width: 1080px) {
  .timeline-layout {
    grid-template-columns: minmax(0, 1fr);
  }

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

  // Date | chip on top, then the buyer, then the two counts as a full-width
  // strip - side by side they would squeeze the buyer name on a phone.
  .round-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }

  .round-row > .state-chip {
    justify-self: end;
  }

  .round-buyer,
  .round-counts {
    grid-column: 1 / -1;
  }

  .round-counts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-top: 10px;
    border-top: 1px dashed #e4ebe5;
  }

  // Label left, number right (DOM keeps number first for the desktop stack).
  .count-cell {
    flex-direction: row-reverse;
    justify-content: space-between;
    min-width: 0;
    padding: 7px 12px;
  }

  .count-num {
    font-size: 16px;
  }

  .count-label {
    font-size: 12px;
  }
}

@media (max-width: 599px) {
  .muni-hero {
    padding: 18px;
  }

  .hero-row {
    gap: 12px;
  }

  .hero-icon {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 13px;
    font-size: 23px;
  }

  .hero-copy h1 {
    font-size: 18.5px;
    line-height: 1.3;
  }

  .toolbar-card {
    padding: 12px 14px;
  }
}
</style>
