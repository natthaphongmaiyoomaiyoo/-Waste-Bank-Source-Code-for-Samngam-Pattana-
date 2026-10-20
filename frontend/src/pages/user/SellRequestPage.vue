<template>
  <q-page class="member-page">
    <div class="page-shell">
      <section class="page-hero">
        <div class="hero-heading">
          <div class="hero-icon"><q-icon name="recycling" /></div>
          <div class="page-title">แจ้งขอขายขยะ</div>
        </div>
      </section>

      <div class="request-layout q-mt-lg">
        <main class="request-main">
          <q-card flat class="content-card">
            <q-card-section>
              <div class="section-head">
                <div class="section-icon icon-blue"><q-icon name="event" /></div>
                <div>
                  <div class="section-title">เลือกรอบรับซื้อขยะ</div>
                </div>
              </div>

              <div v-if="scheduleStore.loading" class="empty-box q-mt-md">
                <q-spinner-dots size="26px" color="green-8" />
                กำลังโหลดรอบรับซื้อ...
              </div>

              <div v-else-if="scheduleStore.error" class="warning-box q-mt-md">
                <q-icon name="error_outline" /> {{ scheduleStore.error }}
              </div>

              <div v-else-if="!availableSchedules.length" class="empty-box q-mt-md">
                <q-icon name="event_busy" size="26px" />
                ยังไม่มีรอบรับซื้อที่เปิดให้แจ้งขาย
              </div>

              <div v-else class="schedule-list q-mt-md">
                <button
                  v-for="schedule in pagedSchedules"
                  :key="schedule.id"
                  type="button"
                  class="schedule-card"
                  :class="{
                    selected: form.scheduleId === schedule.id,
                    'is-locked': isLocked(schedule),
                  }"
                  :disabled="isLocked(schedule)"
                  @click="selectSchedule(schedule)"
                >
                  <div class="date-box">
                    <strong>{{ dateParts(schedule.date).day }}</strong>
                    <span>{{ dateParts(schedule.date).month }}</span>
                  </div>
                  <div class="schedule-info">
                    <div class="schedule-village">{{ schedule.villageName }}</div>
                    <div class="schedule-time">
                      <q-icon name="schedule" size="14px" />
                      {{ schedule.timeStart }}-{{ schedule.timeEnd }} น.
                    </div>
                    <div v-if="schedule.note" class="schedule-note">
                      <q-icon name="sticky_note_2" size="14px" />
                      <span>หมายเหตุ: {{ schedule.note }}</span>
                    </div>
                    <div
                      v-if="scheduleAvailability(schedule) === 'not-open'"
                      class="schedule-locked"
                    >
                      <q-icon name="lock_clock" size="13px" />
                      เปิดให้แจ้งวันที่ {{ formatOpensOn(schedule) }}
                    </div>
                    <div v-else-if="alreadyRequested(schedule)" class="schedule-requested">
                      <q-icon name="task_alt" size="13px" />
                      แจ้งขายรอบนี้แล้ว หากต้องการแจ้งใหม่ ให้ยกเลิกคำขอเดิมก่อน
                    </div>
                  </div>
                  <q-icon
                    v-if="form.scheduleId === schedule.id"
                    name="check_circle"
                    class="selected-icon"
                  />
                </button>
              </div>

              <div v-if="schedulePageCount > 1" class="schedule-pager-row q-mt-sm">
                <span class="schedule-pager-caption">
                  {{
                    schedulePageStart === schedulePageEnd
                      ? schedulePageStart
                      : `${schedulePageStart}–${schedulePageEnd}`
                  }}
                  จาก {{ availableSchedules.length }} รอบ
                </span>
                <q-pagination
                  v-model="schedulePage"
                  :max="schedulePageCount"
                  :max-pages="5"
                  boundary-numbers
                  direction-links
                  flat
                  color="grey-7"
                  active-color="positive"
                  class="schedule-pager"
                />
              </div>

              <q-input
                v-model="form.note"
                label="หมายเหตุถึงกรรมการ"
                placeholder="เช่น จุดนัดรับ หรือช่วงเวลาที่สะดวก"
                outlined
                dense
                class="q-mt-md"
              >
                <template #prepend><q-icon name="edit_note" /></template>
              </q-input>
            </q-card-section>
          </q-card>

          <q-card flat class="content-card">
            <q-card-section>
              <div class="section-head">
                <div class="section-icon icon-green"><q-icon name="my_location" /></div>
                <div>
                  <div class="section-title">ตำแหน่งรับขยะ</div>
                </div>
              </div>

              <div class="geo-box q-mt-md">
                <div v-if="hasPickupPin" class="geo-info">
                  <div class="geo-title">
                    พิกัด {{ geo.lat!.toFixed(5) }}, {{ geo.lng!.toFixed(5) }}
                    <span class="geo-source">{{
                      geo.source === 'pin' ? 'ปักหมุดเอง' : 'ตำแหน่งปัจจุบัน'
                    }}</span>
                  </div>
                </div>
                <div class="geo-actions">
                  <q-btn
                    unelevated
                    no-caps
                    icon="my_location"
                    label="ตำแหน่งปัจจุบัน"
                    class="geo-btn"
                    :loading="geo.status === 'loading'"
                    @click="requestLocation"
                  />
                  <q-btn
                    outline
                    no-caps
                    icon="place"
                    :label="hasPickupPin ? 'แก้ไขหมุด' : 'ปักหมุดบนแผนที่'"
                    class="geo-btn-outline"
                    @click="openPinPicker"
                  />
                  <q-btn
                    v-if="hasPickupPin"
                    flat
                    no-caps
                    icon="delete_outline"
                    label="ล้างพิกัด"
                    class="geo-clear-btn"
                    @click="clearPin"
                  />
                </div>
              </div>

              <div v-if="hasPickupPin" ref="previewMapEl" class="geo-preview q-mt-md"></div>
            </q-card-section>
          </q-card>
        </main>

        <aside class="request-summary">
          <q-card flat class="content-card summary-card">
            <q-card-section>
              <div class="section-head">
                <div class="section-icon icon-dark"><q-icon name="receipt_long" /></div>
                <div>
                  <div class="section-title">สรุปคำขอขายขยะ</div>
                </div>
              </div>

              <div class="summary-rows q-mt-md">
                <div class="summary-row">
                  <span>รอบรับซื้อ</span>
                  <strong v-if="selectedSchedule">
                    {{ dateParts(selectedSchedule.date).day }}
                    {{ dateParts(selectedSchedule.date).month }} ·
                    {{ selectedSchedule.timeStart }}-{{ selectedSchedule.timeEnd }} น.
                  </strong>
                  <em v-else>ยังไม่ได้เลือก</em>
                </div>
                <div class="summary-row">
                  <span>ตำแหน่งรับขยะ</span>
                  <strong v-if="hasPickupPin">ระบุพิกัดแล้ว</strong>
                  <em v-else>ยังไม่ได้ระบุ</em>
                </div>
              </div>

              <q-btn
                unelevated
                icon="send"
                label="ส่งคำขอขายขยะ"
                class="primary-btn full-width q-mt-lg"
                :loading="submitting"
                :disable="submitting"
                @click="submitRequest"
              />
              <div v-if="showScheduleHint && !selectedSchedule" class="submit-hint">
                กรุณาเลือกรอบรับซื้อก่อน
              </div>
            </q-card-section>
          </q-card>
        </aside>
      </div>
    </div>

    <q-dialog v-model="pinPicker.open" @show="onPickerShow" @hide="onPickerHide">
      <q-card class="pin-dialog">
        <q-card-section class="pin-dialog-head">
          <div>
            <div class="section-title">ปักหมุดตำแหน่งรับขยะ</div>
            <div class="geo-caption">แตะบนแผนที่ หรือลากหมุด ไปยังจุดที่ต้องการให้ไปรับขยะ</div>
          </div>
          <q-space />
          <q-btn v-close-popup flat round dense icon="close" />
        </q-card-section>

        <div ref="pickerMapEl" class="pin-dialog-map"></div>

        <q-card-section class="pin-dialog-foot">
          <div class="pin-dialog-coord">
            <q-icon name="place" size="18px" />
            <span v-if="pinPicker.lat !== null && pinPicker.lng !== null">
              {{ pinPicker.lat.toFixed(5) }}, {{ pinPicker.lng.toFixed(5) }}
            </span>
            <span v-else>ยังไม่ได้ปักหมุด</span>
          </div>
          <div class="pin-dialog-actions">
            <q-btn
              flat
              no-caps
              dense
              icon="my_location"
              label="ไปตำแหน่งปัจจุบัน"
              :loading="pinPicker.locating"
              @click="centerPickerOnMe"
            />
            <q-btn
              unelevated
              no-caps
              dense
              label="ใช้ตำแหน่งนี้"
              class="geo-btn"
              :disable="pinPicker.lat === null"
              @click="confirmPin"
            />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <MidSuccessDialog
      v-model="submittedOpen"
      title="ส่งคำขอขายขยะสำเร็จ"
      :rows="submittedRows"
      secondary-label="ปิด"
      primary-label="ดูคำขอขายขยะ"
      @primary="goToRequestHistory"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from 'src/boot/axios';
import { useScheduleStore, scheduleAvailability, formatOpensOn } from 'src/stores/scheduleStore';
import type { WasteCollectionSchedule } from 'src/stores/models';
import { apiErrorMessage as backendErrorMessage } from 'src/utils/apiError';
import {
  MidSuccessDialog,
  isoToThaiShortDate,
  midNotify,
  type MidSuccessRow,
} from 'components/MID';

const route = useRoute();
const router = useRouter();
const scheduleStore = useScheduleStore();

const form = ref({
  scheduleId: null as string | null,
  note: '',
});
const submitting = ref(false);
// What was just sent, for the success dialog - captured before the form clears.
const submittedOpen = ref(false);
const submittedRows = ref<MidSuccessRow[]>([]);
// พิกัดจุดรับขยะที่จะแนบไปกับคำขอ - ได้มาจาก GPS ของเครื่อง ('gps')
// หรือจากการที่สมาชิกปักหมุดเองบนแผนที่ ('pin')
const geo = ref({
  status: (typeof navigator !== 'undefined' && 'geolocation' in navigator
    ? 'idle'
    : 'unsupported') as 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported',
  lat: null as number | null,
  lng: null as number | null,
  source: null as 'gps' | 'pin' | null,
});

// กล่องเลือกตำแหน่งบนแผนที่ (หมุดร่างก่อนกดยืนยัน)
const pinPicker = ref({
  open: false,
  locating: false,
  lat: null as number | null,
  lng: null as number | null,
});

// จุดกึ่งกลางเริ่มต้นเมื่อยังไม่มีหมุดเดิม (ชลบุรี/บริเวณ ม.บูรพา) - เหมือนหน้าวางแผนเส้นทาง
const DEFAULT_CENTER: [number, number] = [13.2827, 100.9256];

// ออบเจ็กต์ของ Leaflet ต้องอยู่นอกระบบ reactive ของ Vue (shallowRef/ตัวแปรธรรมดา)
// เพราะการห่อด้วย proxy จะทำให้ Leaflet ทำงานผิดพลาด
const pickerMapEl = ref<HTMLElement | null>(null);
const pickerMap = shallowRef<L.Map | null>(null);
let pickerMarker: L.Marker | null = null;
const previewMapEl = ref<HTMLElement | null>(null);
const previewMap = shallowRef<L.Map | null>(null);
let previewMarker: L.Marker | null = null;

// รอบที่เต็ม/ยกเลิก/ปิดแล้วไม่แสดงให้เลือกเลย ส่วนรอบที่ยังไม่ถึงกำหนดแจ้งล่วงหน้า
// ยังแสดงอยู่ (แต่กดไม่ได้) เพื่อให้สมาชิกรู้ว่ารอบนั้นเปิดให้แจ้งวันไหน
const availableSchedules = computed(() =>
  scheduleStore.openSchedules.filter((schedule) =>
    ['available', 'not-open'].includes(scheduleAvailability(schedule)),
  ),
);
// Rounds come a few at a time so a busy month doesn't push the rest of the
// form far down the phone screen.
const SCHEDULES_PER_PAGE = 4;
const schedulePage = ref(1);
const schedulePageCount = computed(() =>
  Math.max(1, Math.ceil(availableSchedules.value.length / SCHEDULES_PER_PAGE)),
);
const schedulePageStart = computed(() => (schedulePage.value - 1) * SCHEDULES_PER_PAGE + 1);
const schedulePageEnd = computed(() =>
  Math.min(schedulePage.value * SCHEDULES_PER_PAGE, availableSchedules.value.length),
);
const pagedSchedules = computed(() =>
  availableSchedules.value.slice(schedulePageStart.value - 1, schedulePageEnd.value),
);
// The list can shrink after a reload (a round fills up or closes) - never sit
// on a page past the end.
watch(schedulePageCount, (count) => {
  if (schedulePage.value > count) schedulePage.value = count;
});

const selectedSchedule = computed(
  () =>
    availableSchedules.value.find(
      (schedule) => schedule.id === form.value.scheduleId && !isLocked(schedule),
    ) ?? null,
);

// รอบที่สมาชิกแจ้งขายไปแล้วและคำขอยังไม่ถูกยกเลิก - แจ้งได้รอบละ 1 ครั้ง
// (backend ตรวจซ้ำอีกชั้นตอนส่ง) ยกเลิกคำขอเดิมแล้วรอบนั้นจะกลับมาเลือกได้
const requestedRoundIds = ref(new Set<string>());

async function fetchMyRequests() {
  try {
    const { data } = await api.get<{ roundId: number; status: string }[]>('/sell-requests');
    requestedRoundIds.value = new Set(
      data
        .filter((request) => request.status !== 'cancelled')
        .map((request) => String(request.roundId)),
    );
    // รอบที่ถูกเลือกไว้ก่อนโหลดเสร็จ (เช่นมาจาก ?roundId=) แต่แจ้งไปแล้ว - ไม่ให้ค้างอยู่
    if (form.value.scheduleId && requestedRoundIds.value.has(form.value.scheduleId)) {
      form.value.scheduleId = null;
    }
  } catch {
    // โหลดไม่ได้ก็ยังส่งคำขอได้ตามปกติ - backend จะปฏิเสธถ้าแจ้งซ้ำ
  }
}

function alreadyRequested(schedule: WasteCollectionSchedule) {
  return requestedRoundIds.value.has(schedule.id);
}

function isLocked(schedule: WasteCollectionSchedule) {
  return scheduleAvailability(schedule) !== 'available' || alreadyRequested(schedule);
}
// ไม่ต้องเลือกประเภทขยะแล้ว - กรรมการบันทึกประเภทและน้ำหนักจริงตอนไปรับซื้อ
// ขึ้นคำเตือนให้เลือกรอบเฉพาะตอนกดส่งโดยยังไม่ได้เลือกรอบ - ไม่แสดงค้างไว้ตั้งแต่แรก
// หรือหลังส่งสำเร็จ (ซึ่งทำให้สมาชิกสงสัยว่าคำขอเมื่อกี้ส่งไปแล้วหรือยัง)
const showScheduleHint = ref(false);
const hasPickupPin = computed(() => geo.value.lat !== null && geo.value.lng !== null);

function selectSchedule(schedule: WasteCollectionSchedule) {
  if (isLocked(schedule)) return;
  form.value.scheduleId = schedule.id;
}

// Arriving from "แจ้งขายรอบนี้" on the schedule page (?roundId=...): select that
// round as soon as the rounds have loaded. Only once - after a successful submit
// the form clears and must not snap back to the same round.
const requestedRoundId = typeof route.query.roundId === 'string' ? route.query.roundId : null;
let requestedRoundApplied = false;
watch(
  availableSchedules,
  (schedules) => {
    if (!requestedRoundId || requestedRoundApplied) return;
    const schedule = schedules.find((item) => item.id === requestedRoundId);
    if (!schedule) return;
    requestedRoundApplied = true;
    selectSchedule(schedule);
  },
  { immediate: true },
);

function requestLocation() {
  if (!('geolocation' in navigator)) {
    geo.value.status = 'unsupported';
    return;
  }
  geo.value.status = 'loading';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      geo.value = {
        status: 'granted',
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        source: 'gps',
      };
    },
    () => {
      geo.value.status = 'denied';
      midNotify({
        type: 'warning',
        message: 'ไม่สามารถอ่านตำแหน่งได้ ลองปักหมุดบนแผนที่แทน',
      });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

function clearPin() {
  geo.value.lat = null;
  geo.value.lng = null;
  geo.value.source = null;
  if (geo.value.status !== 'unsupported') geo.value.status = 'idle';
}

// --- ปักหมุดเองบนแผนที่ ------------------------------------------------------

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: '<div class="pickup-pin"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function openPinPicker() {
  pinPicker.value = {
    open: true,
    locating: false,
    lat: geo.value.lat,
    lng: geo.value.lng,
  };
}

function setDraftPin(lat: number, lng: number) {
  pinPicker.value.lat = lat;
  pinPicker.value.lng = lng;
  const map = pickerMap.value;
  if (!map) return;
  if (pickerMarker) {
    pickerMarker.setLatLng([lat, lng]);
    return;
  }
  pickerMarker = L.marker([lat, lng], { draggable: true, icon: pinIcon() })
    .bindTooltip('ลากเพื่อย้ายหมุด')
    .on('dragend', () => {
      const position = pickerMarker!.getLatLng();
      pinPicker.value.lat = position.lat;
      pinPicker.value.lng = position.lng;
    })
    .addTo(map);
}

// ภาพถ่ายดาวเทียม + ชื่อถนน/ชื่อสถานที่ซ้อนด้านบน ให้สมาชิกมองเห็นหลังคาบ้านตัวเอง
// แทนการเดาจากแผนที่ถนน ใช้ tile ฟรีของ Esri (ไม่ต้องใช้ API key)
const ESRI_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services';

function addSatelliteLayers(map: L.Map) {
  L.tileLayer(`${ESRI_TILES}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 19,
    attribution: 'ภาพถ่ายดาวเทียม &copy; Esri, Maxar, Earthstar Geographics',
  }).addTo(map);
  for (const overlay of ['World_Transportation', 'World_Boundaries_and_Places']) {
    L.tileLayer(`${ESRI_TILES}/Reference/${overlay}/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 19,
    }).addTo(map);
  }
}

// สร้างแผนที่ตอน @show (หลังไดอะล็อกมีขนาดจริงแล้ว) และทำลายทิ้งตอน @hide
function onPickerShow() {
  const el = pickerMapEl.value;
  if (!el) return;
  const hasDraft = pinPicker.value.lat !== null && pinPicker.value.lng !== null;
  const center: [number, number] = hasDraft
    ? [pinPicker.value.lat!, pinPicker.value.lng!]
    : DEFAULT_CENTER;
  const map = L.map(el, { zoomControl: true }).setView(center, hasDraft ? 17 : 13);
  addSatelliteLayers(map);
  map.on('click', (event: L.LeafletMouseEvent) => setDraftPin(event.latlng.lat, event.latlng.lng));
  pickerMap.value = map;
  if (hasDraft) setDraftPin(pinPicker.value.lat!, pinPicker.value.lng!);
  map.invalidateSize();
}

function onPickerHide() {
  pickerMap.value?.remove();
  pickerMap.value = null;
  pickerMarker = null;
}

function centerPickerOnMe() {
  if (!('geolocation' in navigator)) {
    midNotify({ type: 'warning', message: 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง' });
    return;
  }
  pinPicker.value.locating = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      pinPicker.value.locating = false;
      setDraftPin(position.coords.latitude, position.coords.longitude);
      pickerMap.value?.setView([position.coords.latitude, position.coords.longitude], 17);
    },
    () => {
      pinPicker.value.locating = false;
      midNotify({
        type: 'warning',
        message: 'ไม่สามารถอ่านตำแหน่งได้ แตะบนแผนที่เพื่อปักหมุดแทนได้',
      });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

function confirmPin() {
  const { lat, lng } = pinPicker.value;
  if (lat === null || lng === null) return;
  geo.value = { status: geo.value.status, lat, lng, source: 'pin' };
  pinPicker.value.open = false;
}

// --- แผนที่ตัวอย่างใต้กล่องพิกัด ----------------------------------------------

function renderPreview(el: HTMLElement) {
  const { lat, lng } = geo.value;
  if (lat === null || lng === null) return;
  const map = L.map(el, {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  }).setView([lat, lng], 17);
  addSatelliteLayers(map);
  previewMarker = L.marker([lat, lng], { icon: pinIcon() }).addTo(map);
  previewMap.value = map;
  map.invalidateSize();
}

watch(previewMapEl, (el) => {
  if (!el) {
    previewMap.value?.remove();
    previewMap.value = null;
    previewMarker = null;
    return;
  }
  void nextTick(() => {
    if (previewMapEl.value === el && !previewMap.value) renderPreview(el);
  });
});

watch(
  () => [geo.value.lat, geo.value.lng] as const,
  ([lat, lng]) => {
    const map = previewMap.value;
    if (!map || lat === null || lng === null) return;
    map.setView([lat, lng], 17);
    previewMarker?.setLatLng([lat, lng]);
  },
);

onBeforeUnmount(() => {
  pickerMap.value?.remove();
  pickerMap.value = null;
  previewMap.value?.remove();
  previewMap.value = null;
});

async function submitRequest() {
  const schedule = selectedSchedule.value;
  if (!schedule) {
    showScheduleHint.value = true;
    return;
  }

  submitting.value = true;
  try {
    await api.post('/sell-requests', {
      roundId: Number(schedule.id),
      note: form.value.note || undefined,
      ...(geo.value.lat !== null && geo.value.lng !== null
        ? { pickupLat: geo.value.lat, pickupLng: geo.value.lng }
        : {}),
    });

    submittedRows.value = [
      {
        label: 'รอบรับซื้อ',
        // Time on its own line - the two together are too long for one.
        value: `${isoToThaiShortDate(schedule.date)}\n${schedule.timeStart}-${schedule.timeEnd} น.`,
      },
      {
        label: 'พิกัดรับขยะ',
        value:
          geo.value.lat !== null && geo.value.lng !== null
            ? `${geo.value.lat.toFixed(5)}, ${geo.value.lng.toFixed(5)}`
            : 'ไม่ได้ระบุ',
      },
      ...(form.value.note ? [{ label: 'หมายเหตุ', value: form.value.note }] : []),
      {
        label: 'สถานะ',
        value: 'รอกรรมการรับเรื่อง',
        badge: { color: 'orange-1', textColor: 'orange-10' },
      },
    ];
    submittedOpen.value = true;
    requestedRoundIds.value.add(schedule.id);

    form.value.note = '';
    form.value.scheduleId = null;
    showScheduleHint.value = false;
  } catch (err) {
    midNotify({ type: 'error', message: backendErrorMessage(err, 'ส่งคำขอขายขยะไม่สำเร็จ') });
    // เช่นแจ้งรอบนี้ไปแล้วจากอีกแท็บ/อีกเครื่อง - โหลดใหม่ให้การ์ดรอบนั้นล็อกตามจริง
    void fetchMyRequests();
  } finally {
    submitting.value = false;
  }
}

function goToRequestHistory() {
  submittedOpen.value = false;
  void router.push('/sell-request-history');
}

function dateParts(value: string) {
  const parsed = new Date(value);
  return {
    day: new Intl.DateTimeFormat('th-TH', { day: 'numeric' }).format(parsed),
    month: new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(parsed),
  };
}

onMounted(() => {
  void scheduleStore.fetchSchedules();
  void fetchMyRequests();
});
</script>

<style scoped>
.member-page {
  min-height: 100%;
  padding: 24px;
  background: #f3f7f1;
}

.page-shell {
  max-width: 1180px;
  margin: 0 auto;
}

.page-hero,
.content-card {
  border: 1px solid #dfe9df;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(31, 71, 45, 0.07);
}

.page-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  color: #063f27;
}

.hero-heading,
.section-head,
.geo-box {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.hero-heading {
  align-items: center;
}

.hero-icon,
.section-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.hero-icon {
  width: 52px;
  height: 52px;
  color: #087f49;
  background: #e6f5ea;
  border-radius: 14px;
  font-size: 26px;
}

.page-title {
  color: #063f27;
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 900;
  line-height: 1.15;
}

.page-subtitle,
.section-caption,
.geo-caption {
  color: #6f7f76;
  line-height: 1.6;
}

.request-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
  gap: 24px;
  align-items: start;
}

.request-main {
  display: grid;
  gap: 24px;
}

.section-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  font-size: 20px;
}

.icon-blue {
  color: #1565c0;
  background: #e3f0fd;
}

.icon-green {
  color: #087f49;
  background: #e6f5ea;
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

.empty-box,
.warning-box,
.empty-state {
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

.warning-box {
  color: #8a5a12;
  background: #fff4e5;
  border-color: #f0cfa6;
}

.schedule-list,
.summary-rows {
  display: grid;
  gap: 12px;
}

.schedule-pager-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.schedule-pager-caption {
  color: #6d8a7c;
  font-size: 12.5px;
  font-weight: 700;
}

.schedule-pager :deep(.q-btn) {
  font-weight: 700;
}

.schedule-card {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

/* รอบที่ยังไม่ถึงกำหนดแจ้งล่วงหน้า - แสดงไว้ให้เห็นแต่กดเลือกไม่ได้ */
.schedule-card.is-locked {
  background: #f7f9f7;
  border-style: dashed;
  cursor: not-allowed;
  opacity: 0.75;
}

.schedule-card.is-locked .date-box {
  color: #7b8a80;
  background: #f0f2f0;
  border-color: #dfe5e0;
}

.schedule-locked {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: #8a5a12;
  font-size: 12px;
  font-weight: 600;
}

.schedule-requested {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 4px;
  color: #087f49;
  font-size: 12px;
  font-weight: 600;
}

.schedule-requested .q-icon {
  margin-top: 2px;
}

.schedule-card.selected {
  border-color: #35a463;
  background: linear-gradient(180deg, #f3faf4, #ffffff);
  box-shadow: 0 8px 20px rgba(31, 71, 45, 0.08);
}

.date-box {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  color: #075f38;
  background: #eef8ef;
  border: 1px solid #cfe8d2;
  border-radius: 12px;
}

.date-box strong {
  font-size: 18px;
  line-height: 1;
}

.date-box span {
  font-size: 11px;
  font-weight: 800;
}

.schedule-info {
  flex: 1;
  min-width: 0;
}

.schedule-village,
.geo-title {
  color: #16241c;
  font-weight: 800;
}

.schedule-time,
.schedule-note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 2px;
  color: #6f7f76;
  font-size: 12.5px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.schedule-note .q-icon {
  margin-top: 2px;
  color: #35a463;
}

.selected-icon {
  color: #35a463;
  font-size: 22px;
}

.geo-box {
  flex-direction: column;
  align-items: stretch;
  padding: 14px 16px;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  background: #f7faf6;
}

.geo-btn,
.primary-btn {
  color: #ffffff;
  background: #087f49;
  border-radius: 10px;
  font-weight: 800;
}

.geo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* The two main actions share the row evenly and wrap onto their own lines
   when the card gets narrow; ล้างพิกัด only takes the width it needs. */
.geo-actions .geo-btn,
.geo-actions .geo-btn-outline {
  flex: 1 1 190px;
  min-height: 46px;
  font-size: 14px;
}

.geo-actions .geo-clear-btn {
  flex: 0 0 auto;
  min-height: 46px;
}

.geo-btn-outline {
  color: #087f49;
  border-radius: 10px;
  font-weight: 800;
}

.geo-clear-btn {
  color: #9a5b56;
  font-weight: 700;
}

.geo-source {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e6f4ec;
  color: #087f49;
  font-size: 11px;
  font-weight: 800;
}

.geo-preview {
  height: 200px;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  overflow: hidden;
  z-index: 0;
}

.q-card.pin-dialog {
  width: 720px;
  max-width: 92vw;
  border-radius: 18px;
}

.pin-dialog-head,
.pin-dialog-foot {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pin-dialog-foot {
  justify-content: space-between;
  flex-wrap: wrap;
}

.pin-dialog-map {
  height: min(58vh, 420px);
  z-index: 0;
}

.pin-dialog-coord {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #16241c;
  font-weight: 800;
}

.pin-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* หมุดของ Leaflet ถูกแทรกนอก scope ของคอมโพเนนต์ */
:deep(.pickup-pin) {
  width: 26px;
  height: 26px;
  border: 3px solid #ffffff;
  border-radius: 50% 50% 50% 4px;
  background: linear-gradient(135deg, #087f49, #17c13f);
  box-shadow: 0 2px 8px rgba(22, 53, 42, 0.35);
}

.summary-card {
  position: sticky;
  top: 88px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-row span {
  color: #6f7f76;
  font-weight: 700;
}

.summary-row strong {
  color: #16241c;
  font-weight: 800;
  text-align: right;
}

.summary-row em {
  color: #8a5a12;
  font-style: normal;
  font-weight: 700;
}

.submit-hint {
  margin-top: 10px;
  color: #8a5a12;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

@media (max-width: 900px) {
  .request-layout {
    grid-template-columns: 1fr;
  }

  .summary-card {
    position: static;
  }
}

@media (max-width: 640px) {
  .member-page {
    padding: 16px;
  }
}
</style>
