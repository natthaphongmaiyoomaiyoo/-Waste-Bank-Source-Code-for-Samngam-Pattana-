<template>
  <q-page class="member-page">
    <div class="page-shell">
      <div class="page-hero q-mb-lg">
        <div class="hero-heading">
          <div class="hero-icon"><q-icon name="calendar_month" /></div>
          <div class="page-title">กำหนดการรับซื้อขยะ</div>
        </div>
      </div>

      <q-card flat class="content-card q-mb-lg">
        <q-card-section>
          <div class="section-head">
            <div class="section-icon icon-blue"><q-icon name="event" /></div>
            <div>
              <div class="section-title">รอบรับซื้อที่กำลังจะมาถึง</div>
            </div>
          </div>

          <div v-if="scheduleStore.loading" class="schedule-empty q-mt-md">
            <q-spinner-dots size="26px" color="green-8" />
            กำลังโหลดตารางรับซื้อขยะ...
          </div>

          <div v-else-if="scheduleStore.error" class="schedule-empty q-mt-md">
            <q-icon name="error_outline" size="26px" color="orange-9" />
            {{ scheduleStore.error }}
          </div>

          <div v-else-if="!upcomingSchedules.length" class="schedule-empty q-mt-md">
            <q-icon name="event_busy" size="26px" />
            ยังไม่มีรอบรับซื้อที่ประกาศในขณะนี้ กรุณารอประกาศจากกรรมการ
          </div>

          <div v-else class="schedule-list q-mt-md">
            <div
              v-for="schedule in upcomingSchedules"
              :key="schedule.id"
              :class="['schedule-card', `is-${schedule.availability}`]"
            >
              <div class="date-box">
                <div class="day">{{ dateParts(schedule.date).day }}</div>
                <div class="month">{{ dateParts(schedule.date).month }}</div>
              </div>

              <div class="schedule-info">
                <div class="schedule-village">{{ schedule.villageName }}</div>
                <div class="schedule-time">
                  <q-icon name="schedule" size="14px" /> {{ schedule.timeStart }}-{{ schedule.timeEnd }} น.
                </div>
                <div v-if="schedule.note" class="schedule-note">
                  <q-icon name="sticky_note_2" size="14px" />
                  <span>หมายเหตุ: {{ schedule.note }}</span>
                </div>
                <div v-if="schedule.availability !== 'available'" class="schedule-reason">
                  {{ availabilityReason(schedule) }}
                </div>
                <div v-else-if="isRequested(schedule)" class="schedule-reason schedule-reason--requested">
                  แจ้งขายรอบนี้แล้ว หากต้องการแจ้งใหม่ ให้ยกเลิกคำขอเดิมก่อน
                </div>
              </div>

              <div class="schedule-side">
                <!-- An open round needs no "ว่าง" chip: its แจ้งขายรอบนี้ button says it. -->
                <q-badge
                  v-if="schedule.availability !== 'available'"
                  :class="['schedule-chip', `chip-${schedule.availability}`]"
                >
                  {{ AVAILABILITY_LABELS[schedule.availability] }}
                </q-badge>
                <q-badge v-else-if="isRequested(schedule)" class="schedule-chip chip-requested">
                  <q-icon name="task_alt" size="13px" class="q-mr-xs" />
                  แจ้งขายแล้ว
                </q-badge>
                <q-btn
                  v-else
                  unelevated
                  no-caps
                  label="แจ้งขายรอบนี้"
                  icon="trending_up"
                  class="primary-btn"
                  :to="{ path: '/sell-request', query: { roundId: schedule.id } }"
                />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat class="content-card">
        <q-card-section>
          <div class="section-head">
            <div class="section-icon icon-dark"><q-icon name="history" /></div>
            <div>
              <div class="section-title">กิจกรรมที่ผ่านมา</div>
            </div>
          </div>

          <div v-if="!pastSchedules.length" class="schedule-empty q-mt-md">
            <q-icon name="inbox" size="26px" />
            ยังไม่มีประวัติรอบรับซื้อ
          </div>

          <div v-else class="schedule-list q-mt-md">
            <div v-for="schedule in pastSchedules" :key="schedule.id" class="schedule-card is-past">
              <div class="date-box muted">
                <div class="day">{{ dateParts(schedule.date).day }}</div>
                <div class="month">{{ dateParts(schedule.date).month }}</div>
              </div>

              <div class="schedule-info">
                <div class="schedule-village">{{ schedule.villageName }}</div>
                <div class="schedule-time">
                  <q-icon name="schedule" size="14px" /> {{ schedule.timeStart }}-{{ schedule.timeEnd }} น.
                </div>
              </div>

              <q-badge class="schedule-chip chip-past">
                <q-icon name="check_circle" size="12px" class="q-mr-xs" /> เสร็จสิ้น
              </q-badge>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from 'src/boot/axios';
import { useScheduleStore, scheduleAvailability, formatOpensOn } from 'src/stores/scheduleStore';
import type { WasteCollectionSchedule } from 'src/stores/models';

const scheduleStore = useScheduleStore();

type Availability = ReturnType<typeof scheduleAvailability>;

const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'ว่าง',
  full: 'เต็มแล้ว',
  closed: 'ปิดรับ',
  'not-open': 'ยังไม่เปิด',
};

const upcomingSchedules = computed(() =>
  scheduleStore.openSchedules.map((schedule) => ({ ...schedule, availability: scheduleAvailability(schedule) })),
);
const pastSchedules = computed(() => scheduleStore.pastSchedules);

// รอบที่แจ้งขายไม่ได้ตอนนี้ - บอกเหตุผลให้ตรงกับสถานะจริง
function availabilityReason(schedule: WasteCollectionSchedule & { availability: Availability }): string {
  if (schedule.availability === 'full') return 'มีผู้แจ้งขายเต็มจำนวนแล้ว';
  if (schedule.availability === 'not-open') {
    return `ยังไม่เปิดให้แจ้งขาย เปิดวันที่ ${formatOpensOn(schedule)}`;
  }
  return 'รอบนี้ปิดรับคำขอ';
}

// Rounds this member already has a live (not cancelled) request for - one
// request per round, same rule as SellRequestPage and the backend - so they
// get "แจ้งขายแล้ว" instead of the แจ้งขายรอบนี้ button.
const requestedRoundIds = ref(new Set<string>());

function isRequested(schedule: WasteCollectionSchedule): boolean {
  return requestedRoundIds.value.has(String(schedule.id));
}

async function fetchMyRequests() {
  try {
    const { data } = await api.get<{ roundId: number; status: string }[]>('/sell-requests');
    requestedRoundIds.value = new Set(
      data
        .filter((request) => request.status !== 'cancelled')
        .map((request) => String(request.roundId)),
    );
  } catch {
    // Without the list the buttons stay as they are; the sell-request page
    // and the backend still refuse a second request for the same round.
  }
}

onMounted(() => {
  void scheduleStore.fetchSchedules();
  void fetchMyRequests();
});

function dateParts(value: string) {
  const parsed = new Date(value);
  return {
    day: new Intl.DateTimeFormat('th-TH', { day: 'numeric' }).format(parsed),
    month: new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(parsed),
  };
}
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

.content-card {
  border: 1px solid #dfe9df;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(31, 71, 45, 0.07);
}

.section-head {
  display: flex;
  align-items: flex-start;
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

.icon-dark {
  color: #1f2d27;
  background: #eef1f0;
}

.section-title {
  color: #111f18;
  font-size: 17px;
  font-weight: 900;
}

.schedule-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  color: #6f7f76;
  background: #f7faf6;
  border: 1px dashed #cfe0d0;
  border-radius: 12px;
  font-weight: 700;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  background: #ffffff;
}

.schedule-card.is-full,
.schedule-card.is-closed,
.schedule-card.is-not-open,
.schedule-card.is-past {
  opacity: 0.7;
}

.date-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  min-width: 54px;
  color: #075f38;
  background: #eef8ef;
  border: 1px solid #cfe8d2;
  border-radius: 12px;
}

.date-box.muted {
  color: #65776d;
  background: #f2f5f2;
  border-color: #e0e7e0;
}

.date-box .day {
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
}

.date-box .month {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 800;
}

.schedule-info {
  min-width: 0;
  flex: 1;
}

.schedule-village {
  color: #16241c;
  font-size: 15px;
  font-weight: 800;
}

.schedule-time {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  color: #6f7f76;
  font-size: 12.5px;
  font-weight: 700;
}

.schedule-note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 4px;
  color: #7c877f;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.schedule-note .q-icon {
  margin-top: 1px;
  color: #35a463;
}

.schedule-reason {
  margin-top: 4px;
  color: #8a5a12;
  font-size: 12px;
  font-weight: 700;
}

.schedule-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.schedule-chip {
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 800;
  white-space: nowrap;
}

.chip-full,
.chip-not-open {
  color: #8a5a12;
  background: #fff4e5;
}

.chip-closed,
.chip-past {
  color: #667066;
  background: #eef1f0;
}

.chip-requested {
  display: inline-flex;
  align-items: center;
  color: #087f49;
  background: #dbf4df;
}

.schedule-reason--requested {
  color: #087f49;
}

.primary-btn {
  min-height: 36px;
  padding: 0 16px;
  color: white;
  background: #087f49;
  border-radius: 10px;
  font-weight: 800;
  font-size: 12.5px;
}

@media (max-width: 640px) {
  .member-page {
    padding: 16px;
  }

  .page-hero {
    padding: 20px;
  }

  /* The round's name keeps the whole width beside the date box; the chip and
     button drop to their own row underneath instead of squeezing the name
     into one word per line. 68px = date box (54) + card gap (14). */
  .schedule-card {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 10px 14px;
    padding: 14px;
  }

  .schedule-info {
    flex: 1 1 calc(100% - 68px);
  }

  .schedule-side,
  .schedule-card > .schedule-chip {
    margin-left: 68px;
  }

  .schedule-side {
    flex: 1 1 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .schedule-side .primary-btn {
    min-height: 32px;
    margin-top: 0 !important;
    padding: 0 12px;
    font-size: 12px;
  }
}
</style>
