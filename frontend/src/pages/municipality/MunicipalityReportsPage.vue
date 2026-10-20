<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="bar_chart" />
          </div>
          <div class="hero-copy">
            <h1>รายงาน</h1>
          </div>
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <q-tabs
          v-model="tab"
          no-caps
          align="left"
          active-color="positive"
          indicator-color="positive"
          class="report-tabs text-grey-7"
        >
          <q-tab name="monthly" icon="calendar_month" label="รายเดือน" />
          <q-tab name="yearly" icon="calendar_today" label="รายปี" />
          <q-tab name="executive" icon="workspace_premium" label="ผู้บริหาร" />
        </q-tabs>
        <q-separator />

        <q-tab-panels v-model="tab" animated class="report-panels">
          <!-- ============================== Monthly =============================== -->
          <q-tab-panel name="monthly" class="report-panel">
            <div class="picker-row">
              <q-select
                v-model="monthlyYear"
                dense
                outlined
                emit-value
                map-options
                class="picker-item"
                label="ปี (ค.ศ.)"
                :options="yearOptions"
              />
              <q-select
                v-model="monthlyMonth"
                dense
                outlined
                emit-value
                map-options
                class="picker-item"
                label="เดือน"
                :options="monthOptions"
              />
              <q-btn
                unelevated
                no-caps
                color="positive"
                icon="description"
                label="สร้างรายงาน"
                class="picker-btn"
                :loading="monthly.loading"
                @click="loadMonthly"
              />
            </div>

            <q-banner v-if="monthly.error" rounded class="bg-red-1 text-red-9 q-mb-md">
              {{ monthly.error }}
              <template #action>
                <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadMonthly" />
              </template>
            </q-banner>

            <template v-else-if="monthly.data">
              <div class="report-title">
                รายงานประจำเดือน{{ THAI_MONTH_NAMES[monthly.data.period.month - 1] }}
                พ.ศ. {{ monthly.data.period.year + 543 }}
                <span class="report-stamp">สร้างเมื่อ {{ formatThaiDateTime(monthly.data.generatedAt) }}</span>
              </div>

              <div class="stat-grid">
                <article v-for="card in monthlyCards" :key="card.label" class="summary-card stat-card">
                  <div :class="['summary-icon', card.iconClass]">
                    <q-icon :name="card.icon" />
                  </div>
                  <div class="summary-content">
                    <div class="summary-label">{{ card.label }}</div>
                    <div class="summary-value stat-value">
                      {{ card.value }}
                      <span>{{ card.unit }}</span>
                    </div>
                    <div v-if="card.hint" class="summary-hint">{{ card.hint }}</div>
                  </div>
                </article>
              </div>

              <div class="report-grid">
                <div class="sub-panel">
                  <div class="sub-panel-title">แยกตามประเภทขยะ</div>
                  <q-table
                    flat
                    dense
                    row-key="wasteTypeId"
                    hide-pagination
                    class="muni-table"
                    :rows="monthly.data.operations.byWasteType"
                    :columns="wasteTypeColumns"
                    :rows-per-page-options="[0]"
                  >
                    <template #no-data>
                      <div class="full-width empty-state">ไม่มีการขายในเดือนนี้</div>
                    </template>
                  </q-table>
                </div>

                <div>
                  <div class="sub-panel">
                    <div class="sub-panel-title">เทียบกับเดือนก่อนหน้า</div>
                    <div class="trend-list">
                      <div v-for="row in monthlyTrendRows" :key="row.label" class="trend-item">
                        <span>{{ row.label }}</span>
                        <span
                          class="trend-value"
                          :class="row.change > 0 ? 'text-positive' : row.change < 0 ? 'text-negative' : 'text-grey-7'"
                        >
                          <q-icon
                            :name="row.change > 0 ? 'arrow_upward' : row.change < 0 ? 'arrow_downward' : 'remove'"
                          />
                          {{ row.display }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="sub-panel q-mt-md">
                    <div class="sub-panel-title">กองทุนในเดือนนี้</div>
                    <div class="trend-list">
                      <div class="trend-item">
                        <span>รายรับกองทุน</span>
                        <span class="trend-value text-positive">+{{ formatBaht(monthly.data.fund.totalIn) }} บาท</span>
                      </div>
                      <div class="trend-item">
                        <span>รายจ่ายกองทุน</span>
                        <span class="trend-value text-negative">-{{ formatBaht(monthly.data.fund.totalOut) }} บาท</span>
                      </div>
                      <div class="trend-item trend-item--total">
                        <span>ยอดกองทุน ณ สิ้นเดือน</span>
                        <span class="trend-value">{{ formatBaht(monthly.data.fund.balanceAtPeriodEnd) }} บาท</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div v-else-if="monthly.loading" class="loading-wrap">
              <q-spinner-dots size="48px" color="positive" />
            </div>
            <div v-else class="empty-state">
              <q-icon name="description" size="32px" />
              เลือกปีและเดือน แล้วกด "สร้างรายงาน"
            </div>
          </q-tab-panel>

          <!-- ============================== Yearly ================================ -->
          <q-tab-panel name="yearly" class="report-panel">
            <div class="picker-row">
              <q-select
                v-model="yearlyYear"
                dense
                outlined
                emit-value
                map-options
                class="picker-item"
                label="ปี (ค.ศ.)"
                :options="yearOptions"
              />
              <q-btn
                unelevated
                no-caps
                color="positive"
                icon="description"
                label="สร้างรายงาน"
                class="picker-btn"
                :loading="yearly.loading"
                @click="loadYearly"
              />
            </div>

            <q-banner v-if="yearly.error" rounded class="bg-red-1 text-red-9 q-mb-md">
              {{ yearly.error }}
              <template #action>
                <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadYearly" />
              </template>
            </q-banner>

            <template v-else-if="yearly.data">
              <div class="report-title">
                รายงานประจำปี พ.ศ. {{ yearly.data.period.year + 543 }}
                <span class="report-stamp">สร้างเมื่อ {{ formatThaiDateTime(yearly.data.generatedAt) }}</span>
              </div>

              <div class="stat-grid">
                <article v-for="card in yearlyCards" :key="card.label" class="summary-card stat-card">
                  <div :class="['summary-icon', card.iconClass]">
                    <q-icon :name="card.icon" />
                  </div>
                  <div class="summary-content">
                    <div class="summary-label">{{ card.label }}</div>
                    <div class="summary-value stat-value">
                      {{ card.value }}
                      <span>{{ card.unit }}</span>
                    </div>
                    <div v-if="card.hint" class="summary-hint">{{ card.hint }}</div>
                  </div>
                </article>
              </div>

              <div class="sub-panel q-mb-md">
                <div class="sub-panel-title">มูลค่าขายรายเดือน (บาท)</div>
                <apexchart type="bar" height="300" :options="yearlyChartOptions" :series="yearlyChartSeries" />
              </div>

              <div class="sub-panel">
                <div class="sub-panel-title">สรุปรายเดือน</div>
                <q-table
                  flat
                  dense
                  row-key="month"
                  hide-pagination
                  class="muni-table"
                  :rows="yearly.data.monthlyBreakdown"
                  :columns="breakdownColumns"
                  :rows-per-page-options="[0]"
                />
              </div>
            </template>

            <div v-else-if="yearly.loading" class="loading-wrap">
              <q-spinner-dots size="48px" color="positive" />
            </div>
            <div v-else class="empty-state">
              <q-icon name="description" size="32px" />
              เลือกปี แล้วกด "สร้างรายงาน"
            </div>
          </q-tab-panel>

          <!-- ============================ Executive =============================== -->
          <q-tab-panel name="executive" class="report-panel">
            <q-banner v-if="executive.error" rounded class="bg-red-1 text-red-9 q-mb-md">
              {{ executive.error }}
              <template #action>
                <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadExecutive" />
              </template>
            </q-banner>

            <div v-else-if="executive.loading && !executive.data" class="loading-wrap">
              <q-spinner-dots size="48px" color="positive" />
            </div>

            <template v-else-if="executive.data">
              <div class="report-title">
                รายงานสรุปสำหรับผู้บริหาร
                <span class="report-stamp">ข้อมูล ณ {{ formatThaiDateTime(executive.data.generatedAt) }}</span>
              </div>

              <div class="stat-grid">
                <article v-for="card in executiveCards" :key="card.label" class="summary-card stat-card">
                  <div :class="['summary-icon', card.iconClass]">
                    <q-icon :name="card.icon" />
                  </div>
                  <div class="summary-content">
                    <div class="summary-label">{{ card.label }}</div>
                    <div class="summary-value stat-value">
                      {{ card.value }}
                      <span>{{ card.unit }}</span>
                    </div>
                    <div v-if="card.hint" class="summary-hint">{{ card.hint }}</div>
                  </div>
                </article>
              </div>

              <div class="report-grid">
                <div class="sub-panel">
                  <div class="sub-panel-title">แนวโน้ม 6 เดือนล่าสุด (มูลค่าขาย, บาท)</div>
                  <apexchart
                    v-if="executiveTrendCategories.length"
                    type="area"
                    height="280"
                    :options="executiveTrendOptions"
                    :series="executiveTrendSeries"
                  />
                  <div v-else class="empty-state">ยังไม่มีข้อมูลการขาย</div>
                </div>
                <div class="sub-panel">
                  <div class="sub-panel-title">ประเภทขยะสะสมสูงสุด</div>
                  <q-table
                    flat
                    dense
                    row-key="wasteTypeId"
                    hide-pagination
                    class="muni-table"
                    :rows="executive.data.trends.topWasteTypes"
                    :columns="wasteTypeColumns"
                    :rows-per-page-options="[0]"
                  >
                    <template #no-data>
                      <div class="full-width empty-state">ยังไม่มีข้อมูล</div>
                    </template>
                  </q-table>
                </div>
              </div>
            </template>
          </q-tab-panel>
        </q-tab-panels>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import apexchart from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useMunicipalityStore, type WasteTypeBreakdown, type YearlyBreakdownRow } from 'src/stores/municipalityStore';
import {
  THAI_MONTH_NAMES,
  formatBaht,
  formatMonthKey,
  formatQuantity,
  formatThaiDateTime,
} from './format';

const store = useMunicipalityStore();
const monthly = computed(() => store.monthlyReport);
const yearly = computed(() => store.yearlyReport);
const executive = computed(() => store.executiveReport);

const tab = ref<'monthly' | 'yearly' | 'executive'>('monthly');

const now = new Date();
const currentYear = now.getFullYear();
const monthlyYear = ref(currentYear);
const monthlyMonth = ref(now.getMonth() + 1);
const yearlyYear = ref(currentYear);

const yearOptions = Array.from({ length: 5 }, (_, index) => {
  const value = currentYear - index;
  return { value, label: `${value} (พ.ศ. ${value + 543})` };
});
const monthOptions = THAI_MONTH_NAMES.map((label, index) => ({ value: index + 1, label }));

function loadMonthly() {
  void store.fetchMonthlyReport(monthlyYear.value, monthlyMonth.value);
}

function loadYearly() {
  void store.fetchYearlyReport(yearlyYear.value);
}

function loadExecutive() {
  void store.fetchExecutiveReport();
}

// Executive tab loads on first open (monthly/yearly wait for the user's period pick).
watch(tab, (value) => {
  if (value === 'executive' && !executive.value.data && !executive.value.loading) {
    loadExecutive();
  }
});

const monthlyCards = computed(() => {
  const data = monthly.value.data;
  if (!data) return [];
  return [
    {
      label: 'ยอดขายรวม',
      value: formatBaht(data.operations.totalAmount),
      unit: 'บาท',
      hint: `${data.operations.completedSaleCount} ครั้ง`,
      icon: 'paid',
      iconClass: 'icon-green',
    },
    {
      // Σ waste_sale.net_amount: what was left for the member after the fund
      // deduction, whether they took it in cash or left it in the fund.
      label: 'ยอดหลังเติมเงินสะสม',
      value: formatBaht(data.operations.totalNetPaid),
      unit: 'บาท',
      hint: `เติมเงินสะสมให้ครบขั้นต่ำ ${formatBaht(data.operations.totalFundDeduct)} บาท`,
      icon: 'account_balance_wallet',
      iconClass: 'icon-green',
    },
    {
      label: 'ปริมาณขยะ',
      value: formatQuantity(data.operations.totalQuantity),
      unit: 'กก.',
      hint: `สมาชิกร่วมขาย ${data.operations.memberParticipatedCount} คน`,
      icon: 'scale',
      iconClass: 'icon-amber',
    },
    {
      label: 'สมาชิกสะสม ณ สิ้นงวด',
      value: data.members.total.toLocaleString(),
      unit: 'คน',
      hint: `สมัครใหม่ ${data.members.newInPeriod} | อนุมัติ ${data.members.approvedInPeriod}`,
      icon: 'people',
      iconClass: 'icon-blue',
    },
  ];
});

const monthlyTrendRows = computed(() => {
  const data = monthly.value.data;
  if (!data) return [];
  return [
    {
      label: 'มูลค่าขาย',
      change: data.trends.totalAmountChange,
      display: `${data.trends.totalAmountChange >= 0 ? '+' : ''}${formatBaht(data.trends.totalAmountChange)} บาท`,
    },
    {
      label: 'ปริมาณขยะ',
      change: data.trends.totalQuantityChange,
      display: `${data.trends.totalQuantityChange >= 0 ? '+' : ''}${formatQuantity(data.trends.totalQuantityChange)} กก.`,
    },
    {
      label: 'จำนวนครั้งที่ขาย',
      change: data.trends.saleCountChange,
      display: `${data.trends.saleCountChange >= 0 ? '+' : ''}${data.trends.saleCountChange} ครั้ง`,
    },
  ];
});

const yearlyCards = computed(() => {
  const data = yearly.value.data;
  if (!data) return [];
  return [
    {
      label: 'ยอดขายรวมทั้งปี',
      value: formatBaht(data.operations.totalAmount),
      unit: 'บาท',
      hint: `${data.operations.completedSaleCount} ครั้ง`,
      icon: 'paid',
      iconClass: 'icon-green',
    },
    {
      label: 'ปริมาณขยะทั้งปี',
      value: formatQuantity(data.operations.totalQuantity),
      unit: 'กก.',
      hint: `สมาชิกร่วมขาย ${data.operations.memberParticipatedCount} คน`,
      icon: 'scale',
      iconClass: 'icon-amber',
    },
    {
      label: 'กองทุน รับ/จ่าย',
      value: `+${formatBaht(data.fund.totalIn)} / -${formatBaht(data.fund.totalOut)}`,
      unit: 'บาท',
      hint: `ยอด ณ สิ้นปี ${formatBaht(data.fund.balanceAtPeriodEnd)} บาท`,
      icon: 'savings',
      iconClass: 'icon-blue',
    },
    {
      label: 'สมาชิกสะสม ณ สิ้นปี',
      value: data.members.total.toLocaleString(),
      unit: 'คน',
      hint: `สมัครใหม่ในปี ${data.members.newInPeriod} คน`,
      icon: 'people',
      iconClass: 'icon-blue',
    },
  ];
});

const yearlyChartSeries = computed(() => [
  {
    name: 'มูลค่าขาย (บาท)',
    data: yearly.value.data?.monthlyBreakdown.map((row) => row.totalAmount) ?? [],
  },
]);

const yearlyChartOptions = computed<ApexOptions>(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
  colors: ['#21BA45'],
  dataLabels: { enabled: false },
  xaxis: { categories: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] },
  yaxis: { labels: { formatter: (value: number) => formatBaht(value) } },
  tooltip: { y: { formatter: (value: number) => `${formatBaht(value)} บาท` } },
}));

const executiveCards = computed(() => {
  const data = executive.value.data;
  if (!data) return [];
  return [
    {
      label: 'สมาชิกทั้งหมด',
      value: data.members.total.toLocaleString(),
      unit: 'คน',
      hint: `ใช้งาน ${data.members.byStatus['active'] ?? 0} | ใหม่เดือนนี้ ${data.members.newThisMonth}`,
      icon: 'people',
      iconClass: 'icon-blue',
    },
    {
      label: 'ยอดขายขยะสะสม',
      value: formatBaht(data.operations.totalAmount),
      unit: 'บาท',
      hint: `${data.operations.completedSaleCount} ครั้ง | ${formatQuantity(data.operations.totalQuantity)} กก.`,
      icon: 'recycling',
      iconClass: 'icon-green',
    },
    {
      label: 'ยอดหลังเติมเงินสะสม',
      value: formatBaht(data.operations.totalNetPaid),
      unit: 'บาท',
      hint: `เติมเงินสะสมให้ครบขั้นต่ำ ${formatBaht(data.operations.totalFundDeduct)} บาท`,
      icon: 'account_balance_wallet',
      iconClass: 'icon-green',
    },
    {
      // Members' savings added up, matching the municipality dashboard card.
      label: 'เงินสะสมของสมาชิก',
      value: formatBaht(data.fund.contributionBalance),
      unit: 'บาท',
      hint: `เงินสะสมยังไม่ครบ ${data.fund.belowMinimumCount} คน | หักจ่ายฌาปนกิจแล้ว ${data.fund.welfarePayments.count} ครั้ง`,
      icon: 'account_balance',
      iconClass: 'icon-green',
    },
  ];
});

const executiveTrendCategories = computed(
  () => executive.value.data?.trends.last6Months.map((point) => formatMonthKey(point.month)) ?? [],
);

const executiveTrendSeries = computed(() => [
  {
    name: 'มูลค่าขาย (บาท)',
    data: executive.value.data?.trends.last6Months.map((point) => point.totalAmount) ?? [],
  },
]);

const executiveTrendOptions = computed<ApexOptions>(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
  colors: ['#21BA45'],
  dataLabels: { enabled: true, formatter: (value: number) => formatBaht(value) },
  markers: { size: 4 },
  xaxis: { categories: executiveTrendCategories.value },
  yaxis: { labels: { formatter: (value: number) => formatBaht(value) } },
  tooltip: { y: { formatter: (value: number) => `${formatBaht(value)} บาท` } },
}));

const wasteTypeColumns = [
  { name: 'wasteName', align: 'left' as const, label: 'ประเภทขยะ', field: 'wasteName' },
  {
    name: 'quantity',
    align: 'right' as const,
    label: 'ปริมาณ',
    field: (row: WasteTypeBreakdown) => `${formatQuantity(row.quantity)} ${row.unit}`,
  },
  {
    name: 'amount',
    align: 'right' as const,
    label: 'มูลค่า (บาท)',
    field: (row: WasteTypeBreakdown) => formatBaht(row.amount),
  },
];

const breakdownColumns = [
  {
    name: 'month',
    align: 'left' as const,
    label: 'เดือน',
    field: (row: YearlyBreakdownRow) => THAI_MONTH_NAMES[row.month - 1] ?? String(row.month),
  },
  { name: 'saleCount', align: 'right' as const, label: 'ขาย (ครั้ง)', field: 'saleCount' },
  {
    name: 'quantity',
    align: 'right' as const,
    label: 'ปริมาณ (กก.)',
    field: (row: YearlyBreakdownRow) => formatQuantity(row.quantity),
  },
  {
    name: 'totalAmount',
    align: 'right' as const,
    label: 'มูลค่าขาย (บาท)',
    field: (row: YearlyBreakdownRow) => formatBaht(row.totalAmount),
  },
  {
    name: 'netAmount',
    align: 'right' as const,
    label: 'หลังหักกองทุน (บาท)',
    field: (row: YearlyBreakdownRow) => formatBaht(row.netAmount),
  },
  {
    name: 'fundIn',
    align: 'right' as const,
    label: 'กองทุนรับ (บาท)',
    field: (row: YearlyBreakdownRow) => formatBaht(row.fundIn),
  },
  {
    name: 'fundOut',
    align: 'right' as const,
    label: 'กองทุนจ่าย (บาท)',
    field: (row: YearlyBreakdownRow) => formatBaht(row.fundOut),
  },
];

onMounted(() => {
  // Default the monthly tab to the current month's report right away.
  loadMonthly();
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

.report-tabs {
  padding: 6px 12px 0;
}

.report-tabs :deep(.q-tab__label) {
  font-weight: 900;
}

.report-panels {
  background: transparent;
}

.report-panel {
  padding: 24px 28px 28px;
}

.picker-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.picker-item {
  flex: 0 1 200px;
  min-width: 160px;
}

.picker-btn {
  border-radius: 10px;
  min-height: 40px;
}

.report-title {
  margin-bottom: 18px;
  color: #111f18;
  font-size: 19px;
  font-weight: 950;
}

.report-stamp {
  margin-left: 10px;
  color: #98a19d;
  font-size: 12.5px;
  font-weight: 800;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  min-height: 104px;
  padding: 16px 18px;
  gap: 12px;
  box-shadow: none;
  border: 1px solid rgba(7, 95, 56, 0.1);
}

.stat-card .summary-icon {
  width: 48px;
  height: 48px;
  min-width: 48px;
  font-size: 24px;
}

.stat-value {
  font-size: 19px;
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.sub-panel {
  padding: 18px 20px;
  background: #fbfdfb;
  border: 1px solid rgba(7, 95, 56, 0.1);
  border-radius: 14px;
}

.sub-panel-title {
  margin-bottom: 12px;
  color: #111f18;
  font-size: 15.5px;
  font-weight: 950;
}

.trend-list {
  display: grid;
  gap: 4px;
}

.trend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  color: #3e4c45;
  font-size: 14px;
  font-weight: 800;
  border-bottom: 1px solid rgba(7, 95, 56, 0.08);
}

.trend-item:last-child {
  border-bottom: none;
}

.trend-item--total {
  color: #111f18;
  font-weight: 950;
}

.trend-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 950;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .report-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .report-panel {
    padding: 18px 16px 22px;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
