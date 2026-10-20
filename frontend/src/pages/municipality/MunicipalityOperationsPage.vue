<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="insights" />
          </div>
          <div class="hero-copy">
            <h1>ผลการดำเนินงาน</h1>
          </div>
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="filter-row">
          <MidFilterBar
            v-model:search="search"
            search-label="ค้นหา (เลขที่ใบเสร็จ / ชื่อ / รหัสสมาชิก)"
            title="กรองข้อมูลการดำเนินงาน"
            :active="activeFilters"
            @clear="clearFilter"
            @update:search="applyFilters"
            @clear-all="resetFilters"
          >
            <q-select
              v-model="year"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="ปี (พ.ศ.)"
              :options="yearOptions"
              @update:model-value="onYearChange"
            />
            <q-select
              v-model="month"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="เดือน"
              :options="monthOptions"
              :disable="year === null"
              @update:model-value="applyFilters"
            />
            <MidDateField
              v-model="dateFrom"
              clearable
              label="ตั้งแต่วันที่"
              @update:model-value="applyFilters"
            />
            <MidDateField
              v-model="dateTo"
              clearable
              label="ถึงวันที่"
              @update:model-value="applyFilters"
            />
            <q-select
              v-model="wasteTypeId"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="ประเภทขยะ"
              :options="wasteTypeOptions"
              @update:model-value="applyFilters"
            />
          </MidFilterBar>
        </div>
      </q-card>

      <q-banner v-if="summary.error" rounded class="bg-red-1 text-red-9 error-banner">
        {{ summary.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadSummary" />
        </template>
      </q-banner>

      <div v-else-if="summary.loading && !summary.data" class="loading-wrap">
        <q-spinner-dots size="48px" color="positive" />
      </div>

      <template v-else-if="summary.data">
        <section class="summary-grid ops-grid">
          <article v-for="card in summaryCards" :key="card.label" class="summary-card ops-card">
            <div :class="['summary-icon', card.iconClass]">
              <q-icon :name="card.icon" />
            </div>
            <div class="summary-content">
              <div class="summary-label">{{ card.label }}</div>
              <div class="summary-value ops-value">
                {{ card.value }}
                <span>{{ card.unit }}</span>
              </div>
            </div>
          </article>
        </section>

        <section class="ops-panels">
          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">มูลค่าขายรายเดือน</div>
                <div class="panel-caption">ตามช่วงเวลาที่เลือก (บาท)</div>
              </div>
            </div>
            <apexchart
              v-if="monthlyCategories.length"
              type="bar"
              height="320"
              :options="monthlyOptions"
              :series="monthlySeries"
            />
            <div v-else class="empty-state">
              <q-icon name="bar_chart" size="32px" />
              ไม่มีข้อมูลการขายในช่วงเวลาที่เลือก
            </div>
          </q-card>

          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">แยกตามประเภทขยะ</div>
              </div>
            </div>

            <!-- Ranked list, heaviest first - same shape as the dashboard's top-5
                 card: the bar is the weight, the baht figure sits under it. -->
            <div v-if="wasteRows.length" class="waste-rank">
              <div v-for="row in wasteRows" :key="row.wasteTypeId" class="waste-row">
                <div class="waste-line">
                  <span class="waste-no">{{ row.rank }}</span>
                  <span class="waste-name">{{ row.wasteName }}</span>
                  <span class="waste-qty">{{ formatQuantity(row.quantity) }} {{ row.unit }}</span>
                </div>
                <div class="waste-track">
                  <div class="waste-fill" :style="{ width: row.barWidth }"></div>
                </div>
                <div class="waste-meta">
                  <span>{{ row.shareLabel }}</span>
                  <span class="waste-amount">{{ formatBaht(row.amount) }} บาท</span>
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              <q-icon name="inbox" size="32px" />
              ไม่มีข้อมูล
            </div>
          </q-card>
        </section>
      </template>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">รายการขายขยะ</div>
            <div class="panel-caption">รายการขายสำเร็จตามช่วงเวลาที่เลือก</div>
          </div>
        </div>

        <q-banner v-if="sales.error" rounded class="bg-red-1 text-red-9 q-ma-md">
          {{ sales.error }}
          <template #action>
            <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadSales" />
          </template>
        </q-banner>

        <!-- Always grid mode: each sale is a transaction row (#item) that wraps
             instead of scrolling sideways, while the table keeps doing the
             server-side paging (rows per page, page buttons). -->
        <q-table
          v-else
          flat
          grid
          row-key="id"
          class="muni-table sale-table"
          card-container-class="sale-list"
          :rows="sales.data?.items ?? []"
          :loading="sales.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <!-- Same-day sales share one date tile: only the day's first row
                 draws it, the rest keep its space so the text lines up. -->
            <article
              :class="[
                'sale-txn',
                {
                  'is-same-day': !startsDay(props.pageIndex),
                  'continues-day': continuesDay(props.pageIndex),
                },
              ]"
            >
              <div v-if="startsDay(props.pageIndex)" class="sale-date">
                <span class="sale-day">{{ saleDay(props.row.saleDate) }}</span>
                <span class="sale-month">{{ saleMonth(props.row.saleDate) }}</span>
              </div>
              <div v-else class="sale-date sale-date--blank" aria-hidden="true"></div>

              <div class="sale-body">
                <div class="sale-top">
                  <div class="sale-who">
                    <div class="sale-member">
                      {{ props.row.member ? memberFullName(props.row.member) : 'ไม่ระบุสมาชิก' }}
                    </div>
                    <div class="sale-sub">
                      <template v-if="props.row.member">รหัส {{ props.row.member.memberCode }} · </template>
                      <!-- The receipt number the member holds; the sale number
                           only if a sale somehow has no receipt. -->
                      {{ props.row.receipt?.receiptNo ?? props.row.saleNo }}
                    </div>
                  </div>
                  <div class="sale-money">
                    <div class="sale-total">{{ formatBaht(props.row.totalAmount) }} บาท</div>
                    <template v-if="props.row.fundDeductAmount > 0">
                      <div class="sale-net">หักกองทุน {{ formatBaht(props.row.fundDeductAmount) }}</div>
                      <div class="sale-net">หลังหัก {{ formatBaht(props.row.netAmount) }}</div>
                    </template>
                    <div v-else class="sale-net">ไม่หักกองทุน</div>
                  </div>
                </div>
              </div>
            </article>
          </template>
          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="receipt_long" size="32px" />
              ไม่พบรายการขายตามเงื่อนไขที่เลือก
            </div>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import apexchart from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useMunicipalityStore } from 'src/stores/municipalityStore';
import {
  MidDateField,
  MidFilterBar,
  midOptionLabel,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';
import {
  THAI_MONTH_NAMES,
  THAI_MONTH_SHORT_NAMES,
  formatBaht,
  formatMonthKey,
  formatQuantity,
  formatThaiDate,
  memberFullName,
} from './format';

const store = useMunicipalityStore();
const summary = computed(() => store.operationsSummary);
const sales = computed(() => store.sales);

const year = ref<number | null>(null);
const month = ref<number | null>(null);
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const wasteTypeId = ref<number | null>(null);
// Narrows the whole page (cards, charts and the sale list), like the filters.
const search = ref('');
let filterTimer: number | undefined;

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, index) => {
  const value = currentYear - index;
  // Shown in พ.ศ. only; the value stays ค.ศ. because that is what the API takes.
  return { value, label: String(value + 543) };
});
const monthOptions = THAI_MONTH_NAMES.map((label, index) => ({ value: index + 1, label }));

// Populated from the first (unfiltered) summary load, so the option list stays
// complete even while a waste-type filter narrows the current breakdown.
const wasteTypeOptions = ref<{ value: number; label: string }[]>([]);

const pagination = useRememberedPagination('municipality-sales', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
});

function currentFilters() {
  return {
    year: year.value ?? undefined,
    month: month.value ?? undefined,
    dateFrom: dateFrom.value ?? undefined,
    dateTo: dateTo.value ?? undefined,
    wasteTypeId: wasteTypeId.value ?? undefined,
    search: search.value.trim() || undefined,
  };
}

async function loadSummary() {
  await store.fetchOperationsSummary(currentFilters());
  if (!wasteTypeOptions.value.length && summary.value.data) {
    wasteTypeOptions.value = summary.value.data.byWasteType.map((row) => ({
      value: row.wasteTypeId,
      label: row.wasteName,
    }));
  }
}

async function loadSales() {
  const applied = await store.fetchSales({
    ...currentFilters(),
    page: pagination.value.page,
    pageSize: pagination.value.rowsPerPage,
  });
  if (applied) {
    pagination.value.rowsNumber = sales.value.data?.total ?? 0;
  }
}

function runFilterRequest() {
  pagination.value.page = 1;
  void loadSummary();
  void loadSales();
}

function applyFilters() {
  if (filterTimer) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    filterTimer = undefined;
    runFilterRequest();
  }, 250);
}

function onYearChange() {
  if (year.value === null) month.value = null;
  applyFilters();
}

const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (year.value !== null) {
    items.push({ key: 'year', label: 'ปี', value: midOptionLabel(yearOptions, year.value) });
  }
  if (month.value !== null) {
    items.push({ key: 'month', label: 'เดือน', value: midOptionLabel(monthOptions, month.value) });
  }
  if (dateFrom.value) {
    items.push({ key: 'dateFrom', label: 'ตั้งแต่วันที่', value: formatThaiDate(dateFrom.value) });
  }
  if (dateTo.value) {
    items.push({ key: 'dateTo', label: 'ถึงวันที่', value: formatThaiDate(dateTo.value) });
  }
  if (wasteTypeId.value !== null) {
    items.push({ key: 'wasteType', label: 'ประเภทขยะ', value: midOptionLabel(wasteTypeOptions.value, wasteTypeId.value) });
  }
  return items;
});

function clearFilter(key: string) {
  // เดือน only means something inside a ปี, so dropping the year drops it too
  // (same rule as onYearChange).
  if (key === 'year') {
    year.value = null;
    month.value = null;
  }
  if (key === 'month') month.value = null;
  if (key === 'dateFrom') dateFrom.value = null;
  if (key === 'dateTo') dateTo.value = null;
  if (key === 'wasteType') wasteTypeId.value = null;
  applyFilters();
}

function resetFilters() {
  year.value = null;
  month.value = null;
  dateFrom.value = null;
  dateTo.value = null;
  wasteTypeId.value = null;
  applyFilters();
}

function onTableRequest(props: { pagination: { page: number; rowsPerPage: number } }) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  void loadSales();
}

const summaryCards = computed(() => {
  const data = summary.value.data;
  if (!data) return [];
  return [
    { label: 'ยอดขายรวม', value: formatBaht(data.totalAmount), unit: 'บาท', icon: 'paid', iconClass: 'icon-green' },
    // Each member has one savings account and cannot withdraw from it, so the
    // automatic top-up to the minimum and the extra a member chose to keep are
    // one and the same money: what the period's sales put into the fund.
    {
      label: 'เงินกองทุน',
      value: formatBaht(data.totalFundDeduct + data.totalMemberDeposit),
      unit: 'บาท',
      icon: 'savings',
      iconClass: 'icon-green',
    },
    { label: 'ปริมาณขยะ', value: formatQuantity(data.totalQuantity), unit: 'กก.', icon: 'scale', iconClass: 'icon-amber' },
    { label: 'ขายสำเร็จ', value: data.completedSaleCount.toLocaleString(), unit: 'ครั้ง', icon: 'task_alt', iconClass: 'icon-blue' },
    { label: 'สมาชิกร่วมขาย', value: data.memberParticipatedCount.toLocaleString(), unit: 'คน', icon: 'group', iconClass: 'icon-green' },
  ];
});

const monthlyCategories = computed(
  () => summary.value.data?.monthlySeries.map((point) => formatMonthKey(point.month)) ?? [],
);

const monthlySeries = computed(() => [
  {
    name: 'มูลค่าขาย (บาท)',
    data: summary.value.data?.monthlySeries.map((point) => point.totalAmount) ?? [],
  },
]);

const monthlyOptions = computed<ApexOptions>(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  // Figures sit above each bar in dark ink: white text inside the green bar was
  // hard to read and got clipped once the bars narrowed on a phone.
  plotOptions: { bar: { borderRadius: 4, columnWidth: '45%', dataLabels: { position: 'top' } } },
  colors: ['#21BA45'],
  dataLabels: {
    enabled: true,
    formatter: (value: number) => formatBaht(value),
    offsetY: -18,
    style: { fontSize: '11px', fontWeight: 700, colors: ['#16352a'] },
  },
  xaxis: { categories: monthlyCategories.value },
  yaxis: { labels: { formatter: (value: number) => formatBaht(value) } },
  tooltip: { y: { formatter: (value: number) => `${formatBaht(value)} บาท` } },
}));

// --- Waste-type breakdown ---
// The backend sends the types heaviest first. Shares and bar lengths are taken
// within one unit, so a type sold by the piece is never measured against kg.
const wasteRows = computed(() => {
  const rows = summary.value.data?.byWasteType ?? [];
  const totalByUnit = new Map<string, number>();
  const maxByUnit = new Map<string, number>();
  for (const row of rows) {
    totalByUnit.set(row.unit, (totalByUnit.get(row.unit) ?? 0) + row.quantity);
    maxByUnit.set(row.unit, Math.max(maxByUnit.get(row.unit) ?? 0, row.quantity));
  }
  return rows.map((row, index) => {
    const total = totalByUnit.get(row.unit) ?? 0;
    const max = maxByUnit.get(row.unit) ?? 0;
    const percent = total > 0 ? (row.quantity / total) * 100 : 0;
    return {
      ...row,
      rank: String(index + 1).padStart(2, '0'),
      shareLabel: `${percent.toFixed(percent < 10 ? 1 : 0)}%`,
      barWidth: `${max > 0 ? (row.quantity / max) * 100 : 0}%`,
    };
  });
});
// Date tile of a sale row: the day, then "ก.ย. 69" (short month, Buddhist
// year's last two digits).
function saleDay(isoDate: string): string {
  return String(new Date(isoDate).getDate());
}

function saleMonth(isoDate: string): string {
  const date = new Date(isoDate);
  return `${THAI_MONTH_SHORT_NAMES[date.getMonth()] ?? ''} ${(date.getFullYear() + 543) % 100}`;
}

// Day grouping on the current page (the backend sends newest first, so a day's
// sales are adjacent). Compared as local calendar days, like the tile shows.
function saleDayKey(index: number): string | null {
  const sale = sales.value.data?.items[index];
  if (!sale) return null;
  const date = new Date(sale.saleDate);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startsDay(index: number): boolean {
  return index === 0 || saleDayKey(index - 1) !== saleDayKey(index);
}

function continuesDay(index: number): boolean {
  const next = saleDayKey(index + 1);
  return next !== null && next === saleDayKey(index);
}

// Before the first render, not after: fetchInto clears the previous visit's
// summary synchronously, so the page opens on the spinner instead of drawing the
// chart from stale data and pulling it out again a tick later (ApexCharts then
// rejects with "Element not found").
onBeforeMount(() => {
  void loadSummary();
  void loadSales();
});

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
}

.ops-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.ops-card {
  min-height: 104px;
  padding: 16px 18px;
  gap: 12px;
}

.ops-card .summary-icon {
  width: 48px;
  height: 48px;
  min-width: 48px;
  font-size: 24px;
}

.ops-value {
  font-size: 20px;
  // A figure never splits mid-number ("9,86 / 5.5"); only the unit may wrap
  // to the next line as a whole word.
  overflow-wrap: normal;
}

.ops-panels {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1fr);
  gap: 22px;
  margin-top: 24px;
}

// --- Waste-type ranking (same look as the dashboard's top-5 card) ---

.waste-rank {
  display: grid;
  gap: 18px;
  margin-top: 22px;
}

.waste-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.waste-no {
  color: #9ccdb0;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.waste-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #26352d;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waste-qty {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.waste-track {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  background: #eef4f0;
  border-radius: 999px;
}

.waste-fill {
  height: 100%;
  background: #1e8a44;
  border-radius: 999px;
}

.waste-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.waste-amount {
  color: #0d7a44;
  font-size: 12.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// --- Sale list (transaction rows in q-table grid mode) ---

// The container is rendered inside QTable, hence :deep. One column of rows
// split by hairlines, not a grid of cards.
.sale-table :deep(.sale-list) {
  display: block;
  padding: 4px 26px 8px;
}

.sale-txn {
  --tile-space: 66px; // date tile + gap: where a same-day divider starts
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 0;

  // Hairline under each row; between two sales of the same day it starts
  // after the tile column, so the day reads as one block.
  &::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 1px;
    background: #eef3ef;
  }

  &.continues-day {
    padding-bottom: 10px;

    &::after {
      left: var(--tile-space);
    }
  }

  &.is-same-day {
    padding-top: 10px;
  }

  &:last-child::after {
    display: none;
  }
}

.sale-date {
  display: grid;
  place-items: center;
  align-content: center;
  width: 52px;
  min-width: 52px;
  padding: 8px 0;
  background: #eef7f1;
  border-radius: 12px;
  line-height: 1.1;
}

// Keeps the tile's width on a day's later rows, without the tile.
.sale-date--blank {
  padding: 0;
  background: none;
}

.sale-day {
  color: #0f7a40;
  font-size: 19px;
  font-weight: 900;
}

.sale-month {
  margin-top: 2px;
  color: #5f8b71;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.sale-body {
  flex: 1;
  min-width: 0;
}

// Name on the left, money on the right. The money lines are short on purpose
// so both columns fit a 360px phone; below that the money block drops under
// the name rather than forcing a sideways scroll.
.sale-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px 12px;
}

.sale-who {
  flex: 1 1 140px;
  min-width: 0;
}

.sale-member {
  color: #16352a;
  font-size: 14.5px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.sale-sub {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.sale-money {
  text-align: right;
}

.sale-total {
  color: #0d7a44;
  font-size: 15px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sale-net {
  margin-top: 1px;
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  // Five cards in two columns: total sales takes the first row on its own, so
  // no card is left alone at the bottom.
  .ops-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ops-card:first-child {
    grid-column: 1 / -1;
  }

  .ops-panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .filter-row {
    padding: 16px;
  }

  // Phone: a half-width card cannot hold the icon beside the figure, so the
  // icon sits on top and the label and figure get the card's full width. The
  // full-width first card (ยอดขายรวม) keeps the side-by-side layout.
  .ops-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    min-height: 0;
    padding: 14px;
  }

  .ops-card:first-child {
    flex-direction: row;
    align-items: center;
  }

  .ops-card .summary-icon {
    width: 38px;
    height: 38px;
    min-width: 38px;
    border-radius: 11px;
    font-size: 20px;
  }

  .ops-card .summary-content {
    width: 100%;
  }

  .ops-card .summary-label {
    font-size: 12.5px;
  }

  .ops-value {
    margin-top: 2px;
  }

  .ops-value span {
    font-size: 12px;
  }

  .sale-table :deep(.sale-list) {
    padding: 4px 16px 8px;
  }

  .sale-txn {
    --tile-space: 58px;
    gap: 12px;
  }

  .sale-date {
    width: 46px;
    min-width: 46px;
  }

  .sale-day {
    font-size: 17px;
  }
}
</style>
