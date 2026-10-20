<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <q-banner v-if="detail.error" rounded class="bg-red-1 text-red-9 error-banner">
        {{ detail.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="load" />
        </template>
      </q-banner>

      <div v-else-if="detail.loading || !detail.data" class="loading-wrap">
        <q-spinner-dots size="48px" color="positive" />
      </div>

      <template v-else>
        <section class="muni-hero profile-hero">
          <div class="hero-leaf hero-leaf-one"></div>
          <div class="hero-leaf hero-leaf-two"></div>

          <div class="hero-row hero-top">
            <q-btn flat round dense icon="arrow_back" class="hero-back" to="/municipality/members">
              <q-tooltip>กลับหน้ารายชื่อสมาชิก</q-tooltip>
            </q-btn>
            <div class="hero-brand">
              <q-icon name="eco" />
              ธนาคารขยะรีไซเคิล
            </div>
          </div>

          <div class="hero-profile">
            <q-avatar class="profile-avatar" size="96px">
              <img v-if="avatarSrc" :src="avatarSrc" alt="รูปโปรไฟล์สมาชิก" @error="avatarFailed = true" />
              <q-icon v-else name="person" />
            </q-avatar>
            <div class="profile-copy">
              <div class="profile-chips">
                <div class="member-chip">
                  <q-icon name="badge" />
                  รหัสสมาชิก {{ detail.data.member.memberCode }}
                </div>
                <div class="member-chip" :class="`chip-${detail.data.member.status}`">
                  <q-icon name="check_circle" />
                  {{ memberStatusLabel(detail.data.member.status) }}
                </div>
              </div>
              <h1>{{ memberFullName(detail.data.member) }}</h1>
              <p>
                หมู่ {{ detail.data.member.household?.moo ?? '-' }}
                {{ detail.data.member.household?.subdistrict ?? '' }}
              </p>
            </div>
          </div>
        </section>

        <section class="summary-grid stats-grid">
          <article v-for="card in participationCards" :key="card.label" class="summary-card stat-card">
            <div :class="['summary-icon', card.iconClass]">
              <q-icon :name="card.icon" />
            </div>
            <div class="summary-content">
              <div class="summary-label">{{ card.label }}</div>
              <div class="summary-value stat-value">
                {{ card.value }}
                <span>{{ card.unit }}</span>
              </div>
            </div>
          </article>
        </section>

        <section class="detail-grid">
          <q-card flat class="panel-card panel-card--flush">
            <div class="panel-head">
              <div>
                <div class="panel-title">ข้อมูลส่วนตัวและครัวเรือน</div>
              </div>
            </div>
            <div class="info-body">
              <section v-for="group in profileGroups" :key="group.title" class="info-group">
                <div class="info-group-title">{{ group.title }}</div>
                <div class="info-grid">
                  <div
                    v-for="item in group.items"
                    :key="item.label"
                    :class="['info-item', { 'info-item--wide': item.wide }]"
                  >
                    <div class="info-icon">
                      <q-icon :name="item.icon" />
                    </div>
                    <div class="info-text">
                      <div class="info-label">{{ item.label }}</div>
                      <div :class="['info-value', { 'is-empty': item.empty }]">
                        <span v-if="item.chip" :class="['info-chip', `info-chip--${item.chip}`]">
                          {{ item.value }}
                        </span>
                        <template v-else>{{ item.value }}</template>
                      </div>
                      <div v-if="item.sub" class="info-sub">{{ item.sub }}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </q-card>

          <div class="detail-side">
            <q-card flat class="panel-card">
              <div class="panel-head">
                <div>
                  <div class="panel-title">สิทธิสวัสดิการ</div>
                  <div class="panel-caption">ตรวจจากข้อมูล ณ วันนี้</div>
                </div>
                <div
                  v-if="detail.data.eligibility"
                  class="eligibility-chip"
                  :class="detail.data.eligibility.eligible ? 'is-pass' : 'is-wait'"
                >
                  <q-icon :name="detail.data.eligibility.eligible ? 'verified' : 'hourglass_top'" />
                  {{ detail.data.eligibility.eligible ? 'ผ่านเงื่อนไข' : 'ยังไม่ผ่านเงื่อนไข' }}
                </div>
              </div>
              <!-- One line per condition, so the officer sees which one holds a
                   member back instead of reading a joined reason string. -->
              <ul v-if="eligibilityRules.length" class="rule-list">
                <li
                  v-for="rule in eligibilityRules"
                  :key="rule.key"
                  :class="['rule-item', rule.passed ? 'is-pass' : 'is-fail']"
                >
                  <span class="rule-mark">
                    <q-icon :name="rule.passed ? 'check' : 'close'" />
                  </span>
                  <div class="rule-text">
                    <div class="rule-title">{{ rule.title }}</div>
                    <div class="rule-detail">{{ rule.detail }}</div>
                  </div>
                </li>
              </ul>
              <div v-else class="summary-hint q-mt-md">ยังไม่มีข้อมูลการตรวจสิทธิ</div>
            </q-card>

            <q-card flat class="panel-card q-mt-lg">
              <div class="panel-head">
                <div>
                  <div class="panel-title">รายการกองทุนล่าสุด</div>
                  <div class="panel-caption">เรียงจากรายการล่าสุด</div>
                </div>
              </div>

              <q-banner v-if="txns.error" rounded class="bg-red-1 text-red-9 q-mt-md">
                {{ txns.error }}
                <template #action>
                  <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadTxns(txnPage)" />
                </template>
              </q-banner>

              <div v-else-if="txns.loading && !txns.data" class="loading-wrap">
                <q-spinner-dots size="36px" color="positive" />
              </div>

              <template v-else-if="txnRows.length">
                <!-- Dimmed, not emptied, while the next page loads (keepData). -->
                <div :class="['txn-list', { 'is-loading': txns.loading }]">
                  <div v-for="txn in txnRows" :key="txn.id" class="txn-item">
                    <div class="list-icon" :class="txn.amountIn > 0 ? 'icon-green' : 'icon-red'">
                      <q-icon :name="txn.amountIn > 0 ? 'savings' : 'volunteer_activism'" />
                    </div>
                    <div class="txn-info">
                      <div class="txn-title">{{ fundTypeLabel(txn.transactionType) }}</div>
                      <div class="txn-date">{{ formatThaiDate(txn.transactionDate) }}</div>
                    </div>
                    <div :class="txn.amountIn > 0 ? 'text-positive' : 'text-negative'" class="txn-amount">
                      {{ txn.amountIn > 0 ? '+' : '-' }}{{ formatBaht(txn.amountIn > 0 ? txn.amountIn : txn.amountOut) }} บาท
                    </div>
                  </div>
                </div>

                <div class="list-pager">
                  <span class="list-pager-info">
                    แสดง {{ txnRange.start }}–{{ txnRange.end }} จาก {{ txnTotal.toLocaleString('th-TH') }} รายการ
                  </span>
                  <q-pagination
                    v-if="txnTotalPages > 1"
                    :model-value="txnPage"
                    :max="txnTotalPages"
                    :max-pages="5"
                    boundary-numbers
                    direction-links
                    flat
                    color="grey-7"
                    active-color="positive"
                    @update:model-value="(page: number) => loadTxns(page, true)"
                  />
                </div>
              </template>

              <div v-else class="empty-state">
                <q-icon name="savings" size="32px" />
                ยังไม่มีรายการกองทุน
              </div>
            </q-card>
          </div>
        </section>

        <q-card flat class="panel-card panel-card--flush q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title">ประวัติการขายขยะล่าสุด</div>
            </div>
          </div>

          <q-banner v-if="sales.error" rounded class="bg-red-1 text-red-9 q-ma-md">
            {{ sales.error }}
            <template #action>
              <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadSales(salePage)" />
            </template>
          </q-banner>

          <div v-else-if="sales.loading && !sales.data" class="loading-wrap">
            <q-spinner-dots size="36px" color="positive" />
          </div>

          <template v-else>
            <!-- Phone: grid mode draws one card per sale (#item) instead of rows.
                 Paged by the pager below, so the table's own is hidden. -->
            <q-table
              flat
              row-key="id"
              hide-pagination
              :class="['muni-table', 'sale-table', { 'is-loading': sales.loading }]"
              card-container-class="sale-cards"
              :grid="isPhone"
              :rows="saleRows"
              :columns="saleColumns"
              :rows-per-page-options="[0]"
            >
              <template #item="props">
                <article class="sale-card">
                  <div class="sale-card-head">
                    <div class="sale-no">{{ props.row.saleNo }}</div>
                    <div class="sale-date">{{ formatThaiDate(props.row.saleDate) }}</div>
                  </div>
                  <div class="sale-items">
                    <span
                      v-for="(item, index) in (props.row as MuniSale).details"
                      :key="index"
                      class="sale-item"
                    >
                      {{ item.wasteType.wasteName }} · {{ formatQuantity(item.quantity) }} {{ item.wasteType.unit }}
                    </span>
                  </div>
                  <div class="sale-card-foot">
                    <div class="sale-figure">
                      <span class="sale-figure-label">มูลค่า</span>
                      <span class="sale-figure-value">{{ formatBaht(props.row.totalAmount) }} บาท</span>
                    </div>
                    <div class="sale-figure">
                      <span class="sale-figure-label">หลังหักกองทุน</span>
                      <span class="sale-figure-value is-money">{{ formatBaht(props.row.netAmount) }} บาท</span>
                    </div>
                  </div>
                </article>
              </template>
              <template #no-data>
                <div class="full-width empty-state">
                  <q-icon name="inbox" size="32px" />
                  ยังไม่มีประวัติการขาย
                </div>
              </template>
            </q-table>

            <div v-if="saleTotal > 0" class="list-pager list-pager--flush">
              <span class="list-pager-info">
                แสดง {{ saleRange.start }}–{{ saleRange.end }} จาก {{ saleTotal.toLocaleString('th-TH') }} รายการ
              </span>
              <q-pagination
                v-if="saleTotalPages > 1"
                :model-value="salePage"
                :max="saleTotalPages"
                :max-pages="5"
                boundary-numbers
                direction-links
                flat
                color="grey-7"
                active-color="positive"
                @update:model-value="(page: number) => loadSales(page, true)"
              />
            </div>
          </template>
        </q-card>
      </template>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableProps } from 'quasar';
import { useMunicipalityStore, type MuniSale, type Paginated } from 'src/stores/municipalityStore';
import {
  formatBaht,
  formatQuantity,
  formatThaiDate,
  formatThaiDateTime,
  fundTypeLabel,
  memberFullName,
  memberStatusLabel,
} from './format';

const route = useRoute();
const store = useMunicipalityStore();
const detail = computed(() => store.memberDetail);

// Same 720px breakpoint as the page's phone CSS - the sales table turns into
// cards below it.
const $q = useQuasar();
const isPhone = computed(() => $q.screen.width <= 720);

function memberId(): number | null {
  const id = Number(route.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function load() {
  const id = memberId();
  if (id === null) return;
  avatarFailed.value = false;
  void store.fetchMemberDetail(id);
  loadTxns(1);
  loadSales(1);
}

// --- Profile photo ---
// A stored path whose file has gone missing falls back to the person icon
// instead of a broken image.
const avatarFailed = ref(false);
const avatarSrc = computed(() =>
  avatarFailed.value ? null : (detail.value.data?.member.avatarUrl ?? null),
);

// --- Fund ledger and sales history, paged ---
// Both lists load a page at a time; keepData is only passed when flipping pages
// of the member already on screen.
const PAGE_SIZE = 10;

// "แสดง a–b" for the rows on screen - read off the response, not the page just
// clicked, because while the next page loads the old rows are still showing.
function pageRange(data: Paginated<unknown> | null): { start: number; end: number } {
  if (!data || !data.total) return { start: 0, end: 0 };
  const offset = (data.page - 1) * data.pageSize;
  return { start: offset + 1, end: offset + data.items.length };
}

const txnPage = ref(1);
const txns = computed(() => store.memberFundTransactions);
const txnRows = computed(() => txns.value.data?.items ?? []);
const txnTotal = computed(() => txns.value.data?.total ?? 0);
const txnTotalPages = computed(() => txns.value.data?.totalPages ?? 1);
const txnRange = computed(() => pageRange(txns.value.data));

function loadTxns(page: number, keepData = false) {
  const id = memberId();
  if (id === null) return;
  txnPage.value = page;
  void store.fetchMemberFundTransactions(id, page, PAGE_SIZE, keepData);
}

const salePage = ref(1);
const sales = computed(() => store.memberSales);
const saleRows = computed(() => sales.value.data?.items ?? []);
const saleTotal = computed(() => sales.value.data?.total ?? 0);
const saleTotalPages = computed(() => sales.value.data?.totalPages ?? 1);
const saleRange = computed(() => pageRange(sales.value.data));

function loadSales(page: number, keepData = false) {
  const id = memberId();
  if (id === null) return;
  salePage.value = page;
  void store.fetchMemberSales(id, page, PAGE_SIZE, keepData);
}

// --- Personal info card ---

const EMPTY_VALUE = 'ไม่ระบุ';

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: 'ใช้งาน',
  inactive: 'ปิดใช้งาน',
};

interface ProfileItem {
  label: string;
  value: string;
  icon: string;
  // Spans both columns - addresses and name lists run long.
  wide?: boolean;
  // Greyed "ไม่ระบุ"-style value.
  empty?: boolean;
  // Second, smaller line under the value.
  sub?: string;
  // Draws the value as a pill in this tone instead of plain text.
  chip?: 'ok' | 'off';
}

// x xxxx xxxxx xx x - the grouping printed on the card, spaced like the
// committee's add-member form so the number can wrap on a phone.
function formatCitizenId(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 13) return value;
  return [
    digits.slice(0, 1),
    digits.slice(1, 5),
    digits.slice(5, 10),
    digits.slice(10, 12),
    digits.slice(12),
  ].join(' ');
}

// 0xx-xxx-xxxx for a mobile number, 0x-xxx-xxxx for a landline; anything else
// (phone is free text) as entered.
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return value;
}

const profileGroups = computed<{ title: string; items: ProfileItem[] }[]>(() => {
  const data = detail.value.data;
  if (!data) return [];
  const { member } = data;
  const household = member.household;
  const address = household
    ? `บ้านเลขที่ ${household.houseNo ?? '-'} หมู่ ${household.moo ?? '-'} ต.${household.subdistrict ?? '-'} อ.${household.district ?? '-'} จ.${household.province ?? '-'} ${household.postcode ?? ''}`.trim()
    : null;
  const guarantors = member.guarantors.length
    ? member.guarantors
        .map((g) => `${g.guarantorName}${g.relationship ? ` (${g.relationship})` : ''}`)
        .join(', ')
    : null;
  const occupation = member.occupation?.trim() || null;
  const account = member.userAccount;

  const accountItem: ProfileItem = account
    ? {
        label: 'บัญชีผู้ใช้',
        value: ACCOUNT_STATUS_LABELS[account.status] ?? account.status,
        icon: 'manage_accounts',
        wide: true,
        chip: account.status === 'active' ? 'ok' : 'off',
        sub: account.lastLogin
          ? `เข้าใช้ล่าสุด ${formatThaiDateTime(account.lastLogin)}`
          : 'ยังไม่เคยเข้าใช้งาน',
      }
    : { label: 'บัญชีผู้ใช้', value: 'ไม่มีบัญชีผู้ใช้', icon: 'manage_accounts', wide: true, empty: true };

  return [
    {
      title: 'ข้อมูลส่วนตัว',
      items: [
        { label: 'เลขบัตรประชาชน', value: formatCitizenId(member.citizenId), icon: 'badge' },
        { label: 'วันเกิด', value: formatThaiDate(member.birthDate), icon: 'cake' },
        { label: 'เบอร์โทรศัพท์', value: formatPhone(member.phone), icon: 'call' },
        { label: 'อาชีพ', value: occupation ?? EMPTY_VALUE, icon: 'work', empty: !occupation },
      ],
    },
    {
      title: 'ที่อยู่และผู้ค้ำประกัน',
      items: [
        { label: 'ที่อยู่ (ครัวเรือน)', value: address ?? EMPTY_VALUE, icon: 'home', wide: true, empty: !address },
        {
          label: 'ผู้ค้ำประกัน',
          value: guarantors ?? EMPTY_VALUE,
          icon: 'supervisor_account',
          wide: true,
          empty: !guarantors,
        },
      ],
    },
    {
      title: 'การเป็นสมาชิก',
      items: [
        { label: 'วันที่สมัคร', value: formatThaiDate(member.applyDate), icon: 'event' },
        {
          label: 'วันที่อนุมัติ',
          value: member.approvedDate ? formatThaiDate(member.approvedDate) : 'ยังไม่อนุมัติ',
          icon: 'verified',
          empty: !member.approvedDate,
        },
        accountItem,
      ],
    },
  ];
});

// --- Welfare eligibility checklist ---
// The three conditions of backend eligibilityService.evaluateEligibility, each
// with the member's own figure - requirements come from the backend, not here.
const eligibilityRules = computed(() => {
  const data = detail.value.data;
  const evaluation = data?.eligibility;
  if (!data || !evaluation) return [];
  const { fundCheck, membershipAgeCheck, wasteSaleActivityCheck } = evaluation;
  return [
    {
      key: 'fund',
      passed: fundCheck.passed,
      title: `มีเงินสะสมอย่างน้อย ${formatBaht(fundCheck.required)} บาท`,
      detail: `ตอนนี้มี ${formatBaht(fundCheck.amount)} บาท`,
    },
    {
      key: 'tenure',
      passed: membershipAgeCheck.passed,
      title: `เป็นสมาชิกมาแล้วอย่างน้อย ${membershipAgeCheck.required} เดือน`,
      detail: data.member.approvedDate
        ? `เป็นสมาชิกมา ${membershipAgeCheck.months} เดือน`
        : 'ยังไม่ได้รับการอนุมัติเป็นสมาชิก',
    },
    {
      key: 'activity',
      passed: wasteSaleActivityCheck.passed,
      title: `ขายขยะอย่างน้อย ${wasteSaleActivityCheck.required} เดือน ใน ${wasteSaleActivityCheck.windowMonths} เดือนล่าสุด`,
      detail: `ขายแล้ว ${wasteSaleActivityCheck.activeMonths} เดือน`,
    },
  ];
});

const participationCards = computed(() => {
  const data = detail.value.data;
  if (!data) return [];
  return [
    {
      label: 'เงินสะสม',
      value: formatBaht(data.member.fundBalance?.totalContribution),
      unit: 'บาท',
      icon: 'savings',
      iconClass: 'icon-green',
    },
    {
      label: 'ขายขยะสำเร็จ',
      value: data.participation.completedSaleCount.toLocaleString(),
      unit: 'ครั้ง',
      icon: 'recycling',
      iconClass: 'icon-blue',
    },
    {
      label: 'ปริมาณขยะสะสม',
      value: formatQuantity(data.participation.totalQuantity),
      unit: 'กก.',
      icon: 'scale',
      iconClass: 'icon-amber',
    },
    {
      label: 'เดือนที่เข้าร่วม',
      value: data.participation.activeMonthCount.toLocaleString(),
      unit: 'เดือน',
      icon: 'event_available',
      iconClass: 'icon-green',
    },
  ];
});

const saleColumns: QTableProps['columns'] = [
  { name: 'saleNo', align: 'left', label: 'เลขที่ขาย', field: 'saleNo' },
  {
    name: 'saleDate',
    align: 'left',
    label: 'วันที่',
    field: (row: MuniSale) => formatThaiDate(row.saleDate),
  },
  {
    name: 'items',
    align: 'left',
    label: 'รายการ',
    field: (row: MuniSale) =>
      row.details.map((d) => `${d.wasteType.wasteName} ${formatQuantity(d.quantity)} ${d.wasteType.unit}`).join(', '),
  },
  {
    name: 'totalAmount',
    align: 'right',
    label: 'มูลค่า (บาท)',
    field: (row: MuniSale) => formatBaht(row.totalAmount),
  },
  {
    name: 'netAmount',
    align: 'right',
    label: 'หลังหักกองทุน (บาท)',
    field: (row: MuniSale) => formatBaht(row.netAmount),
  },
];

watch(() => route.params.id, load);
onMounted(load);
</script>

<style lang="scss" scoped>
@use './theme' as *;

.profile-hero {
  padding-bottom: 32px;
}

.hero-top {
  gap: 12px;
}

.hero-back {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 950;
}

.hero-brand .q-icon {
  font-size: 26px;
}

// Photo, chips, name and address stacked down the middle of the hero.
.hero-profile {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  margin-top: 26px;
  text-align: center;
}

.profile-avatar {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(232, 250, 238, 0.62), rgba(232, 250, 238, 0.24));
  // A soft ring so an uploaded photo stands off the green hero.
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.28);
  font-size: 72px;

  img {
    object-fit: cover;
  }
}

.profile-copy {
  min-width: 0;
}

.profile-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.member-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 14px;
  color: #087f49;
  background: #dff3e0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.chip-pending,
.chip-suspended {
  color: #8a5a12;
  background: #fff4e5;
}

.chip-resigned,
.chip-deceased {
  color: #5b6560;
  background: #eef1ef;
}

.profile-copy h1 {
  margin: 14px 0 8px;
  font-size: clamp(26px, 3.4vw, 40px);
  font-weight: 950;
  line-height: 1.05;
}

.profile-copy p {
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 15px;
  font-weight: 800;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat-card {
  min-height: 104px;
  padding: 16px 18px;
  gap: 12px;
}

.stat-card .summary-icon {
  width: 48px;
  height: 48px;
  min-width: 48px;
  font-size: 24px;
}

.stat-value {
  font-size: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, 1fr);
  gap: 22px;
  margin-top: 24px;
}

// --- Personal info card ---
// Three labelled groups; each field is an icon tile, a muted label and the
// value, two to a row (one on a phone).

.info-body {
  padding: 18px 26px 24px;
}

.info-group + .info-group {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px dashed #e4ede6;
}

.info-group-title {
  margin-bottom: 12px;
  color: #0b7a47;
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.info-item--wide {
  grid-column: 1 / -1;
}

.info-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  min-width: 36px;
  color: #1e8a44;
  background: #eef7f1;
  border-radius: 10px;
  font-size: 18px;
}

.info-text {
  min-width: 0;
  flex: 1;
}

.info-label {
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.info-value {
  margin-top: 2px;
  color: #1f3a2d;
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;

  &.is-empty {
    color: #a3aea8;
    font-weight: 600;
  }
}

.info-sub {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.info-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 800;

  &--ok {
    color: #087f49;
    background: #dff3e0;
  }

  &--off {
    color: #5b6560;
    background: #eef1ef;
  }
}

// --- Eligibility checklist ---

.rule-list {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;

  &.is-pass {
    background: #f1f8f3;
  }

  &.is-fail {
    background: #fdf2f2;
  }
}

.rule-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  min-width: 26px;
  color: #ffffff;
  border-radius: 50%;
  font-size: 16px;

  .is-pass & {
    background: #1e8a44;
  }

  .is-fail & {
    background: #c05252;
  }
}

.rule-title {
  color: #16352a;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.rule-detail {
  margin-top: 2px;
  color: #6d7c74;
  font-size: 12.5px;
  font-weight: 600;

  .is-fail & {
    color: #b04a4a;
  }
}

.eligibility-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 900;
}

.eligibility-chip.is-pass {
  color: #087f49;
  background: #eef8ef;
}

.eligibility-chip.is-wait {
  color: #8a5a12;
  background: #fff4e5;
}

.txn-list {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.txn-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(7, 95, 56, 0.08);
}

.txn-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.txn-info {
  min-width: 0;
  flex: 1;
}

.txn-title {
  color: #18231e;
  font-size: 14px;
  font-weight: 900;
}

.txn-date {
  margin-top: 3px;
  color: #98a19d;
  font-size: 12px;
  font-weight: 700;
}

.txn-amount {
  font-size: 14.5px;
  font-weight: 950;
  white-space: nowrap;
}

// Dimmed, not emptied, while the next page loads (keepData).
.txn-list.is-loading,
.sale-table.is-loading {
  opacity: 0.55;
  transition: opacity 0.15s ease;
}

// Pager under the fund ledger and the sales history.
.list-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(7, 95, 56, 0.08);
}

// In the edge-to-edge sales card the pager brings its own side padding, and
// the table's last row already draws the line above it.
.list-pager--flush {
  margin-top: 0;
  padding: 12px 26px 18px;
  border-top: none;
}

.list-pager-info {
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
}

// --- Sale cards (phone, q-table grid mode) ---

// The container is rendered inside QTable, hence :deep.
.sale-table :deep(.sale-cards) {
  display: grid;
  gap: 10px;
  padding: 4px 16px 16px;
}

.sale-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
}

.sale-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.sale-no {
  min-width: 0;
  color: #16352a;
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.sale-date {
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.sale-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.sale-item {
  padding: 3px 10px;
  color: #2f5a44;
  background: #f1f7f3;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
}

.sale-card-foot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4ede6;
}

.sale-figure {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.sale-figure-label {
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
}

.sale-figure-value {
  color: #16352a;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;

  &.is-money {
    color: #0d7a44;
  }
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

// Phone: a spaced ID number or a date does not fit half a row beside its icon,
// so the info fields go one per row.
@media (max-width: 560px) {
  .info-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

// Phone: line the sales pager up with the cards' 16px gutter.
@media (max-width: 720px) {
  .list-pager--flush {
    padding: 4px 16px 16px;
  }
}
</style>
