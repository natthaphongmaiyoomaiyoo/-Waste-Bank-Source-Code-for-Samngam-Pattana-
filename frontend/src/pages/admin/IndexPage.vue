<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="admin_panel_settings" />
          </div>
          <div class="hero-copy">
            <h1>สวัสดี, ผู้ดูแลระบบ</h1>
          </div>
        </div>
      </section>

      <section class="summary-grid">
        <article v-for="card in summaryCards" :key="card.title" class="summary-card">
          <div :class="['summary-icon', card.iconClass]">
            <q-icon :name="card.icon" />
          </div>
          <div class="summary-content">
            <div class="summary-label">{{ card.title }}</div>
            <div class="summary-value">
              {{ card.value }}
              <span>{{ card.unit }}</span>
            </div>
            <div class="summary-hint">{{ card.subText }}</div>
          </div>
        </article>
      </section>

      <!-- Shortcut tiles: the same tile as the committee dashboard and the
           member home page (icon over label, first one filled). -->
      <nav class="menu-actions" aria-label="เมนูลัดผู้ดูแลระบบ">
        <q-btn
          v-for="item in quickMenus"
          :key="item.to"
          unelevated
          no-caps
          stack
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          :class="['menu-action', { 'is-primary': item.primary }]"
        />
      </nav>

      <section class="dashboard-grid">
        <q-card flat class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-title">สมาชิกที่มียอดเงินต่ำ</div>
            </div>
            <q-btn
              color="positive"
              flat
              dense
              no-caps
              label="ดูทั้งหมด"
              icon-right="chevron_right"
              to="/admin/members"
            />
          </div>

          <q-scroll-area v-if="dashboardStore.lowBalanceMembers.length" style="height: 300px;" class="q-pr-sm">
            <div class="rank-list">
              <div
                v-for="member in dashboardStore.lowBalanceMembers"
                :key="member.id"
                class="rank-item"
              >
                <q-avatar color="grey-2" text-color="grey-8" size="36px" class="q-mr-md">
                  {{ member.name.charAt(0) }}
                </q-avatar>
                <div class="rank-info">
                  <div class="rank-name">{{ member.name }}</div>
                  <div class="rank-caption">หมู่บ้าน ID: {{ member.villageId }}</div>
                </div>
                <div class="rank-amount text-negative">{{ member.balance.toFixed(2) }} ฿</div>
                <q-btn flat dense round color="orange-8" icon="notifications_active" size="sm" class="q-ml-sm">
                  <q-tooltip>แจ้งเตือน</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-scroll-area>
          <div v-else class="empty-state" style="height: 300px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <q-icon name="check_circle_outline" size="32px" color="positive" class="q-mb-sm" />
            <div>ไม่มีสมาชิกที่ยอดเงินต่ำกว่า 50 บาท</div>
          </div>
        </q-card>

        <q-card flat class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-title">แนวโน้มการรับซื้อ</div>
              <div class="panel-caption">ยอดสะสม 6 เดือนที่ผ่านมา</div>
            </div>
          </div>
          <apexchart type="area" height="300" :options="chartOptions" :series="chartSeries" />
        </q-card>
      </section>

      <section class="eligibility-section">
        <q-card flat class="panel-card">
          <div class="panel-head eligibility-head">
            <div>
              <div class="panel-title">ตรวจสอบคุณสมบัติสมาชิก</div>
              <div class="panel-caption">
                เงื่อนไข: เงินสะสม ≥ 50 บาท • อายุสมาชิก ≥ 6 เดือน • ขายขยะ ≥ 6 เดือน
                จาก 12 เดือนล่าสุด
              </div>
            </div>

            <div class="eligibility-actions">
              <template v-if="dashboardStore.eligibility">
                <q-badge color="green-2" text-color="positive" class="q-px-sm q-py-xs" rounded>
                  ผ่าน {{ dashboardStore.eligibility.summary.eligible }} คน
                </q-badge>
                <q-badge color="red-2" text-color="red-8" class="q-px-sm q-py-xs" rounded>
                  ไม่ผ่าน {{ dashboardStore.eligibility.summary.notEligible }} คน
                </q-badge>
              </template>
              <q-btn
                flat
                dense
                round
                icon="refresh"
                color="positive"
                :loading="dashboardStore.eligibilityLoading"
                @click="dashboardStore.fetchMembersEligibility"
              >
                <q-tooltip>ตรวจสอบใหม่</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Result filter: MidFilterBar like every other list (no search box
               here, so it renders as its own "ตัวกรอง" button). -->
          <div class="eligibility-filter">
            <MidFilterBar
              title="กรองผลการตรวจสอบ"
              :active="eligibilityActiveFilters"
              @clear="eligibilityFilter = 'all'"
              @clear-all="eligibilityFilter = 'all'"
            >
              <q-select
                v-model="eligibilityFilter"
                dense
                outlined
                emit-value
                map-options
                label="ผลการตรวจสอบ"
                :options="eligibilityFilterOptions"
              />
            </MidFilterBar>
          </div>

          <div v-if="dashboardStore.eligibilityError" class="empty-state">
            <q-icon name="cloud_off" size="32px" color="red-7" />
            {{ dashboardStore.eligibilityError }}
            <q-btn
              outline
              no-caps
              dense
              color="positive"
              label="ลองใหม่"
              class="q-mt-sm"
              @click="dashboardStore.fetchMembersEligibility"
            />
          </div>

          <q-table
            v-else
            flat
            dense
            row-key="memberId"
            class="muni-table"
            :rows="eligibilityRows"
            :columns="eligibilityColumns"
            :loading="dashboardStore.eligibilityLoading"
            v-model:pagination="eligibilityPagination"
            :rows-per-page-options="eligibilityRowsOptions"
          >
            <template #pagination="scope">
              <MidTablePagination
                :pagination="scope.pagination"
                :pages-number="scope.pagesNumber"
              />
            </template>
            <template #body-cell-fund="props">
              <q-td :props="props">
                <q-chip
                  dense
                  :color="props.row.fundCheck.passed ? 'green-1' : 'red-1'"
                  :text-color="props.row.fundCheck.passed ? 'positive' : 'red-8'"
                  :icon="props.row.fundCheck.passed ? 'check' : 'close'"
                  class="text-weight-bold"
                >
                  {{ props.row.fundCheck.amount.toFixed(2) }} ฿
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-tenure="props">
              <q-td :props="props">
                <q-chip
                  dense
                  :color="props.row.membershipAgeCheck.passed ? 'green-1' : 'red-1'"
                  :text-color="props.row.membershipAgeCheck.passed ? 'positive' : 'red-8'"
                  :icon="props.row.membershipAgeCheck.passed ? 'check' : 'close'"
                  class="text-weight-bold"
                >
                  {{ props.row.membershipAgeCheck.months }} เดือน
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-activity="props">
              <q-td :props="props">
                <q-chip
                  dense
                  :color="props.row.wasteSaleActivityCheck.passed ? 'green-1' : 'red-1'"
                  :text-color="props.row.wasteSaleActivityCheck.passed ? 'positive' : 'red-8'"
                  :icon="props.row.wasteSaleActivityCheck.passed ? 'check' : 'close'"
                  class="text-weight-bold"
                >
                  {{ props.row.wasteSaleActivityCheck.activeMonths }}/{{
                    props.row.wasteSaleActivityCheck.required
                  }}
                  เดือน
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.eligible ? 'green-2' : 'red-2'"
                  :text-color="props.row.eligible ? 'positive' : 'red-8'"
                  class="q-px-sm q-py-xs text-weight-bold"
                  rounded
                >
                  {{ props.row.eligible ? 'ผ่านคุณสมบัติ' : 'ไม่ผ่านคุณสมบัติ' }}
                </q-badge>
              </q-td>
            </template>

            <template #body-cell-reason="props">
              <q-td :props="props">
                <template v-if="props.row.reason.length">
                  <div
                    v-for="line in props.row.reason"
                    :key="line"
                    class="eligibility-reason-line"
                  >
                    • {{ line }}
                  </div>
                </template>
                <span v-else class="text-grey-5">—</span>
              </q-td>
            </template>

            <template #no-data>
              <div class="full-width empty-state">
                <q-icon name="how_to_reg" size="32px" />
                {{
                  eligibilityFilter === 'failed'
                    ? 'ไม่มีสมาชิกที่ไม่ผ่านคุณสมบัติ'
                    : 'ยังไม่มีข้อมูลสมาชิก'
                }}
              </div>
            </template>
          </q-table>
        </q-card>
      </section>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { QTableProps } from 'quasar';
import { useDashboardStore, type MemberEligibilityResult } from 'src/stores/dashboard';
import apexchart from 'vue3-apexcharts';
import {
  MidFilterBar,
  midOptionLabel,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  midRowsPerPageOptions,
} from 'components/MID';
import type { ApexOptions } from 'apexcharts';

const eligibilityPagination = useRememberedPagination('admin-dashboard-eligibility', {
  rowsPerPage: 8,
});
// 5/10/20/50 plus this table's own default of 8.
const eligibilityRowsOptions = midRowsPerPageOptions(8);

const dashboardStore = useDashboardStore();

onMounted(() => {
  void dashboardStore.fetchAdminDashboard();
  void dashboardStore.fetchMembersEligibility();
});

const eligibilityFilter = ref<'all' | 'failed' | 'passed'>('all');
const eligibilityFilterOptions: { label: string; value: 'all' | 'failed' | 'passed' }[] = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'ไม่ผ่าน', value: 'failed' },
  { label: 'ผ่าน', value: 'passed' },
];
// 'ทั้งหมด' is the starting point, so only ผ่าน / ไม่ผ่าน count as a filter.
const eligibilityActiveFilters = computed<MidActiveFilter[]>(() =>
  eligibilityFilter.value !== 'all'
    ? [
        {
          key: 'result',
          label: 'ผลการตรวจสอบ',
          value: midOptionLabel(eligibilityFilterOptions, eligibilityFilter.value),
        },
      ]
    : [],
);

const eligibilityRows = computed(() => {
  const results = dashboardStore.eligibility?.results ?? [];
  if (eligibilityFilter.value === 'failed') return results.filter((r) => !r.eligible);
  if (eligibilityFilter.value === 'passed') return results.filter((r) => r.eligible);
  return results;
});

const eligibilityColumns: QTableProps['columns'] = [
  { name: 'memberCode', label: 'รหัสสมาชิก', field: 'memberCode', align: 'left', sortable: true },
  { name: 'fullName', label: 'ชื่อ-นามสกุล', field: 'fullName', align: 'left' },
  {
    name: 'fund',
    label: 'เงินสะสม (≥ 50 ฿)',
    field: (row: MemberEligibilityResult) => row.fundCheck.amount,
    align: 'center',
    sortable: true,
  },
  {
    name: 'tenure',
    label: 'อายุสมาชิก (≥ 6 เดือน)',
    field: (row: MemberEligibilityResult) => row.membershipAgeCheck.months,
    align: 'center',
    sortable: true,
  },
  {
    name: 'activity',
    label: 'เดือนที่ขายขยะ (12 เดือนล่าสุด)',
    field: (row: MemberEligibilityResult) => row.wasteSaleActivityCheck.activeMonths,
    align: 'center',
    sortable: true,
  },
  { name: 'status', label: 'ผลการตรวจสอบ', field: 'eligible', align: 'center', sortable: true },
  { name: 'reason', label: 'สาเหตุที่ไม่ผ่าน', field: 'reason', align: 'left' },
];

const summaryCards = computed(() => [
  {
    title: 'เงินกองทุนรวม',
    value: dashboardStore.summary.totalBalance.toLocaleString(),
    unit: '฿',
    icon: 'account_balance',
    iconClass: 'icon-green',
    subText: 'เพิ่มขึ้น 12% จากเดือนก่อน',
  },
  {
    title: 'สมาชิกทั้งหมด',
    value: dashboardStore.summary.memberCount.toLocaleString(),
    unit: 'คน',
    icon: 'people',
    iconClass: 'icon-blue',
    subText: 'สมาชิกใหม่ +5 คนวันนี้',
  },
  {
    title: 'นัดหมายครั้งถัดไป',
    value: dashboardStore.summary.nextCollectionDate,
    unit: '',
    icon: 'event',
    iconClass: 'icon-amber',
    subText: `อีก ${dashboardStore.summary.daysRemaining} วัน`,
  },
]);

const quickMenus = [
  { label: 'รอบรับซื้อขยะ', to: '/admin/rounds', icon: 'event_available', primary: true },
  { label: 'ผู้ใช้งานระบบ', to: '/admin/users', icon: 'manage_accounts', primary: false },
  { label: 'ประเภทขยะ', to: '/waste-types', icon: 'recycling', primary: false },
  { label: 'จัดการข่าวสาร', to: '/manage-news', icon: 'article', primary: false },
];

const chartSeries = computed(() => [
  {
    name: 'ยอดรับซื้อ (บาท)',
    data: dashboardStore.chartSeriesData.length ? dashboardStore.chartSeriesData : [0, 0, 0, 0, 0, 0]
  }
]);

const chartOptions = computed<ApexOptions>(() => {
  return {
    chart: { toolbar: { show: false }, fontFamily: 'inherit' },
    stroke: { curve: 'smooth', width: 3, lineCap: 'round' },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.14, opacityTo: 0.02 } },
    colors: ['#0b8a4d'],
    dataLabels: { enabled: false },
    markers: { size: 4, strokeColors: '#ffffff', strokeWidth: 2, hover: { size: 6 } },
    grid: { borderColor: '#edf2ee', strokeDashArray: 0 },
    xaxis: {
      categories: dashboardStore.chartCategories.length ? dashboardStore.chartCategories : ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#84918a', fontSize: '12px' } },
    },
    yaxis: {
      labels: {
        formatter: (value: number) => value.toLocaleString(),
        style: { colors: '#84918a', fontSize: '12px' },
      },
    },
    tooltip: { y: { formatter: (value: number) => `${value.toLocaleString()} บาท` } },
  };
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

// --- Menu tiles ---------------------------------------------------------------------
// Same tile as the committee dashboard / member home page: icon over label, one
// tap to the page. auto-fit keeps them on one row on a desktop and folds them to
// two per row on a phone.

.menu-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.menu-action {
  min-height: 96px;
  padding: 14px 10px;
  color: #18231e;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(7, 95, 56, 0.12);
  border-radius: 16px;
  box-shadow: 0 10px 26px rgba(35, 74, 49, 0.06);
  font-size: 16px;
  font-weight: 900;
}

.menu-action :deep(.q-icon) {
  margin-bottom: 6px;
  color: #087f49;
  font-size: 30px;
}

.menu-action.is-primary {
  color: #ffffff;
  background: linear-gradient(135deg, #00693f, #0a9a52);
  border-color: transparent;
  box-shadow: 0 14px 30px rgba(7, 95, 56, 0.22);
}

.menu-action.is-primary :deep(.q-icon) {
  color: #ffffff;
}

.eligibility-filter {
  margin: 16px 0 8px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 1fr);
  gap: 18px;
  margin-top: 24px;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.rank-list {
  display: grid;
  gap: 14px;
  margin-top: 10px;
}

.rank-item {
  display: flex;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid #ecf1ed;
}

.rank-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.rank-info {
  min-width: 0;
  flex: 1;
}

.rank-name {
  color: #26352d;
  font-size: 14.5px;
  font-weight: 600;
}

.rank-caption {
  margin-top: 3px;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 500;
}

.rank-amount {
  font-size: 14.5px;
  font-weight: 700;
  white-space: nowrap;
}

.eligibility-section {
  margin-top: 18px;
}

.eligibility-head {
  flex-wrap: wrap;
  gap: 12px;
}

.eligibility-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.eligibility-reason-line {
  color: #b3423a;
  font-size: 12.5px;
  line-height: 1.5;
  white-space: normal;
}

@media (max-width: 1180px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .menu-actions {
    gap: 12px;
  }

  .menu-action {
    min-height: 84px;
    font-size: 15px;
  }
}
</style>
