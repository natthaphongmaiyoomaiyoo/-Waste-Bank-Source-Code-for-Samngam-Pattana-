<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="savings" />
          </div>
          <div class="hero-copy">
            <h1>ติดตามกองทุน</h1>
          </div>
        </div>
      </section>

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
        <section class="summary-grid">
          <article v-for="card in summaryCards" :key="card.label" class="summary-card">
            <div :class="['summary-icon', card.iconClass]">
              <q-icon :name="card.icon" />
            </div>
            <div class="summary-content">
              <div class="summary-label">{{ card.label }}</div>
              <div class="summary-value">
                {{ card.value }}
                <span>{{ card.unit }}</span>
              </div>
            </div>
          </article>
        </section>

        <!-- One account, so one panel: money in against money out, and what is
             left. The account's own name and update time ride in the caption
             instead of a separate per-account card. -->
        <q-card flat class="panel-card flow-card">
          <div class="panel-head">
            <div>
              <div class="panel-title">เงินเข้า–ออกกองทุน</div>
              <div v-if="fundAccount" class="panel-caption">
                อัปเดตล่าสุด {{ formatThaiDate(fundAccount.updatedAt) }}
              </div>
            </div>
          </div>

          <div class="flow-list">
            <div v-for="row in flowRows" :key="row.key" :class="['flow-row', `flow-row--${row.direction}`]">
              <div class="flow-icon">
                <q-icon :name="row.icon" />
              </div>
              <div class="flow-main">
                <div class="flow-line">
                  <span class="flow-name">{{ row.label }}</span>
                  <span class="flow-amount">
                    {{ row.direction === 'in' ? '+' : '−' }}{{ formatBaht(row.amount) }} บาท
                  </span>
                </div>
                <!-- In and out drawn on one scale, so the out bar shows how much
                     of what came in has been paid out. -->
                <div class="flow-track">
                  <div class="flow-fill" :style="{ width: `${row.width}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="flow-balance">
            <div class="flow-balance-label">
              <q-icon name="account_balance" />
              คงเหลือในกองทุน
            </div>
            <div class="flow-balance-value">
              {{ formatBaht(summary.data.totalBalance) }} <span>บาท</span>
            </div>
          </div>
        </q-card>
      </template>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">รายการเดินบัญชีกองทุน</div>
            <div class="panel-caption">รายรับ-รายจ่ายทั้งหมดของกองทุน</div>
          </div>
        </div>

        <div class="filter-row">
          <MidFilterBar
            v-model:search="search"
            search-label="ค้นหา (รายละเอียด / ชื่อ / รหัสสมาชิก)"
            title="กรองรายการเดินบัญชี"
            :active="activeFilters"
            @clear="clearFilter"
            @update:search="applyFilters"
            @clear-all="resetFilters"
          >
            <q-select
              v-model="transactionType"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="ประเภทรายการ"
              :options="typeOptions"
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
          </MidFilterBar>
        </div>

        <q-banner v-if="transactions.error" rounded class="bg-red-1 text-red-9 q-ma-md">
          {{ transactions.error }}
          <template #action>
            <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadTransactions" />
          </template>
        </q-banner>

        <!-- Always grid mode: each entry is a transaction row (#item) that wraps
             instead of scrolling sideways, while the table keeps doing the
             server-side paging. Same shape as the operations page's sale list. -->
        <q-table
          v-else
          flat
          grid
          row-key="id"
          class="muni-table ledger-table"
          card-container-class="ledger-list"
          :rows="transactions.data?.items ?? []"
          :loading="transactions.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <!-- Same-day entries share one date tile: only the day's first row
                 draws it, the rest keep its space so the text lines up. -->
            <article
              :class="[
                'ledger-row',
                {
                  'is-same-day': !startsDay(props.pageIndex),
                  'continues-day': continuesDay(props.pageIndex),
                },
              ]"
            >
              <div v-if="startsDay(props.pageIndex)" class="ledger-date">
                <span class="ledger-day">{{ entryDay(props.row.transactionDate) }}</span>
                <span class="ledger-month">{{ entryMonth(props.row.transactionDate) }}</span>
              </div>
              <div v-else class="ledger-date ledger-date--blank" aria-hidden="true"></div>

              <div class="ledger-body">
                <div class="ledger-who">
                  <div class="ledger-name">
                    {{ props.row.member ? memberFullName(props.row.member) : 'กองทุน' }}
                  </div>
                  <div class="ledger-sub">
                    <span :class="['ledger-type', props.row.amountIn > 0 ? 'is-in' : 'is-out']">
                      {{ ledgerTypeLabel(props.row.transactionType) }}
                    </span>
                    <span v-if="props.row.member">รหัส {{ props.row.member.memberCode }}</span>
                  </div>
                </div>
                <div class="ledger-money">
                  <div :class="['ledger-amount', props.row.amountIn > 0 ? 'is-in' : 'is-out']">
                    {{ props.row.amountIn > 0 ? '+' : '−'
                    }}{{ formatBaht(props.row.amountIn > 0 ? props.row.amountIn : props.row.amountOut) }} บาท
                  </div>
                  <div class="ledger-balance">กองทุนเหลือ {{ formatBaht(props.row.balanceAfter) }}</div>
                </div>
              </div>
            </article>
          </template>
          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="savings" size="32px" />
              ไม่พบรายการตามเงื่อนไขที่เลือก
            </div>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useMunicipalityStore } from 'src/stores/municipalityStore';
import {
  FUND_TYPE_LABELS,
  THAI_MONTH_SHORT_NAMES,
  formatBaht,
  formatThaiDate,
  fundTypeLabel,
  memberFullName,
} from './format';
import {
  MidDateField,
  MidFilterBar,
  midOptionLabel,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const store = useMunicipalityStore();
const summary = computed(() => store.fundSummary);
const transactions = computed(() => store.fundTransactions);

const transactionType = ref<string | null>(null);
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const search = ref('');
let filterTimer: number | undefined;

const typeOptions = Object.entries(FUND_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const pagination = useRememberedPagination('municipality-fund', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
});

// The fund is a single account now; its name and update time go in the flow
// panel's caption.
const fundAccount = computed(() => summary.value.data?.accounts[0] ?? null);

// Money in and out of the one savings account. The automatic top-up to the
// minimum (contribution) and the extra a member chose to keep (deposit) are
// the same money going into the same balance, so they are one line. Donations
// and adjustments only get a line when there are any.
const flowRows = computed(() => {
  const byType = summary.value.data?.byType ?? {};
  const adjustment = (byType['adjustment']?.amountIn ?? 0) - (byType['adjustment']?.amountOut ?? 0);
  const rows: { key: string; label: string; icon: string; amount: number; direction: 'in' | 'out' }[] = [
    {
      key: 'sale',
      label: 'เงินเข้าจากการขายขยะ',
      icon: 'savings',
      amount: (byType['contribution']?.amountIn ?? 0) + (byType['deposit']?.amountIn ?? 0),
      direction: 'in',
    },
    { key: 'donation', label: 'เงินบริจาค', icon: 'redeem', amount: byType['donation']?.amountIn ?? 0, direction: 'in' },
    // Cash members brought later for a funeral they were short on; it goes
    // straight out again to the family, inside the "หักจ่ายฌาปนกิจ" line below.
    {
      key: 'funeral-late',
      label: 'รับชำระเงินฌาปนกิจค้างจ่าย',
      icon: 'payments',
      amount: byType['funeral_late_payment']?.amountIn ?? 0,
      direction: 'in',
    },
    {
      key: 'funeral',
      label: 'หักจ่ายฌาปนกิจ',
      icon: 'volunteer_activism',
      amount: byType['benefit_payment']?.amountOut ?? 0,
      direction: 'out',
    },
    {
      key: 'adjustment',
      label: 'ปรับปรุงยอด',
      icon: 'tune',
      amount: Math.abs(adjustment),
      direction: adjustment >= 0 ? 'in' : 'out',
    },
  ];
  const shown = rows.filter((row, index) => index === 0 || row.amount > 0);
  const scale = Math.max(...shown.map((row) => row.amount), 0);
  return shown.map((row) => ({ ...row, width: scale > 0 ? (row.amount / scale) * 100 : 0 }));
});

const summaryCards = computed(() => {
  const data = summary.value.data;
  if (!data) return [];
  return [
    {
      label: 'ยอดกองทุนคงเหลือ',
      value: formatBaht(data.totalBalance),
      unit: 'บาท',
      icon: 'account_balance',
      iconClass: 'icon-green',
    },
    {
      label: 'รายรับสะสม',
      value: formatBaht(data.totalIn),
      unit: 'บาท',
      icon: 'trending_up',
      iconClass: 'icon-green',
    },
    {
      label: 'รายจ่ายสะสม',
      value: formatBaht(data.totalOut),
      unit: 'บาท',
      icon: 'trending_down',
      iconClass: 'icon-red',
    },
    {
      label: 'จ่ายสวัสดิการ/ฌาปนกิจ',
      value: formatBaht(data.welfarePayments.amountOut),
      unit: 'บาท',
      icon: 'volunteer_activism',
      iconClass: 'icon-amber',
    },
  ];
});

// --- Ledger rows ---

// One account: the top-up to the minimum and the extra a member kept are the
// same money in, so the row calls both what the flow panel above calls them.
function ledgerTypeLabel(type: string): string {
  return type === 'contribution' || type === 'deposit' ? 'เงินเข้าจากการขายขยะ' : fundTypeLabel(type);
}

// Date tile: the day, then "ก.ย. 69" (short month, Buddhist year's last two
// digits).
function entryDay(isoDate: string): string {
  return String(new Date(isoDate).getDate());
}

function entryMonth(isoDate: string): string {
  const date = new Date(isoDate);
  return `${THAI_MONTH_SHORT_NAMES[date.getMonth()] ?? ''} ${(date.getFullYear() + 543) % 100}`;
}

// Day grouping on the current page (the backend sends newest first, so a day's
// entries are adjacent). Compared as local calendar days, like the tile shows.
function entryDayKey(index: number): string | null {
  const entry = transactions.value.data?.items[index];
  if (!entry) return null;
  const date = new Date(entry.transactionDate);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startsDay(index: number): boolean {
  return index === 0 || entryDayKey(index - 1) !== entryDayKey(index);
}

function continuesDay(index: number): boolean {
  const next = entryDayKey(index + 1);
  return next !== null && next === entryDayKey(index);
}

function loadSummary() {
  void store.fetchFundSummary();
}

async function loadTransactions() {
  const applied = await store.fetchFundTransactions({
    page: pagination.value.page,
    pageSize: pagination.value.rowsPerPage,
    transactionType: transactionType.value ?? undefined,
    dateFrom: dateFrom.value ?? undefined,
    dateTo: dateTo.value ?? undefined,
    search: search.value.trim() || undefined,
  });
  if (applied) {
    pagination.value.rowsNumber = transactions.value.data?.total ?? 0;
  }
}

function runFilterRequest() {
  pagination.value.page = 1;
  void loadTransactions();
}

function applyFilters() {
  if (filterTimer) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    filterTimer = undefined;
    runFilterRequest();
  }, 250);
}

const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (transactionType.value) {
    items.push({ key: 'type', label: 'ประเภทรายการ', value: midOptionLabel(typeOptions, transactionType.value) });
  }
  if (dateFrom.value) {
    items.push({ key: 'dateFrom', label: 'ตั้งแต่วันที่', value: formatThaiDate(dateFrom.value) });
  }
  if (dateTo.value) {
    items.push({ key: 'dateTo', label: 'ถึงวันที่', value: formatThaiDate(dateTo.value) });
  }
  return items;
});

function clearFilter(key: string) {
  if (key === 'type') transactionType.value = null;
  if (key === 'dateFrom') dateFrom.value = null;
  if (key === 'dateTo') dateTo.value = null;
  applyFilters();
}

function resetFilters() {
  transactionType.value = null;
  dateFrom.value = null;
  dateTo.value = null;
  applyFilters();
}

function onTableRequest(props: { pagination: { page: number; rowsPerPage: number } }) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  void loadTransactions();
}

onMounted(() => {
  loadSummary();
  void loadTransactions();
});

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

// --- Money in / out panel ---

.flow-card {
  margin-top: 24px;
}

.flow-list {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.flow-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.flow-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  min-width: 42px;
  border-radius: 12px;
  font-size: 21px;
}

.flow-main {
  flex: 1;
  min-width: 0;
}

.flow-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
}

.flow-name {
  color: #26352d;
  font-size: 14.5px;
  font-weight: 700;
}

.flow-amount {
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.flow-track {
  height: 8px;
  margin-top: 8px;
  overflow: hidden;
  background: #eef4f0;
  border-radius: 999px;
}

.flow-fill {
  height: 100%;
  border-radius: 999px;
}

.flow-row--in {
  .flow-icon {
    color: #1e8a44;
    background: #eaf6ec;
  }

  .flow-amount {
    color: #0d7a44;
  }

  .flow-fill {
    background: #1e8a44;
  }
}

.flow-row--out {
  .flow-icon {
    color: #c05252;
    background: #faeded;
  }

  .flow-amount {
    color: #b04a4a;
  }

  .flow-fill {
    background: #d77a7a;
  }
}

// What is left, set apart on the brand gradient - the figure the panel
// arrives at.
.flow-balance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin-top: 22px;
  padding: 14px 18px;
  color: #ffffff;
  background: linear-gradient(135deg, #00693f, #0a9a52);
  border-radius: 14px;
}

.flow-balance-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;

  .q-icon {
    font-size: 20px;
  }
}

.flow-balance-value {
  font-size: 24px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  span {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.85;
  }
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 6px 28px 18px;
}

// --- Ledger list (transaction rows in q-table grid mode) ---

// The container is rendered inside QTable, hence :deep. One column of rows
// split by hairlines, not a grid of cards.
.ledger-table :deep(.ledger-list) {
  display: block;
  padding: 0 26px 8px;
}

.ledger-row {
  --tile-space: 66px; // date tile + gap: where a same-day divider starts
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 0;

  // Hairline under each row; between two entries of the same day it starts
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

.ledger-date {
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
.ledger-date--blank {
  padding: 0;
  background: none;
}

.ledger-day {
  color: #0f7a40;
  font-size: 19px;
  font-weight: 900;
}

.ledger-month {
  margin-top: 2px;
  color: #5f8b71;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

// Who and what on the left, the money on the right; on a very narrow phone
// the money block drops under rather than forcing a sideways scroll.
.ledger-body {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px 12px;
  min-width: 0;
}

.ledger-who {
  flex: 1 1 120px;
  min-width: 0;
}

.ledger-name {
  color: #16352a;
  font-size: 14.5px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.ledger-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-top: 4px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.ledger-type {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;

  &.is-in {
    color: #0d7a44;
    background: #e3f4e7;
  }

  &.is-out {
    color: #b04a4a;
    background: #fbe9e9;
  }
}

.ledger-money {
  text-align: right;
}

.ledger-amount {
  font-size: 15px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &.is-in {
    color: #0d7a44;
  }

  &.is-out {
    color: #b04a4a;
  }
}

.ledger-balance {
  margin-top: 2px;
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .filter-row {
    padding: 6px 16px 16px;
  }

  .ledger-table :deep(.ledger-list) {
    padding: 0 16px 8px;
  }

  .ledger-row {
    --tile-space: 58px;
    gap: 12px;
  }

  .ledger-date {
    width: 46px;
    min-width: 46px;
  }

  .ledger-day {
    font-size: 17px;
  }

  // Phone: the money gets a line of its own under the name - the amount on the
  // left, the balance after it on the right - the same in every row. As a narrow
  // right-aligned block it wrapped to wherever it fit and left "+50 บาท" floating
  // in the middle of the row.
  .ledger-money {
    display: flex;
    flex: 1 1 100%;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    text-align: left;
  }

  .ledger-balance {
    margin-top: 0;
  }

  // Phone: every amount on its own line under its label, so the rows stay
  // alike instead of only the longer figure wrapping.
  .flow-line {
    flex-direction: column;
    align-items: flex-start;
  }

  // Phone: the four summary cards two to a row (the shared theme stacks them
  // one per row), icon on top so the label and figure get the card's full
  // width - same as the members and operations pages.
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .summary-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-height: 0;
    padding: 12px 14px;
    border-radius: 14px;
  }

  .summary-icon {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 10px;
    font-size: 19px;
  }

  .summary-content {
    width: 100%;
  }

  .summary-label {
    font-size: 12px;
    line-height: 1.3;
  }

  // A figure never splits mid-number; only the unit may wrap as a whole word.
  .summary-value {
    margin-top: 2px;
    font-size: 20px;
    overflow-wrap: normal;
  }

  .summary-value span {
    font-size: 11.5px;
  }
}
</style>
