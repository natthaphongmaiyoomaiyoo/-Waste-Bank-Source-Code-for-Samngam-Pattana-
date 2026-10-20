<template>
  <q-page class="member-home-page">
    <div class="member-home-shell">
      <section class="member-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-top-row">
          <div class="hero-brand">
            <q-icon name="badge" />
            <span>เลขสมาชิก {{ member.code }}</span>
          </div>
          <div class="hero-status">
            <span></span>
            ใช้งาน
          </div>
        </div>

        <div class="hero-profile">
          <q-avatar class="member-avatar" size="108px">
            <img v-if="member.avatarUrl" :src="member.avatarUrl" alt="รูปสมาชิก" />
            <q-icon v-else name="person" />
          </q-avatar>

          <div class="profile-copy">
            <h1>{{ member.name }}</h1>
            <p>{{ member.village }}</p>
          </div>
        </div>
      </section>

      <!-- ยอดเงินสะสม: the member's one balance. Red while it's under the minimum. -->
      <section :class="['summary-card', { 'summary-card--danger': !profileStore.hasMinimumFund }]">
        <div class="summary-icon icon-fund">
          <q-icon name="savings" />
        </div>

        <div class="summary-content">
          <div class="summary-label">ยอดเงินสะสม</div>
          <div class="summary-value">
            {{ member.fundBalance.toLocaleString() }}
            <span>บาท</span>
          </div>
          <div v-if="!profileStore.hasMinimumFund" class="summary-shortfall">
            <q-icon name="error_outline" />
            ขาดอีก {{ profileStore.fundShortfall.toLocaleString() }} บาท
          </div>
        </div>
      </section>

      <section class="info-grid">
        <!-- First: the next chance to sell is what should catch the eye, ahead
             of the eligibility checklist - a lime date tile and how soon it is. -->
        <article class="panel-card panel-card--round">
          <!-- Leaf outlines like the member card above, in its green. -->
          <div class="round-leaf round-leaf-one"></div>
          <div class="round-leaf round-leaf-two"></div>

          <div class="panel-head">
            <div class="panel-title">
              <q-icon name="event" />
              รอบรับซื้อถัดไป
            </div>
            <span v-if="nextRound" class="round-when">{{ nextRound.when }}</span>
          </div>

          <div v-if="nextRound" class="round-body">
            <div class="round-day-tile">
              <span class="round-day-month">{{ nextRound.monthShort }}</span>
              <span class="round-day-num">{{ nextRound.day }}</span>
            </div>
            <div class="round-info">
              <div class="round-date">{{ nextRound.date }}</div>
              <div class="round-meta">
                <q-icon name="schedule" />
                {{ nextRound.time }}
              </div>
            </div>
          </div>
          <div v-else class="round-empty">
            <q-icon name="event_busy" />
            ยังไม่มีรอบรับซื้อที่กำหนดไว้
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div class="panel-title">
              <q-icon name="fact_check" />
              คุณสมบัติ
            </div>
            <div
              :class="['condition-chip', profileStore.passesConditions ? 'is-pass' : 'is-pending']"
            >
              {{ profileStore.passesConditions ? 'ผ่านครบทุกข้อ' : 'ยังไม่ผ่านเงื่อนไข' }}
            </div>
          </div>

          <ul class="condition-list">
            <li
              v-for="item in conditions"
              :key="item.label"
              :class="['condition-item', { 'is-pass': item.pass }]"
            >
              <q-icon :name="item.pass ? 'check_circle' : 'cancel'" />
              <span class="condition-label">{{ item.label }}</span>
            </li>
          </ul>
        </article>
      </section>

      <!-- Members have no side menu: these four buttons are how they get around. -->
      <nav class="member-actions" aria-label="เมนูสมาชิก">
        <q-btn
          v-for="action in memberActions"
          :key="action.to"
          unelevated
          no-caps
          stack
          :to="action.to"
          :icon="action.icon"
          :aria-label="action.label"
          :class="['member-action', { 'is-primary': action.primary }]"
        >
          <!-- A long label wraps only between its parts: "จัดการ / คำขอขายขยะ". -->
          <span class="block">
            <span v-for="part in action.parts" :key="part" class="action-label-part">
              {{ part }}
            </span>
          </span>
        </q-btn>
      </nav>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { BUDDHIST_YEAR_OFFSET, midThaiDateLocale } from 'components/MID';
import { useMemberProfileStore } from 'src/stores/memberProfileStore';
import { useScheduleStore } from 'src/stores/scheduleStore';

const profileStore = useMemberProfileStore();
const scheduleStore = useScheduleStore();

const member = computed(() => profileStore.profile);

const conditions = computed(() => [
  {
    label: `เงินสะสมขั้นต่ำ ${member.value.fundMinimum} บาท`,
    pass: profileStore.hasMinimumFund,
  },
  {
    label: `เป็นสมาชิกครบ ${member.value.membershipTarget} เดือน`,
    pass: profileStore.hasRequiredMembership,
  },
  {
    label: `ขายขยะ ${member.value.saleActivityTarget} เดือนใน ${member.value.saleActivityWindow} เดือนล่าสุด`,
    pass: profileStore.hasRequiredSaleActivity,
  },
]);

// "วันนี้" / "พรุ่งนี้" / "อีก 3 วัน", counted in whole calendar days from today.
function daysUntilLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'พรุ่งนี้';
  return `อีก ${days} วัน`;
}

const nextRound = computed(() => {
  const upcoming = scheduleStore.openSchedules.find((s) => s.status === 'scheduled');
  if (!upcoming) return null;
  const [year, month, day] = upcoming.date.split('-').map(Number);
  const weekday = midThaiDateLocale.days[new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getDay()];
  const monthShort = midThaiDateLocale.monthsShort[(month ?? 1) - 1] ?? '';
  return {
    // "อังคาร 13 ต.ค. 2569" beside a tile of "ต.ค." over "13".
    date: `${weekday ?? ''} ${day} ${monthShort} ${(year ?? 0) + BUDDHIST_YEAR_OFFSET}`,
    monthShort,
    day: String(day),
    when: daysUntilLabel(upcoming.date),
    time: `${upcoming.timeStart} - ${upcoming.timeEnd} น.`,
  };
});

const memberActions = [
  { label: 'แจ้งขาย', to: '/sell-request', icon: 'sell', primary: true },
  { label: 'ตารางรับซื้อ', to: '/schedule', icon: 'calendar_month', primary: false },
  { label: 'ใบเสร็จ', to: '/history', icon: 'receipt_long', primary: false },
  {
    label: 'จัดการคำขอขายขยะ',
    to: '/sell-request-history',
    icon: 'assignment',
    primary: false,
  },
].map((action) => ({
  ...action,
  // Where the label may wrap (only "จัดการคำขอขายขยะ" is long enough to).
  parts: action.label === 'จัดการคำขอขายขยะ' ? ['จัดการ', 'คำขอขายขยะ'] : [action.label],
}));

onMounted(() => {
  void profileStore.fetchSummary();
  void scheduleStore.fetchSchedules();
});
</script>

<style scoped>
.member-home-page {
  min-height: 100%;
  padding: 28px;
  background: radial-gradient(circle at 8% 0, rgba(190, 232, 201, 0.32), transparent 30%), #f7faf8;
}

.member-home-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.member-hero {
  position: relative;
  min-height: 244px;
  overflow: hidden;
  padding: 28px 36px 34px;
  color: white;
  background:
    radial-gradient(circle at 78% 24%, rgba(156, 216, 66, 0.5), transparent 26%),
    linear-gradient(135deg, #00573d 0%, #00843e 56%, #48b52f 100%);
  border-radius: 22px;
  box-shadow: 0 22px 48px rgba(0, 83, 52, 0.18);
}

.hero-leaf {
  position: absolute;
  border: 3px solid rgba(132, 204, 76, 0.3);
  border-radius: 100% 0 100% 0;
  transform: rotate(-25deg);
}

.hero-leaf-one {
  right: 170px;
  bottom: 40px;
  width: 180px;
  height: 74px;
}

.hero-leaf-two {
  right: 20px;
  bottom: -20px;
  width: 240px;
  height: 118px;
  opacity: 0.62;
}

.hero-top-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 950;
}

.hero-brand .q-icon {
  font-size: 34px;
}

.hero-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  color: #087f49;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  font-weight: 900;
}

.hero-status span {
  width: 10px;
  height: 10px;
  background: #2cad34;
  border-radius: 999px;
}

.hero-profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 36px;
  margin-top: 34px;
}

.member-avatar {
  color: white;
  background: linear-gradient(180deg, rgba(232, 250, 238, 0.62), rgba(232, 250, 238, 0.24));
  font-size: 86px;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-copy h1 {
  margin: 0 0 10px;
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 950;
  line-height: 1.05;
}

.profile-copy p {
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 17px;
  font-weight: 800;
}

.summary-card,
.panel-card {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(7, 95, 56, 0.08);
  border-radius: 18px;
  box-shadow: 0 14px 36px rgba(35, 74, 49, 0.08);
}

/* --- Savings -------------------------------------------------------------- */

.summary-card {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 22px;
  padding: 28px 26px;
}

.summary-content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.summary-icon {
  display: grid;
  width: 74px;
  height: 74px;
  min-width: 74px;
  place-items: center;
  border-radius: 999px;
  font-size: 38px;
}

.icon-fund {
  color: #27962b;
  background: #e4f4df;
}

.summary-label {
  color: #202b27;
  font-size: 15px;
  font-weight: 900;
}

.summary-value {
  margin-top: 14px;
  color: #006043;
  font-size: 40px;
  font-weight: 950;
  line-height: 1;
}

.summary-value span {
  margin-left: 6px;
  font-size: 20px;
  font-weight: 900;
}

.summary-shortfall {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  color: #c0392b;
  font-size: 14px;
  font-weight: 800;
}

.summary-shortfall .q-icon {
  font-size: 18px;
}

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

/* --- Eligibility + next round ---------------------------------------------- */

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  margin-top: 22px;
}

.panel-card {
  padding: 26px 28px;
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #111f18;
  font-size: 20px;
  font-weight: 950;
}

.panel-title .q-icon {
  color: #087f49;
  font-size: 26px;
}

.condition-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.condition-chip.is-pass {
  color: #15913c;
  background: #e5f2e4;
}

.condition-chip.is-pending {
  color: #b3690f;
  background: #fdf0dc;
}

.condition-list {
  display: grid;
  gap: 14px;
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
}

.condition-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6f7876;
  font-size: 15px;
  font-weight: 800;
}

.condition-item .q-icon {
  flex-shrink: 0;
  color: #d0584a;
  font-size: 22px;
}

.condition-item.is-pass {
  color: #18231e;
}

.condition-item.is-pass .q-icon {
  color: #21a538;
}

.condition-label {
  min-width: 0;
  flex: 1;
}

/* Date on the left, time pill on the right - always one row. When space runs
   out the date gives way (it may wrap), never the pill dropping below it. */
.round-body {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
}

/* ต.ค. over 13 - the date at a glance. */
.round-day-tile {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  color: #0f3d24;
  background: #d9f25b;
  border-radius: 14px;
  line-height: 1;
}

.round-day-month {
  font-size: 12px;
  font-weight: 800;
}

.round-day-num {
  margin-top: 3px;
  font-size: 28px;
  font-weight: 950;
}

.round-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.round-date {
  color: #0f3d24;
  font-size: clamp(17px, 4.6vw, 21px);
  font-weight: 950;
  line-height: 1.25;
}

.round-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  background: #eef8ef;
  color: #22503c;
  font-size: 13.5px;
  font-weight: 800;
  white-space: nowrap;
}

.round-meta .q-icon {
  color: #087f49;
  font-size: 18px;
}

.round-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  color: #98a19d;
  font-size: 15px;
  font-weight: 800;
}

.round-empty .q-icon {
  font-size: 24px;
}

/* The next round: a plain white card with a lime date tile and faint leaf
   outlines - it catches the eye without reading as a warning. */
.panel-card--round {
  position: relative;
  overflow: hidden;
  background: #ffffff;
}

.round-leaf {
  position: absolute;
  border: 3px solid rgba(132, 204, 76, 0.34);
  border-radius: 100% 0 100% 0;
  transform: rotate(-25deg);
  pointer-events: none;
}

.round-leaf-one {
  right: 104px;
  bottom: 12px;
  width: 120px;
  height: 50px;
}

.round-leaf-two {
  right: -16px;
  bottom: -28px;
  width: 180px;
  height: 88px;
  opacity: 0.8;
}

/* Text above the leaves. */
.panel-card--round > :not(.round-leaf) {
  position: relative;
  z-index: 1;
}

/* How soon: วันนี้ / พรุ่งนี้ / อีก N วัน. */
.round-when {
  padding: 4px 12px;
  color: #1e4d16;
  background: #d9f25b;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

/* --- Member navigation ------------------------------------------------------ */

.member-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.member-action {
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

.action-label-part {
  display: inline-block;
  white-space: nowrap;
}

.member-action :deep(.q-icon) {
  margin-bottom: 6px;
  color: #087f49;
  font-size: 30px;
}

.member-action.is-primary {
  color: #ffffff;
  background: linear-gradient(135deg, #00693f, #0a9a52);
  border-color: transparent;
  box-shadow: 0 14px 30px rgba(7, 95, 56, 0.22);
}

.member-action.is-primary :deep(.q-icon) {
  color: #ffffff;
}

@media (max-width: 720px) {
  .member-home-page {
    padding: 16px;
  }

  .member-hero {
    padding: 24px;
  }

  .hero-profile {
    align-items: flex-start;
    flex-direction: column;
  }

  /* Brand stays on the left and the status pill sits in the card's top-right
     corner instead of dropping below the brand. */
  .hero-top-row {
    align-items: flex-start;
    gap: 10px;
  }

  .hero-brand {
    min-width: 0;
    gap: 8px;
    font-size: 18px;
    line-height: 1.25;
  }

  .hero-brand .q-icon {
    font-size: 28px;
  }

  .hero-status {
    flex-shrink: 0;
    gap: 6px;
    min-height: 30px;
    padding: 0 12px;
    font-size: 13px;
  }

  .hero-status span {
    width: 8px;
    height: 8px;
  }

  /* Center just the avatar in the hero card; name/number stay left-aligned. */
  .member-avatar {
    align-self: center;
  }

  /* Member number + village as a small caption under the name, so it sits on
     the left instead of stretching across the whole card. */
  .profile-copy p {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
  }

  .summary-card,
  .panel-card {
    padding: 22px;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .member-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .member-action {
    min-height: 84px;
    font-size: 15px;
  }
}
</style>
