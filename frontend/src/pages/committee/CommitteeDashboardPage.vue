<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="dashboard" />
          </div>
          <div class="hero-copy">
            <h1>แดชบอร์ดกรรมการธนาคารขยะ</h1>
            <p v-if="villageLabel">{{ villageLabel }}</p>
          </div>
        </div>
      </section>

      <!-- The side menu as tiles, one tap each - same shape as the member home
           page's buttons. It sits outside the data block on purpose, so it is
           usable while the dashboard is still loading. -->
      <nav class="menu-actions" aria-label="เมนูกรรมการ">
        <q-btn
          v-for="item in menuActions"
          :key="item.to"
          unelevated
          no-caps
          stack
          :to="item.to"
          :icon="item.icon"
          :class="['menu-action', { 'is-primary': item.primary }]"
        >
          <!-- Thai has no spaces, so a narrow tile would wrap anywhere: a space in
               the label marks the one place it may break instead. -->
          <span class="menu-action-label">
            <template v-for="(part, index) in item.label.split(' ')" :key="index">
              <wbr v-if="index > 0" /><span class="menu-action-label-part">{{ part }}</span>
            </template>
          </span>
        </q-btn>
      </nav>

      <q-banner v-if="!hasVillage" rounded class="bg-amber-1 text-amber-9 error-banner">
        <template #avatar><q-icon name="warning" /></template>
        บัญชีนี้ยังไม่ได้ถูกกำหนดหมู่บ้านที่รับผิดชอบ กรุณาติดต่อผู้ดูแลระบบ
      </q-banner>

      <q-banner v-else-if="store.error" rounded class="bg-red-1 text-red-9 error-banner">
        <template #avatar><q-icon name="error_outline" /></template>
        {{ store.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="load" />
        </template>
      </q-banner>

      <div v-else-if="store.loading && !data" class="loading-wrap">
        <q-spinner-dots size="48px" color="positive" />
      </div>

      <template v-else-if="data">
        <!-- 1. เงินสะสมของหมู่บ้าน -->
        <section class="fund-panel">
          <article v-for="tile in fundTiles" :key="tile.label" :class="['fund-tile', tile.tone]">
            <div class="fund-tile-head">
              <span class="fund-tile-icon">
                <q-icon :name="tile.icon" />
              </span>
              {{ tile.label }}
            </div>
            <div class="fund-tile-value">
              {{ tile.value }}
              <span>{{ tile.unit }}</span>
            </div>
          </article>
        </section>

        <!-- 2. สถิติประจำเดือน -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div class="panel-title">สถิติประจำเดือน {{ monthLabel }}</div>
          </div>

          <div class="stat-strip">
            <article v-for="stat in monthlyStats" :key="stat.label" class="stat-tile">
              <div class="stat-head">
                <q-icon :name="stat.icon" :class="stat.iconClass" />
                {{ stat.label }}
              </div>
              <div class="stat-value">
                {{ stat.value }}
                <span>{{ stat.unit }}</span>
              </div>
            </article>
          </div>
        </q-card>

        <!-- 3. สถานะสมาชิก + รายการที่รอการตรวจสอบและอนุมัติ -->
        <section class="dash-grid">
          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">สถานะสมาชิกทั้งหมด</div>
                <div class="panel-caption">{{ data.members.total.toLocaleString() }} คน</div>
              </div>
              <router-link to="/committee/members" class="panel-link">
                จัดการสมาชิก
                <q-icon name="chevron_right" />
              </router-link>
            </div>

            <div class="status-split">
              <!-- วงกลมสัดส่วน: หนึ่ง <circle> ต่อหนึ่งสถานะ ใช้ dash ยาวเท่าส่วนแบ่ง
                   แล้วเลื่อนเข้าที่ด้วย dashoffset ติดลบ -->
              <div class="status-donut">
                <svg viewBox="0 0 120 120" role="img" :aria-label="statusAriaLabel">
                  <circle class="donut-track" cx="60" cy="60" r="52" />
                  <g transform="rotate(-90 60 60)">
                    <circle
                      v-for="seg in statusDonutSegments"
                      :key="seg.status"
                      class="donut-arc"
                      cx="60"
                      cy="60"
                      r="52"
                      :stroke="seg.color"
                      :stroke-dasharray="seg.dash"
                      :stroke-dashoffset="seg.offset"
                    />
                  </g>
                </svg>
                <div class="donut-center">
                  <strong>{{ statusHeadline.percentLabel }}</strong>
                  <span>ยังใช้งาน</span>
                  <small>{{ statusHeadline.active }} จาก {{ statusHeadline.total }} คน</small>
                </div>
              </div>

              <ul class="status-rows">
                <li v-for="row in statusRows" :key="row.status" class="status-row">
                  <span class="status-tick" :style="{ background: row.color }"></span>
                  <span class="status-name">{{ row.label }}</span>
                  <span class="status-count">{{ row.count.toLocaleString() }}</span>
                  <span class="status-percent">{{ row.percentLabel }}</span>
                  <q-tooltip>{{ row.label }} {{ row.count }} คน ({{ row.percentLabel }})</q-tooltip>
                </li>
              </ul>
            </div>

            <div class="status-foot">
              <span class="status-fact">
                สมัครใหม่เดือนนี้
                <strong>{{ data.monthly.newMemberCount }} คน</strong>
              </span>
              <span v-if="data.members.pendingApproval > 0" class="status-alert">
                <q-icon name="pending_actions" />
                รอการอนุมัติ {{ data.members.pendingApproval }} คน
              </span>
            </div>
          </q-card>

          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">รอการตรวจสอบและดำเนินการ</div>
              </div>
              <router-link to="/committee/sell-requests" class="panel-link">
                ดูคำร้อง
                <q-icon name="chevron_right" />
              </router-link>
            </div>

            <ul class="approval-rows">
              <li v-for="row in approvalRows" :key="row.label" class="approval-row">
                <span :class="['list-icon', row.iconClass]">
                  <q-icon :name="row.icon" />
                </span>
                <span class="approval-copy">
                  <!-- Wraps only at the space: "รอรับเรื่อง" moves down whole. -->
                  <span class="approval-label">
                    <template v-for="(part, index) in row.label.split(' ')" :key="index">
                      {{ index ? ' ' : '' }}<span class="approval-label-part">{{ part }}</span>
                    </template>
                  </span>
                </span>
                <span class="approval-count">
                  <b>{{ row.count.toLocaleString() }}</b>
                  <em>{{ row.unit }}</em>
                </span>
              </li>
            </ul>
          </q-card>
        </section>

        <!-- 4. รายชื่อที่ต้องติดตามก่อนใคร -->
        <section class="dash-grid">
          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">สมาชิกที่ใกล้ขาดสิทธิ</div>
              </div>
            </div>

            <ul v-if="data.members.atRiskMembers.length" class="member-list">
              <li v-for="member in data.members.atRiskMembers" :key="member.id" class="member-item">
                <div class="member-head">
                  <span class="member-name">{{ member.fullName }}</span>
                  <span class="member-code">รหัส {{ member.memberCode }}</span>
                </div>
                <ul class="reason-list">
                  <li v-for="reason in member.reasons" :key="reason">{{ reason }}</li>
                </ul>
              </li>
            </ul>
            <div v-else class="empty-state empty-state--tight">
              <q-icon name="verified" size="28px" />
              ยังไม่มีสมาชิกที่เสี่ยงขาดสิทธิ
            </div>

            <div v-if="data.members.atRiskCount > data.members.atRiskMembers.length" class="list-more">
              และอีก {{ data.members.atRiskCount - data.members.atRiskMembers.length }} คน
            </div>
          </q-card>

          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">
                  เงินสะสมยังไม่ครบ {{ formatBaht(data.fund.minimumPerMember) }} บาท
                </div>
              </div>
            </div>

            <ul v-if="data.members.belowMinimumMembers.length" class="member-list">
              <li
                v-for="member in data.members.belowMinimumMembers"
                :key="member.id"
                class="member-item member-item--row"
              >
                <span class="member-name">{{ member.fullName }}</span>
                <span class="member-code">รหัส {{ member.memberCode }}</span>
                <span class="member-amount">ขาดอีก {{ formatBaht(member.shortfall) }} บาท</span>
              </li>
            </ul>
            <div v-else class="empty-state empty-state--tight">
              <q-icon name="task_alt" size="28px" />
              สมาชิกทุกคนมีเงินสะสมครบแล้ว
            </div>

            <div
              v-if="data.members.belowMinimumCount > data.members.belowMinimumMembers.length"
              class="list-more"
            >
              และอีก
              {{ data.members.belowMinimumCount - data.members.belowMinimumMembers.length }} คน
            </div>
          </q-card>
        </section>
      </template>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCommitteeDashboardStore } from 'src/stores/committeeDashboardStore';
import { useAuthStore } from 'src/stores/authStore';
import {
  formatBaht,
  formatQuantity,
  memberStatusLabel,
  memberStatusRank,
  memberStatusTone,
  THAI_MONTH_NAMES,
} from '../municipality/format';

const store = useCommitteeDashboardStore();
const authStore = useAuthStore();

const data = computed(() => store.data);
const villageLabel = computed(() => authStore.myVillageLabel);
const hasVillage = computed(() => authStore.myVillage !== null);

function load() {
  void store.fetchDashboard();
}

onMounted(() => {
  if (hasVillage.value) load();
});


// --- 1. Savings ----------------------------------------------------------------------
// Each member has one savings balance that can't be withdrawn; this is the
// village's total. Who is still short of the minimum is listed further down.
const fundTiles = computed(() => {
  const fund = data.value?.fund;
  if (!fund) return [];
  return [
    {
      label: 'เงินสะสมของสมาชิกรวม',
      value: formatBaht(fund.totalBalance),
      unit: 'บาท',
      icon: 'savings',
      tone: 'fund-tile--green',
    },
  ];
});

// --- 2. Monthly stats -------------------------------------------------------------

const monthLabel = computed(() => {
  const start = data.value?.month.start;
  if (!start) return '';
  const date = new Date(start);
  return `${THAI_MONTH_NAMES[date.getMonth()]} ${date.getFullYear() + 543}`;
});

const monthlyStats = computed(() => {
  const report = data.value;
  if (!report) return [];
  const monthly = report.monthly;
  return [
    {
      label: 'สมาชิกที่แจ้งขาย',
      value: monthly.sellRequestMemberCount.toLocaleString(),
      unit: 'คน',
      icon: 'campaign',
      iconClass: 'tone-green',
    },
    {
      label: 'ปริมาณขยะที่รับซื้อ',
      value: formatQuantity(monthly.wasteQuantity),
      unit: 'กก.',
      icon: 'scale',
      iconClass: 'tone-blue',
    },
    {
      label: 'ยอดรับซื้อรวม',
      value: formatBaht(monthly.saleAmount),
      unit: 'บาท',
      icon: 'sell',
      iconClass: 'tone-green',
    },
    {
      label: 'เงินเข้าเงินสะสม',
      value: formatBaht(monthly.fundContribution),
      unit: 'บาท',
      icon: 'volunteer_activism',
      iconClass: 'tone-amber',
    },
    {
      label: 'สมาชิกใกล้ขาดสิทธิ',
      value: report.members.atRiskCount.toLocaleString(),
      unit: 'คน',
      icon: 'warning_amber',
      iconClass: 'tone-red',
    },
  ];
});

// --- 3. Member statuses + approvals ----------------------------------------------

// The queue a committee member works through: what is waiting on them, in the
// order a delay costs someone else the most.
const approvalRows = computed(() => {
  const report = data.value;
  if (!report) return [];
  const approvals = report.approvals;
  return [
    {
      label: 'คำร้องขอขายขยะ รอรับเรื่อง',
      count: report.sellRequests.waitingReview,
      unit: 'รายการ',
      icon: 'assignment',
      iconClass: 'icon-amber',
    },
    {
      label: 'รับเรื่องแล้ว รอบันทึกรับซื้อ',
      count: report.sellRequests.confirmed,
      unit: 'รายการ',
      icon: 'local_shipping',
      iconClass: 'icon-blue',
    },
    {
      label: 'สมาชิกรอการอนุมัติ',
      count: report.members.pendingApproval,
      unit: 'คน',
      icon: 'how_to_reg',
      iconClass: 'icon-green',
    },
    {
      label: 'เงินฌาปนกิจค้างชำระ',
      count: approvals.funeralShortfallCount,
      unit: 'ราย',
      icon: 'error_outline',
      iconClass: 'icon-red',
    },
  ];
});

// A sliver of a percent should not round away to "0%", so keep one decimal there.
const percentLabel = (percent: number) =>
  `${percent > 0 && percent < 1 ? percent.toFixed(1) : Math.round(percent)}%`;

const statusRows = computed(() => {
  const members = data.value?.members;
  if (!members) return [];
  return Object.entries(members.byStatus)
    .sort(([a], [b]) => memberStatusRank(a) - memberStatusRank(b))
    .map(([status, count]) => {
      const percent = members.total > 0 ? (count / members.total) * 100 : 0;
      return {
        status,
        count,
        percent,
        label: memberStatusLabel(status),
        color: memberStatusTone(status),
        percentLabel: percentLabel(percent),
      };
    });
});

// One <circle> per status: a dash as long as the slice, slid into place with a
// negative dash offset. A hairline gap separates neighbouring slices, unless a
// single status owns the whole ring and a gap would read as a nick.
const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const statusDonutSegments = computed(() => {
  const slices = statusRows.value.filter((row) => row.percent > 0);
  const gap = slices.length > 1 ? 2.5 : 0;
  let start = 0;
  return slices.map((row) => {
    const length = (row.percent / 100) * DONUT_CIRCUMFERENCE;
    const offset = -start;
    start += length;
    return {
      ...row,
      dash: `${Math.max(length - gap, 0.8)} ${DONUT_CIRCUMFERENCE}`,
      offset,
    };
  });
});

// The ring's hole carries the number the card is built around - how much of the
// village is still an active membership.
const statusHeadline = computed(() => {
  const members = data.value?.members;
  const total = members?.total ?? 0;
  const active = members?.byStatus.active ?? 0;
  return {
    total,
    active,
    percentLabel: percentLabel(total > 0 ? (active / total) * 100 : 0),
  };
});

const statusAriaLabel = computed(() =>
  statusRows.value.map((row) => `${row.label} ${row.count} คน`).join(', '),
);

// The same links as the side menu (committeeMenu in layouts/MainLayout.vue),
// minus this page itself and "เพิ่มสมาชิก", which the member page already has a
// button for. Kept in this order: the sell requests and the rounds are the daily
// job, the member page comes after.
const menuActions = [
  { label: 'คำขอขายขยะ', to: '/committee/sell-requests', icon: 'assignment', primary: true },
  { label: 'จัดการรอบรับซื้อ', to: '/committee/rounds', icon: 'event_available', primary: false },
  { label: 'แสดงเส้นทาง การรับซื้อ', to: '/committee/route-plan', icon: 'route', primary: false },
  { label: 'จัดการสมาชิก', to: '/committee/members', icon: 'group', primary: false },
];
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

// --- Menu tiles ---------------------------------------------------------------------
// Same tile as the member home page (.member-action in pages/user/DashboardPage):
// icon over label, one tap to the page. auto-fit keeps the five of them on one
// row on a desktop and folds them to two per row on a phone.

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

.menu-action-label {
  line-height: 1.35;
}

.menu-action-label-part {
  white-space: nowrap;
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

// --- Approval list ---------------------------------------------------------------------

.approval-rows {
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.approval-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #f2f6f3;
}

.approval-row:last-child {
  border-bottom: none;
}

.approval-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.approval-label {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 600;
}

.approval-label-part {
  white-space: nowrap;
}

// The units differ in width (รายการ / คน / ราย), so the unit gets a fixed slot and
// every number ends on the same line down the list.
.approval-count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #16352a;
  white-space: nowrap;
}

.approval-count b {
  min-width: 2ch;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.approval-count em {
  width: 3.6em;
  color: #8a958e;
  font-size: 12.5px;
  font-style: normal;
  font-weight: 600;
}

// --- Fund headline -----------------------------------------------------------------

// --- Fund panel -----------------------------------------------------------------------
// One frame holding the village's savings total.

.fund-panel {
  display: grid;
  grid-template-columns: 1fr;
  margin-top: 24px;
  padding: 6px 28px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(23, 46, 34, 0.04);
}

.fund-tile {
  padding: 22px 26px;
  border-left: 1px solid #eaf0ec;
}

.fund-tile:first-child {
  padding-left: 0;
  border-left: none;
}

.fund-tile-head {
  display: flex;
  align-items: center;
  gap: 11px;
  color: #6d7c74;
  font-size: 13.5px;
  font-weight: 600;
}

.fund-tile-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  font-size: 20px;
}

.fund-tile-value {
  margin-top: 14px;
  color: #14503a;
  font-size: clamp(30px, 3.4vw, 40px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.fund-tile-value span {
  margin-left: 6px;
  color: #8a958e;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
}

// The tone rides the icon chip only - the two figures are the same kind of thing
// (baht in the same account), so colouring them apart would claim a difference the
// numbers do not have. Each half carries its own label regardless.
.fund-tile--green .fund-tile-icon {
  color: #1e8a44;
  background: #e4f1e9;
}

.fund-tile--blue .fund-tile-icon {
  color: #2379b8;
  background: #e3eff8;
}

// --- Monthly stat strip -------------------------------------------------------------

.stat-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 20px;
  border-top: 1px solid #eaf0ec;
}

.stat-tile {
  padding: 20px 22px;
  border-left: 1px solid #eaf0ec;
}

.stat-tile:first-child {
  padding-left: 0;
  border-left: none;
}

.stat-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6d7c74;
  font-size: 13px;
  font-weight: 600;
}

.stat-head .q-icon {
  font-size: 18px;
}

.tone-green {
  color: #1e8a44;
}

.tone-blue {
  color: #2379b8;
}

.tone-amber {
  color: #a3691a;
}

.tone-red {
  color: #b0503c;
}

.stat-value {
  margin-top: 8px;
  color: #16352a;
  font-size: 25px;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.stat-value span {
  margin-left: 4px;
  color: #8a958e;
  font-size: 13px;
  font-weight: 600;
}

// --- Two-column panel grid ------------------------------------------------------------

.dash-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
  align-items: start;
}

// --- Member status -------------------------------------------------------------------

.status-split {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-top: 20px;
}

.status-donut {
  position: relative;
  display: grid;
  place-items: center;
  width: 136px;
  min-width: 136px;
}

.status-donut svg {
  width: 100%;
  height: auto;
}

.donut-track {
  fill: none;
  stroke: #eef4f0;
  stroke-width: 14;
}

.donut-arc {
  fill: none;
  stroke-width: 14;
  // Butt caps, not round: a rounded end would overhang the next slice and eat
  // the 2.5 gap that keeps two colours reading as two.
  stroke-linecap: butt;
  transition: stroke-dasharray 0.4s ease;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 1px;
  line-height: 1.1;
  text-align: center;
  pointer-events: none;
}

.donut-center strong {
  color: #14503a;
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.donut-center span {
  color: #6d7c74;
  font-size: 12px;
  font-weight: 600;
}

.donut-center small {
  color: #8a958e;
  font-size: 11px;
  font-weight: 500;
}

.status-rows {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f2f6f3;
}

.status-row:last-child {
  border-bottom: none;
}

.status-tick {
  width: 10px;
  height: 10px;
  min-width: 10px;
  border-radius: 3px;
}

.status-name {
  flex: 1;
  min-width: 0;
  color: #43514a;
  font-size: 13.5px;
  font-weight: 600;
}

.status-count {
  color: #16352a;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.status-percent {
  width: 48px;
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.status-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #eaf0ec;
}

.status-fact {
  color: #6d7c74;
  font-size: 12.5px;
  font-weight: 500;
}

.status-fact strong {
  color: #16352a;
  font-weight: 700;
}

.status-alert {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  color: #8a5a12;
  background: #f9edd8;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
}

// --- Follow-up member lists --------------------------------------------------------------

.member-list {
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.member-item {
  padding: 12px 0;
  border-bottom: 1px solid #f2f6f3;
}

.member-item:last-child {
  border-bottom: none;
}

// ชื่อ / รหัส / ยอดที่ขาด แยกเป็นสามคอลัมน์กว้างคงที่ ทุกแถวจึงเรียงตรงกัน
// (ถ้าปล่อยให้ auto แต่ละแถวจะกว้างไม่เท่ากันเพราะชื่อยาวไม่เท่ากัน)
.member-item--row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px 116px;
  align-items: baseline;
  column-gap: 14px;
}

.member-item--row .member-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// รหัสชิดซ้ายในคอลัมน์ของตัวเอง คำว่า "รหัส" ทุกแถวจึงเริ่มที่ตำแหน่งเดียวกัน
// ส่วนยอดเงินชิดขวา ตัวเลขจึงลงหลักตรงกัน
.member-item--row .member-code {
  font-variant-numeric: tabular-nums;
}

.member-item--row .member-amount {
  justify-self: end;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.member-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.member-name {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 700;
}

.member-code {
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 500;
}

.member-amount {
  color: #b0503c;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.reason-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #6d7c74;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.7;
}

.list-more {
  margin-top: 12px;
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
}

.empty-state--tight {
  padding: 26px 0;
}

.empty-state .panel-link {
  margin-top: 4px;
}

// --- Responsive ------------------------------------------------------------------------

@media (max-width: 1180px) {
  .dash-grid {
    grid-template-columns: 1fr;
  }

  .stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-tile:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }
}

@media (max-width: 720px) {
  .member-item--row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 4px;
  }

  .member-item--row .member-amount {
    grid-column: 2;
  }

  .menu-actions {
    gap: 12px;
  }

  .menu-action {
    min-height: 84px;
    font-size: 15px;
  }

  .status-split {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .status-donut {
    margin: 0 auto;
  }

  .fund-panel {
    grid-template-columns: 1fr;
    padding: 6px 22px;
  }

  .fund-tile {
    padding: 20px 0;
    border-left: none;
    border-top: 1px solid #eaf0ec;
  }

  .fund-tile:first-child {
    border-top: none;
  }

  // Phone: the month's figures stay a block of two columns instead of one long
  // column - same numbers, a third of the scrolling.
  .stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 14px;
  }

  .stat-tile {
    padding: 12px 0;
    border-left: none;
    border-top: 1px solid #eaf0ec;
  }

  // The top row has nothing above it to be separated from.
  .stat-tile:nth-child(-n + 2) {
    border-top: none;
  }

  .stat-head {
    font-size: 12px;
  }

  .stat-value {
    margin-top: 4px;
    font-size: 21px;
  }
}

// Phone: "แดชบอร์ดกรรมการธนาคารขยะ" is a long title - at the theme's 22px it
// broke after "ธนาคาร" and left "ขยะ" hanging on its own line. A smaller badge
// and title keep the name on one line with the village right under it.
@media (max-width: 599px) {
  .muni-hero {
    padding: 18px;
  }

  .hero-row {
    flex-wrap: nowrap;
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

  .hero-copy p {
    margin-top: 3px;
    font-size: 13px;
  }
}
</style>
