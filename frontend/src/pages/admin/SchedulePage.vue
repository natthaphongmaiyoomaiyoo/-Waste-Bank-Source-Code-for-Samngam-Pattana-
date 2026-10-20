<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero dashboard-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="calendar_today" />
          </div>
          <div class="hero-copy">
            <h1>ตารางเก็บขยะ</h1>
          </div>
        </div>
      </section>

      <div class="dashboard-grid q-mt-lg">
        <div class="calendar-section">
          <q-card flat class="panel-card h-full">
            <div class="panel-head">
              <div>
                <div class="panel-title">ปฏิทินกิจกรรม</div>
              </div>
            </div>

            <q-date
              v-model="selectedDate"
              minimal
              flat
              full-width
              class="custom-calendar"
              :locale="midThaiDateLocale"
              :events="eventDates"
              event-color="primary"
            />
          </q-card>
        </div>

        <div class="events-section">
          <div class="row items-center justify-between q-mb-md">
            <div class="text-subtitle1 text-weight-bold text-grey-9">กิจกรรมที่กำลังจะมาถึง</div>
            <q-btn
              color="primary"
              icon="add"
              label="เพิ่มนัดหมาย"
              unelevated
              no-caps
              class="add-schedule-btn"
              @click="showAddDialog = true"
            />
          </div>

          <div
            v-if="scheduleStore.upcomingEvents.length === 0"
            class="empty-state q-mt-md"
          >
            <q-icon name="event_busy" size="48px" />
            ไม่มีกิจกรรมที่กำลังจะมาถึง
          </div>

          <div v-else class="event-list">
            <div
              v-for="event in scheduleStore.upcomingEvents"
              :key="event.id"
              class="event-card"
            >
              <div class="event-datebox">
                <div class="event-day">{{ formatDateDay(event.date) }}</div>
                <div class="event-month">{{ formatDateMonth(event.date) }}</div>
              </div>
              <div class="event-info">
                <div class="event-title">{{ event.villageName }}</div>
                <div class="event-time">
                  <q-icon name="access_time" /> {{ event.timeStart }} - {{ event.timeEnd }} น.
                </div>
                <div v-if="event.note" class="event-note">
                  {{ event.note }}
                </div>
              </div>
              <div class="event-actions">
                <q-btn flat round dense icon="edit" color="primary" size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="showAddDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon name="event_note" />
            </div>
            สร้างนัดหมายรับซื้อขยะใหม่
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="dialog-section-label">พื้นที่/หมู่บ้าน</div>
          <q-select outlined dense v-model="newSchedule.village" :options="villageOptions" class="q-mb-md" />

          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6">
              <div class="dialog-section-label">วันที่รับซื้อ</div>
              <MidDateField v-model="newSchedule.date" />
            </div>
            <div class="col-6">
              <div class="dialog-section-label">เวลา</div>
              <q-input outlined dense v-model="newSchedule.timeRange" placeholder="09:00 - 12:00">
                <template v-slot:append><q-icon name="access_time" color="primary" size="xs" /></template>
              </q-input>
            </div>
          </div>

          <div class="dialog-section-label">ประเภทขยะที่รับ/หมายเหตุ (ไม่บังคับ)</div>
          <q-input outlined dense v-model="newSchedule.note" type="textarea" rows="3" autogrow class="q-mb-sm" />

          <q-checkbox
            v-model="newSchedule.notify"
            label="ส่งแจ้งเตือนไปยังแอปสมาชิกทันที"
            color="primary"
            class="text-caption q-mt-sm"
          />
        </div>

        <div class="dialog-footer">
          <q-btn outline label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn unelevated label="บันทึกนัดหมาย" color="positive" icon="save" @click="saveSchedule" />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useScheduleStore } from 'src/stores/scheduleStore';
import { useVillageStore } from 'src/stores/villageStore';
import type { Village } from 'src/stores/models';
import { MidDateField, midThaiDateLocale } from 'components/MID';

const scheduleStore = useScheduleStore();
const villageStore = useVillageStore();

const selectedDate = ref(new Date().toLocaleDateString('en-CA').replace(/-/g, '/'));
const showAddDialog = ref(false);

const newSchedule = ref({
  village: '',
  date: new Date().toISOString().substring(0, 10),
  timeRange: '09:00 - 12:00',
  note: '',
  notify: true,
});

const villageOptions = computed(() =>
  villageStore.villages.map((v: Village) => ({
    label: v.name,
    value: v.id,
  })),
);

const eventDates = computed(() => scheduleStore.schedules.map((s) => s.date.replace(/-/g, '/')));

const formatDateDay = (dateStr: string) => new Date(dateStr).getDate();
const formatDateMonth = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
};

const saveSchedule = () => {
  const times = newSchedule.value.timeRange.split('-').map((t) => t.trim());
  scheduleStore.addSchedule({
    villageId: 'v1',
    villageName: newSchedule.value.village,
    date: newSchedule.value.date,
    timeStart: times[0] || '09:00',
    timeEnd: times[1] || '12:00',
    note: newSchedule.value.note,
  });

  newSchedule.value.note = '';
  showAddDialog.value = false;
};

onMounted(() => {
  const first = villageOptions.value?.[0];

  if (first) {
    newSchedule.value.village = first.label;
  }
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.dashboard-hero {
  min-height: 148px;
  display: flex;
  align-items: center;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 1fr);
  gap: 24px;
}

.h-full {
  height: 100%;
}

.add-schedule-btn {
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(20, 80, 58, 0.15);
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-card {
  display: flex;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(23, 46, 34, 0.05);
  overflow: hidden;
  transition: all 0.2s ease;
  padding: 16px;
}

.event-card:hover {
  border-color: #bcd9c6;
  box-shadow: 0 4px 14px rgba(23, 46, 34, 0.08);
  transform: translateY(-2px);
}

.event-datebox {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-right: 20px;
  border-right: 1px dashed #e0e8e2;
  min-width: 85px;
}

.event-day {
  font-size: 32px;
  font-weight: 800;
  color: #14503a;
  line-height: 1;
}

.event-month {
  font-size: 13px;
  color: #6d8075;
  font-weight: 600;
  margin-top: 4px;
  text-transform: uppercase;
}

.event-info {
  flex: 1;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.event-title {
  font-size: 16px;
  font-weight: 700;
  color: #26352d;
}

.event-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6d8075;
  font-weight: 500;
  margin-top: 4px;
}

.event-note {
  margin-top: 10px;
  background: #fdf6e3;
  color: #b07010;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  display: inline-block;
}

.event-actions {
  display: flex;
  align-items: flex-start;
  padding-left: 12px;
}

.custom-calendar {
  width: 100%;
  max-width: 100% !important;
}

:deep(.q-date__view) {
  padding: 16px;
  min-height: 450px;
}

:deep(.q-date__calendar-item button) {
  width: 40px;
  height: 40px;
  font-size: 15px;
}

:deep(.q-date__calendar-days-container .q-date__calendar-item) {
  font-size: 15px;
  font-weight: 600;
  color: #757575;
}

:deep(.q-date__navigation) {
  padding-bottom: 16px;
  font-size: 16px;
  font-weight: bold;
}

.edit-card {
  width: min(500px, 100%);
  max-width: calc(100vw - 24px);
  border-radius: 20px;
  box-shadow: 0 12px 32px rgba(23, 46, 34, 0.12);
  overflow: hidden;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
