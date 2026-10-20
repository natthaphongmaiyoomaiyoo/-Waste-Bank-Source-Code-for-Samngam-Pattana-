<template>
  <q-page class="member-page">
    <div class="page-shell">
      <div class="page-hero q-mb-lg">
        <div class="hero-heading">
          <div class="hero-icon"><q-icon name="account_balance_wallet" /></div>
          <div class="page-title">ประวัติและเงินสะสม</div>
        </div>
      </div>

      <div
        class="summary-card q-mb-lg"
        :class="{ 'summary-card--danger': !profileStore.hasMinimumFund }"
      >
        <div class="summary-icon icon-fund"><q-icon name="savings" /></div>
        <div class="summary-content">
          <div class="summary-label">ยอดเงินสะสม</div>
          <div class="summary-value">
            {{ profileStore.profile.fundBalance.toLocaleString() }}
            <span>บาท</span>
          </div>
          <div v-if="!profileStore.hasMinimumFund" class="summary-shortfall">
            <q-icon name="error_outline" />
            ขาดอีก {{ profileStore.fundShortfall.toLocaleString() }} บาท
          </div>
        </div>
      </div>

      <q-card flat class="content-card">
        <q-card-section>
          <div class="section-head">
            <div class="section-icon icon-blue"><q-icon name="receipt_long" /></div>
            <div class="section-title">ประวัติการขายขยะและเงินสะสม</div>
            <q-badge class="count-badge">{{ activeRowCount }} รายการ</q-badge>
          </div>
        </q-card-section>

        <q-tabs
          v-model="tab"
          dense
          class="history-tabs"
          active-color="green-9"
          indicator-color="green-9"
          align="left"
        >
          <q-tab name="sale" label="ขายขยะ" />
          <q-tab name="fund" label="เงินสะสม" />
        </q-tabs>

        <q-separator />

        <div v-if="tableError" class="activity-empty">
          <q-icon name="error_outline" size="28px" color="orange-9" />
          {{ tableError }}
        </div>

        <!-- "ขายขยะ": one statement row per sale - ขายได้ / เข้าเงินสะสม / เงินสดกลับบ้าน each get their own column instead of one lump amount. Standalone savings events (funeral deductions, etc.) live only in "เงินสะสม". -->
        <q-table
          v-else-if="tab === 'sale'"
          v-model:pagination="salePagination"
          flat
          row-key="id"
          class="history-table is-clickable"
          :rows="saleRows"
          :columns="saleColumns"
          :grid="isPhone"
          :loading="tableLoading"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          no-data-label="ไม่มีรายการในหมวดนี้"
          @request="onTableRequest"
          @row-click="(_evt, row) => openSaleDetail(row as MemberSaleBreakdown)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <div class="history-card-wrap col-12">
              <article class="history-card">
                <div class="history-card-head">
                  <div class="activity-icon activity-sale"><q-icon name="recycling" /></div>
                  <div class="history-card-title">
                    <div class="cell-strong">ขายขยะรีไซเคิล</div>
                    <div class="cell-sub">{{ props.row.date }} · {{ props.row.time }} น.</div>
                  </div>
                  <div class="history-card-amount">
                    {{ props.row.totalAmount.toLocaleString() }} <span>บาท</span>
                  </div>
                </div>
                <dl class="history-card-rows">
                  <div>
                    <dt>เข้าเงินสะสม</dt>
                    <dd :class="savedAmountOf(props.row) > 0 && 'amount-deposit'">
                      {{ savedAmountOf(props.row).toLocaleString() }} บาท
                    </dd>
                  </div>
                  <div>
                    <dt>เงินสดกลับบ้าน</dt>
                    <dd :class="props.row.cashReceived > 0 && 'text-positive'">
                      {{ props.row.cashReceived.toLocaleString() }} บาท
                    </dd>
                  </div>
                  <div>
                    <dt>ใบเสร็จ</dt>
                    <dd>{{ props.row.receiptNo }}</dd>
                  </div>
                </dl>
                <q-btn
                  flat
                  no-caps
                  icon-right="chevron_right"
                  label="เพิ่มเติม"
                  class="history-card-more"
                  @click="openSaleDetail(props.row)"
                />
              </article>
            </div>
          </template>

          <template #body-cell-date="props">
            <q-td :props="props">
              <div class="cell-strong">{{ props.row.date }}</div>
              <div class="cell-sub">{{ props.row.time }} น.</div>
            </q-td>
          </template>

          <template #body-cell-item="props">
            <q-td :props="props">
              <div class="item-cell">
                <div class="activity-icon activity-sale"><q-icon name="recycling" /></div>
                <div>
                  <div class="cell-strong">ขายขยะรีไซเคิล</div>
                  <div class="cell-sub">{{ props.row.detail }}</div>
                </div>
              </div>
            </q-td>
          </template>

          <template #body-cell-totalAmount="props">
            <q-td :props="props" class="text-right">
              <span class="amount-cell">{{ props.row.totalAmount.toLocaleString() }}</span>
            </q-td>
          </template>

          <template #body-cell-savedAmount="props">
            <q-td :props="props" class="text-right">
              <span :class="['amount-cell', savedAmountOf(props.row) > 0 && 'amount-deposit']">
                {{ savedAmountOf(props.row).toLocaleString() }}
              </span>
            </q-td>
          </template>

          <template #body-cell-cashReceived="props">
            <q-td :props="props" class="text-right">
              <span :class="['amount-cell', props.row.cashReceived > 0 && 'text-positive']">
                {{ props.row.cashReceived.toLocaleString() }}
              </span>
            </q-td>
          </template>

          <!-- The whole row opens the sale, so this is a shortcut, not the only
               way in - but it has to look pressable, not like a label. -->
          <template #body-cell-more="props">
            <q-td :props="props" class="text-right" @click.stop>
              <q-btn
                dense
                no-caps
                unelevated
                label="เพิ่มเติม"
                icon-right="chevron_right"
                class="history-more-btn"
                @click="openSaleDetail(props.row)"
              />
            </q-td>
          </template>

          <template #no-data>
            <div class="activity-empty full-width">
              <q-icon name="inbox" size="28px" />
              ไม่มีรายการในหมวดนี้
            </div>
          </template>
        </q-table>

        <!-- "เงินสะสม": the only tab that shows savings events that don't come from a sale (funeral deductions, etc.). -->
        <q-table
          v-else
          v-model:pagination="ledgerPagination"
          flat
          row-key="id"
          class="history-table"
          :rows="ledgerRows"
          :columns="historyColumns"
          :grid="isPhone"
          :loading="tableLoading"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          no-data-label="ไม่มีรายการในหมวดนี้"
          @request="onTableRequest"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <div class="history-card-wrap col-12">
              <article class="history-card">
                <div class="history-card-head">
                  <div class="activity-icon activity-fund"><q-icon name="savings" /></div>
                  <div class="history-card-title">
                    <div class="cell-strong">{{ props.row.title }}</div>
                    <div class="cell-sub">{{ props.row.date }} · {{ props.row.time }} น.</div>
                  </div>
                  <div
                    :class="[
                      'history-card-amount',
                      props.row.positive ? 'text-positive' : 'text-negative',
                    ]"
                  >
                    {{ props.row.positive ? '+' : '-' }}{{ props.row.amount.toLocaleString() }}
                    <span>บาท</span>
                  </div>
                </div>
                <div class="history-card-detail">{{ props.row.detail }}</div>
                <dl class="history-card-rows">
                  <div>
                    <dt>เงินสะสมคงเหลือ</dt>
                    <dd>{{ props.row.balance.toLocaleString() }} บาท</dd>
                  </div>
                </dl>
              </article>
            </div>
          </template>

          <template #body-cell-date="props">
            <q-td :props="props">
              <div class="cell-strong">{{ props.row.date }}</div>
              <div class="cell-sub">{{ props.row.time }} น.</div>
            </q-td>
          </template>

          <template #body-cell-item="props">
            <q-td :props="props">
              <div class="item-cell">
                <div class="activity-icon activity-fund"><q-icon name="savings" /></div>
                <div>
                  <div class="cell-strong">{{ props.row.title }}</div>
                  <div class="cell-sub">{{ props.row.detail }}</div>
                </div>
              </div>
            </q-td>
          </template>

          <template #body-cell-amount="props">
            <q-td :props="props" class="text-right">
              <span
                :class="['amount-cell', props.row.positive ? 'text-positive' : 'text-negative']"
              >
                {{ props.row.positive ? '+' : '-' }}{{ props.row.amount.toLocaleString() }}
              </span>
            </q-td>
          </template>

          <template #body-cell-balance="props">
            <q-td :props="props" class="text-right">
              {{ props.row.balance.toLocaleString() }}
            </q-td>
          </template>

          <template #no-data>
            <div class="activity-empty full-width">
              <q-icon name="inbox" size="28px" />
              ไม่มีรายการในหมวดนี้
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <SaleDetailDialog v-model="saleDetailOpen" :sale-id="saleDetailId" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableProps } from 'quasar';
import SaleDetailDialog from 'components/SaleDetailDialog.vue';
import {
  useMemberProfileStore,
  type MemberFundTransaction,
  type MemberHistoryPageRequest,
  type MemberSaleBreakdown,
} from 'src/stores/memberProfileStore';
import {
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

type TabName = 'sale' | 'fund';

const $q = useQuasar();
const profileStore = useMemberProfileStore();
const tab = ref<TabName>('sale');
// Wide tables squeezed onto a phone are unreadable, so small screens get one
// card per row instead (q-table grid mode).
const isPhone = computed(() => $q.screen.lt.sm);

// "เพิ่มเติม": every weighed line of one sale plus the committee's bill photos.
const saleDetailOpen = ref(false);
const saleDetailId = ref<number | null>(null);

function openSaleDetail(row: MemberSaleBreakdown) {
  saleDetailId.value = row.saleId;
  saleDetailOpen.value = true;
}

// Everything from a sale that stayed in savings: the automatic top-up to the
// minimum plus whatever the member chose to keep - it's all one balance now.
function savedAmountOf(row: MemberSaleBreakdown): number {
  return Math.round((row.fundDeductAmount + row.surplusDeposit) * 100) / 100;
}

const historyColumns: QTableProps['columns'] = [
  { name: 'date', label: 'วันที่', field: 'date', align: 'left' },
  { name: 'item', label: 'รายการ', field: 'title', align: 'left' },
  { name: 'receipt', label: 'ใบเสร็จ', field: 'receiptNo', align: 'left' },
  { name: 'amount', label: 'จำนวนเงิน (บาท)', field: 'amount', align: 'right', sortable: true },
  { name: 'balance', label: 'เงินสะสมคงเหลือ (บาท)', field: 'balance', align: 'right' },
];

const saleColumns: QTableProps['columns'] = [
  { name: 'date', label: 'วันที่', field: 'date', align: 'left' },
  { name: 'item', label: 'รายการ', field: 'detail', align: 'left' },
  { name: 'receipt', label: 'ใบเสร็จ', field: 'receiptNo', align: 'left' },
  {
    name: 'totalAmount',
    label: 'ขายได้ (บาท)',
    field: 'totalAmount',
    align: 'right',
    sortable: true,
  },
  { name: 'savedAmount', label: 'เข้าเงินสะสม (บาท)', field: savedAmountOf, align: 'right' },
  { name: 'cashReceived', label: 'เงินสดกลับบ้าน (บาท)', field: 'cashReceived', align: 'right' },
  { name: 'more', label: '', field: 'saleId', align: 'right' },
];

// --- Paged tables -------------------------------------------------------------
// Both tabs load one page at a time from the server (sorting included), so the
// member's whole history never has to come down at once.

interface HistoryPagination {
  page: number;
  rowsPerPage: number;
  rowsNumber: number;
  sortBy: string | null;
  descending: boolean;
}

function firstPage(): HistoryPagination {
  return { page: 1, rowsPerPage: 10, rowsNumber: 0, sortBy: null, descending: false };
}

const salePagination = useRememberedPagination('member-receipts', firstPage());
const ledgerPagination = useRememberedPagination('member-fund-ledger', firstPage());
const saleRows = ref<MemberSaleBreakdown[]>([]);
const ledgerRows = ref<MemberFundTransaction[]>([]);
const tableLoading = ref(false);
const tableError = ref<string | null>(null);

// The only sortable column in either table is the amount; no sort = newest first.
function pageRequest(pagination: HistoryPagination): MemberHistoryPageRequest {
  return {
    page: pagination.page,
    pageSize: pagination.rowsPerPage,
    ...(pagination.sortBy ? { sortBy: 'amount' as const, descending: pagination.descending } : {}),
  };
}

async function loadTab(next?: Omit<HistoryPagination, 'rowsNumber'>) {
  const isFund = tab.value === 'fund';
  const pagination = isFund ? ledgerPagination : salePagination;
  const request = { ...pagination.value, ...next };
  tableLoading.value = true;
  tableError.value = null;
  try {
    if (isFund) {
      const { rows, total } = await profileStore.fetchLedgerPage(pageRequest(request));
      ledgerRows.value = rows;
      pagination.value = { ...request, rowsNumber: total };
    } else {
      const { rows, total } = await profileStore.fetchSalesPage(pageRequest(request));
      saleRows.value = rows;
      pagination.value = { ...request, rowsNumber: total };
    }
  } catch {
    tableError.value = 'ไม่สามารถโหลดข้อมูลเงินสะสม/ประวัติได้ กรุณาลองใหม่อีกครั้ง';
  } finally {
    tableLoading.value = false;
  }
}

function onTableRequest(props: { pagination: Omit<HistoryPagination, 'rowsNumber'> }) {
  void loadTab(props.pagination);
}

watch(tab, () => {
  void loadTab();
});

const activeRowCount = computed(() =>
  tab.value === 'fund' ? ledgerPagination.value.rowsNumber : salePagination.value.rowsNumber,
);

onMounted(() => {
  void profileStore.fetchSummary();
  void loadTab();
});
</script>

<style scoped>
.member-page {
  min-height: 100%;
  padding: 24px;
  background: #f3f7f1;
}

.page-shell {
  max-width: 1120px;
  margin: 0 auto;
}

.page-hero {
  padding: 24px;
  color: #063f27;
  background: #ffffff;
  border: 1px solid #dfe9df;
  border-radius: 14px;
  box-shadow: 0 12px 30px rgba(31, 71, 45, 0.07);
}

.hero-heading {
  display: flex;
  gap: 16px;
  align-items: center;
}

.hero-icon {
  display: grid;
  width: 52px;
  height: 52px;
  min-width: 52px;
  place-items: center;
  color: #087f49;
  background: #e6f5ea;
  border-radius: 14px;
  font-size: 26px;
}

.page-title {
  color: #063f27;
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 950;
  line-height: 1.15;
}

.summary-card,
.content-card {
  border: 1px solid #dfe9df;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(31, 71, 45, 0.07);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
}

/* Red emphasis when savings are below the minimum. */
.summary-card--danger {
  background: #fdecea;
  border-color: rgba(192, 57, 43, 0.32);
}

.summary-card--danger .summary-icon {
  color: #c0392b;
  background: #f9d9d4;
}

.summary-card--danger .summary-value {
  color: #c0392b;
}

.summary-content {
  min-width: 0;
  flex: 1;
}

.summary-icon {
  display: grid;
  width: 52px;
  height: 52px;
  min-width: 52px;
  place-items: center;
  border-radius: 14px;
  font-size: 26px;
}

.icon-fund {
  color: #27962b;
  background: #e4f4df;
}

.summary-label {
  color: #202b27;
  font-size: 13.5px;
  font-weight: 900;
}

.summary-value {
  margin-top: 8px;
  color: #063f27;
  font-size: 28px;
  font-weight: 950;
  line-height: 1;
}

.summary-value span {
  margin-left: 4px;
  color: #6f7f76;
  font-size: 14px;
  font-weight: 800;
}

.summary-shortfall {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #c0392b;
  font-size: 14px;
  font-weight: 800;
}

.summary-shortfall .q-icon {
  font-size: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.section-icon {
  display: grid;
  width: 38px;
  height: 38px;
  min-width: 38px;
  place-items: center;
  border-radius: 12px;
  font-size: 20px;
}

.icon-blue {
  color: #1565c0;
  background: #e3f0fd;
}

.section-title {
  min-width: 0;
  flex: 1;
  color: #111f18;
  font-size: 17px;
  font-weight: 900;
}

.count-badge {
  flex-shrink: 0;
  padding: 6px 12px;
  color: #087f49;
  background: #eef8ef;
  border-radius: 999px;
  font-weight: 800;
}

.history-tabs {
  padding: 0 16px;
}

:deep(.history-tabs .q-tab) {
  border-radius: 10px 10px 0 0;
  font-weight: 800;
}

.history-table {
  border-top: 1px solid #edf2ee;
}

.history-table :deep(.q-table__middle) {
  overflow-x: auto;
}

.history-table :deep(table) {
  min-width: 640px;
}

/* Any cell of a sale row opens that sale. */
.history-table.is-clickable :deep(tbody tr) {
  cursor: pointer;
}

.history-table :deep(thead th) {
  color: #43514a;
  font-size: 13px;
  font-weight: 700;
}

.history-table :deep(tbody td) {
  color: #2c3b33;
  font-weight: 400;
  vertical-align: middle;
}

.item-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cell-strong {
  color: #18231e;
  font-weight: 500;
}

.cell-sub {
  margin-top: 2px;
  max-width: 360px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
  white-space: normal;
}

.amount-cell {
  font-weight: 600;
}

.amount-deposit {
  color: #1565c0;
}

.activity-icon {
  display: grid;
  width: 36px;
  height: 36px;
  min-width: 36px;
  place-items: center;
  border-radius: 999px;
  font-size: 18px;
}

.activity-sale {
  color: #27962b;
  background: #e4f4df;
}

.activity-fund {
  color: #1565c0;
  background: #e3f0fd;
}

.activity-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: #98a19d;
  font-weight: 800;
}

/* --- Phone card view ------------------------------------------------------------ */

.history-card-wrap {
  padding: 6px 12px;
}

.history-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 14px;
}

.history-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.history-card-title {
  min-width: 0;
  flex: 1;
}

.history-card-amount {
  flex-shrink: 0;
  color: #18231e;
  font-size: 17px;
  font-weight: 900;
  white-space: nowrap;
}

.history-card-amount span {
  font-size: 12px;
  font-weight: 700;
}

.history-card-more {
  width: 100%;
  min-height: 38px;
  margin-top: 10px;
  color: #087f49;
  background: #eef8ef;
  border-radius: 10px;
  font-weight: 800;
}

.history-more-btn {
  padding: 3px 10px 3px 14px;
  color: #087f49;
  background: #eef8ef;
  border: 1px solid #cfe6d5;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
}

.history-more-btn:hover {
  background: #e2f2e6;
}

.history-more-btn :deep(.q-icon) {
  font-size: 17px;
}

.history-card-detail {
  margin-top: 10px;
  color: #6f7f76;
  font-size: 13px;
  font-weight: 600;
}

.history-card-rows {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #e3ece2;
}

.history-card-rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.history-card-rows dt {
  color: #7f8f85;
  font-size: 13px;
  font-weight: 600;
}

.history-card-rows dd {
  margin: 0;
  color: #18231e;
  font-size: 13.5px;
  font-weight: 800;
  text-align: right;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .member-page {
    padding: 16px;
  }

  .page-hero {
    padding: 20px;
  }

  /* The hero already carries an icon; dropping this one keeps the long section
     title and its count on a single row. */
  .section-icon {
    display: none;
  }

  /* One row with the count: shrink a little on the narrowest phones, and cut
     with an ellipsis rather than wrap if it still doesn't fit. */
  .section-head {
    gap: 10px;
  }

  .section-title {
    overflow: hidden;
    font-size: clamp(13px, 3.9vw, 15px);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .count-badge {
    padding: 5px 10px;
  }
}
</style>
