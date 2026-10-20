<template>
  <q-page class="muni-page">
    <div class="muni-shell route-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="route" />
          </div>
          <div class="hero-copy">
            <h1>แผนที่รับซื้อขยะ</h1>
            <p>เส้นทางที่กรรมการหมู่บ้านยืนยันและส่งมาให้ กดเลือกจุดที่กำลังจะไป หรือจุดที่รับแล้ว</p>
          </div>
          <q-btn
            unelevated no-caps
            icon="refresh"
            label="โหลดใหม่"
            class="hero-add-btn"
            :loading="routePlanStore.loading"
            @click="loadPlans"
          />
        </div>
      </section>

      <q-banner v-if="routePlanStore.error" dense rounded class="error-banner q-mt-lg">
        <template #avatar><q-icon name="error_outline" color="negative" /></template>
        {{ routePlanStore.error }}
      </q-banner>

      <div v-else-if="!routePlanStore.loading && !plans.length" class="empty-card q-mt-lg">
        <q-icon name="map" size="42px" />
        <div class="empty-title">ยังไม่มีแผนที่รับซื้อ</div>
        <div class="empty-sub">
          เมื่อกรรมการหมู่บ้านยืนยันแผนเส้นทาง แผนที่จะแสดงที่หน้านี้ทันที
        </div>
      </div>

      <template v-else>
        <!-- Plan picker: only shown when more than one village sent a run. -->
        <div v-if="plans.length > 1" class="plan-tabs q-mt-lg">
          <q-chip
            v-for="plan in plans"
            :key="plan.id"
            clickable
            square
            :class="['plan-tab', { 'is-active': plan.id === selectedPlanId }]"
            @click="selectPlan(plan.id)"
          >
            แผนที่ #{{ plan.id }} · {{ plan.villageArea?.villageName ?? 'ไม่ระบุหมู่บ้าน' }}
            <q-badge class="q-ml-sm" color="amber-8">
              {{ routePlanStore.remainingCountOf(plan) }}
            </q-badge>
          </q-chip>
        </div>

        <div v-if="activePlan" class="plan-grid q-mt-lg">
          <!-- ============ Left: the stop list the buyer works down ============ -->
          <q-card flat class="panel-card panel-card--flush picker-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">
                  จุดรับซื้อ ({{ activePlan.stops.length }} จุด)
                </div>
                <div class="panel-caption">
                  {{ activePlan.villageArea?.villageName ?? 'ไม่ระบุหมู่บ้าน' }} ·
                  รวมประมาณ {{ formatKm(activePlan.totalDistanceKm ?? 0) }} ·
                  เหลืออีก {{ routePlanStore.remainingCountOf(activePlan) }} จุด
                </div>
              </div>
              <q-chip
                dense square class="status-chip"
                :color="planStatusMeta(activePlan.status).color"
                :text-color="planStatusMeta(activePlan.status).textColor"
                :icon="planStatusMeta(activePlan.status).icon"
              >
                {{ planStatusMeta(activePlan.status).label }}
              </q-chip>
            </div>

            <div class="stop-scroll">
              <div
                v-for="stop in activePlan.stops"
                :key="stop.id"
                class="stop-card"
                :class="[`is-${stop.status}`, { 'is-focused': stop.id === focusedStopId }]"
                @click="focusStop(stop)"
              >
                <div class="stop-card-head">
                  <div class="stop-number" :class="`num-${stop.status}`">{{ stop.sequence }}</div>
                  <div class="stop-card-info">
                    <div class="stop-name">
                      {{ stop.request.member.prefix ?? '' }}{{ stop.request.member.firstName }}
                      {{ stop.request.member.lastName }}
                    </div>
                    <div class="stop-sub">
                      {{ addressText(stop) }}
                    </div>
                    <div class="stop-meta">
                      <span>ประมาณ {{ stop.request.estimatedQuantity }} กก.</span>
                      <span v-if="stop.legDistanceKm">· +{{ formatKm(stop.legDistanceKm) }}</span>
                    </div>
                  </div>
                  <q-chip
                    dense square class="status-chip"
                    :color="stopStatusMeta(stop.status).color"
                    :text-color="stopStatusMeta(stop.status).textColor"
                    :icon="stopStatusMeta(stop.status).icon"
                  >
                    {{ stopStatusMeta(stop.status).label }}
                  </q-chip>
                </div>

                <div class="stop-card-actions" @click.stop>
                  <q-btn
                    dense no-caps unelevated
                    color="amber-8"
                    icon="navigation"
                    label="กำลังไปจุดนี้"
                    :disable="stop.status === 'next' || isClosed(stop)"
                    :loading="routePlanStore.markingStopId === stop.id"
                    @click="mark(stop, 'next')"
                  />
                  <q-btn
                    dense no-caps unelevated
                    color="positive"
                    icon="check"
                    label="รับแล้ว"
                    :disable="stop.status === 'collected'"
                    :loading="routePlanStore.markingStopId === stop.id"
                    @click="mark(stop, 'collected')"
                  />
                  <q-btn dense flat round icon="more_vert" :disable="routePlanStore.markingStopId === stop.id">
                    <q-menu>
                      <q-list dense style="min-width: 170px">
                        <q-item clickable v-close-popup @click="mark(stop, 'skipped')">
                          <q-item-section avatar><q-icon name="block" color="red-7" /></q-item-section>
                          <q-item-section>ข้ามจุดนี้</q-item-section>
                        </q-item>
                        <q-item clickable v-close-popup @click="mark(stop, 'pending')">
                          <q-item-section avatar><q-icon name="undo" /></q-item-section>
                          <q-item-section>ย้อนกลับเป็นยังไม่ไป</q-item-section>
                        </q-item>
                        <q-separator />
                        <q-item
                          clickable v-close-popup
                          :href="`tel:${stop.request.member.phone}`"
                        >
                          <q-item-section avatar><q-icon name="call" /></q-item-section>
                          <q-item-section>โทรหาสมาชิก</q-item-section>
                        </q-item>
                        <q-item clickable v-close-popup :href="stopNavUrl(stop)" target="_blank">
                          <q-item-section avatar><q-icon name="near_me" /></q-item-section>
                          <q-item-section>นำทางไปจุดนี้</q-item-section>
                        </q-item>
                      </q-list>
                    </q-menu>
                  </q-btn>
                </div>
              </div>
            </div>
          </q-card>

          <!-- ============ Right: map ============ -->
          <div class="map-column">
            <q-card flat class="panel-card panel-card--flush">
              <div class="panel-head map-head">
                <div>
                  <div class="panel-title">เส้นทางที่กรรมการวางไว้</div>
                  <div class="panel-caption">
                    <template v-if="nextStop">
                      จุดถัดไป: ลำดับที่ {{ nextStop.sequence }} —
                      {{ nextStop.request.member.prefix ?? '' }}{{ nextStop.request.member.firstName }}
                      {{ nextStop.request.member.lastName }}
                    </template>
                    <template v-else>ยังไม่ได้เลือกจุดถัดไป</template>
                  </div>
                </div>
                <div class="map-actions">
                  <div class="start-origin-label">
                    <q-icon :name="buyerStartPoint ? 'my_location' : 'flag'" />
                    <span>{{ startOriginLabel }}</span>
                  </div>
                  <q-btn
                    dense no-caps unelevated
                    class="toolbar-btn"
                    icon="my_location"
                    label="ใช้ตำแหน่งฉันเป็นจุดเริ่ม"
                    :loading="geolocating"
                    @click="useMyLocationAsStart"
                  />
                  <q-btn
                    v-if="buyerStartPoint"
                    dense no-caps flat
                    class="toolbar-btn toolbar-btn--flat"
                    icon="restart_alt"
                    label="ใช้จุดเริ่มเดิม"
                    @click="clearBuyerStartPoint"
                  />
                  <q-btn
                    dense no-caps unelevated
                    class="toolbar-btn"
                    icon="near_me"
                    label="นำทางทั้งเส้นทาง"
                    :href="googleMapsUrl"
                    target="_blank"
                  />
                </div>
              </div>
              <div ref="mapEl" class="map-box"></div>
            </q-card>
          </div>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiErrorMessage } from 'src/utils/apiError';
import {
  planStatusMeta,
  stopStatusMeta,
  useRoutePlanStore,
  type RoutePlan,
  type RouteStop,
  type RouteStopStatus,
} from 'src/stores/routePlanStore';
import { midNotify } from 'components/MID';

// The buyer's side of the pickup run. The committee already worked out the
// order on its own map (CommitteeRoutePlanPage) - nothing is re-planned here.
// This page redraws that exact route and lets the driver mark progress: one
// stop at a time as "กำลังไปจุดนี้" (which also pings the member), and each stop
// as "รับแล้ว" when done.

const routePlanStore = useRoutePlanStore();

const selectedPlanId = ref<number | null>(null);
const focusedStopId = ref<number | null>(null);
const buyerStartPoint = ref<{ lat: number; lng: number } | null>(null);
const geolocating = ref(false);

const plans = computed(() => routePlanStore.plans);
const activePlan = computed<RoutePlan | null>(
  () => plans.value.find((plan) => plan.id === selectedPlanId.value) ?? plans.value[0] ?? null,
);
const nextStop = computed(() =>
  activePlan.value ? routePlanStore.nextStopOf(activePlan.value) : null,
);
const activeOriginPoint = computed(() => {
  const plan = activePlan.value;
  if (buyerStartPoint.value) return buyerStartPoint.value;
  if (!plan) return null;
  if (plan.startLat !== null && plan.startLng !== null) {
    return { lat: plan.startLat, lng: plan.startLng };
  }
  return null;
});
const startOriginLabel = computed(() => {
  if (buyerStartPoint.value) return 'จุดเริ่ม: ตำแหน่งของฉัน';
  if (activeOriginPoint.value) return 'จุดเริ่ม: จุดที่กรรมการกำหนด';
  return 'จุดเริ่ม: ให้ Google Maps ใช้ตำแหน่งปัจจุบัน';
});

// Leaflet objects stay out of Vue reactivity - wrapping them in proxies breaks
// Leaflet's internal bookkeeping (same note as the committee page).
const mapEl = ref<HTMLElement | null>(null);
const map = shallowRef<L.Map | null>(null);
let markerLayer: L.LayerGroup | null = null;
let routeLine: L.Polyline | null = null;

function isClosed(stop: RouteStop): boolean {
  return stop.status === 'collected' || stop.status === 'skipped';
}

function addressText(stop: RouteStop): string {
  if (stop.request.pickupAddress && !/\?{3,}/.test(stop.request.pickupAddress)) {
    return stop.request.pickupAddress;
  }
  const home = stop.request.member.household;
  if (!home) return 'ไม่ระบุที่อยู่';
  const parts = [
    home.houseNo ? `บ้านเลขที่ ${home.houseNo}` : null,
    home.moo ? `หมู่ ${home.moo}` : null,
    home.subdistrict ? `ต.${home.subdistrict}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'ไม่ระบุที่อยู่';
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(2)} กม.`;
}

function stopNavUrl(stop: RouteStop): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${stop.lat},${stop.lng}`,
    travelmode: 'driving',
  });
  const origin = activeOriginPoint.value;
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const googleMapsUrl = computed(() => {
  const plan = activePlan.value;
  if (!plan?.stops.length) return '';
  const coords = plan.stops.map((stop) => `${stop.lat},${stop.lng}`);
  const destination = coords[coords.length - 1]!;
  const waypoints = coords.slice(0, -1).join('|');
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
  const origin = activeOriginPoint.value;
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
});

// --- Actions ------------------------------------------------------------------

async function loadPlans() {
  await routePlanStore.fetchBuyerPlans();
  if (routePlanStore.error) {
    midNotify({ type: 'error', message: routePlanStore.error });
    return;
  }
  // Keep the current plan selected across refreshes; fall back to the first.
  if (!plans.value.some((plan) => plan.id === selectedPlanId.value)) {
    selectedPlanId.value = plans.value[0]?.id ?? null;
  }
}

function selectPlan(planId: number) {
  selectedPlanId.value = planId;
  focusedStopId.value = null;
}

async function mark(stop: RouteStop, status: RouteStopStatus) {
  const plan = activePlan.value;
  if (!plan) return;

  try {
    const updated = await routePlanStore.markStop(plan.id, stop.id, status);
    if (status === 'next') {
      midNotify({ type: 'success', message: 'ตั้งเป็นจุดถัดไปแล้ว และแจ้งสมาชิกให้เตรียมของ' });
    } else if (status === 'collected') {
      midNotify({ type: 'success', message: 'บันทึกว่ารับจุดนี้แล้ว' });
    }
    if (updated.status === 'completed') {
      midNotify({ type: 'success', message: 'รับครบทุกจุดแล้ว แผนนี้เสร็จสมบูรณ์' });
      // A completed plan leaves the active board - reload so the next run shows.
      await loadPlans();
    }
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'อัปเดตสถานะจุดรับซื้อไม่สำเร็จ') });
  }
}

function focusStop(stop: RouteStop) {
  focusedStopId.value = stop.id;
  map.value?.setView([stop.lat, stop.lng], 16);
}

function useMyLocationAsStart() {
  if (!navigator.geolocation) {
    midNotify({ type: 'error', message: 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง' });
    return;
  }

  geolocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      buyerStartPoint.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      geolocating.value = false;
      midNotify({ type: 'success', message: 'ใช้ตำแหน่งปัจจุบันเป็นจุดเริ่มต้นแล้ว' });
      void nextTick(() => {
        refreshMap();
      });
    },
    () => {
      geolocating.value = false;
      midNotify({
        type: 'error',
        message: 'ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่งบนเบราว์เซอร์',
      });
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}

function clearBuyerStartPoint() {
  buyerStartPoint.value = null;
  refreshMap();
}

// --- Map ----------------------------------------------------------------------

// Default center: Chonburi (Buu area) - overridden by fitBounds as soon as the
// plan has any stop.
const DEFAULT_CENTER: [number, number] = [13.2827, 100.9256];

function pinIcon(label: string, cls: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="pin-marker ${cls}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function ensureMap() {
  if (map.value || !mapEl.value) return;

  const leafletMap = L.map(mapEl.value, { zoomControl: true }).setView(DEFAULT_CENTER, 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(leafletMap);
  markerLayer = L.layerGroup().addTo(leafletMap);
  map.value = leafletMap;
}

function refreshMap() {
  const leafletMap = map.value;
  const plan = activePlan.value;
  if (!leafletMap || !markerLayer) return;

  markerLayer.clearLayers();
  if (routeLine) {
    routeLine.remove();
    routeLine = null;
  }
  if (!plan) return;

  const bounds: L.LatLngExpression[] = [];
  const origin = activeOriginPoint.value;

  if (origin) {
    L.marker([origin.lat, origin.lng], {
      icon: pinIcon('⚑', buyerStartPoint.value ? 'pin-my-start' : 'pin-start'),
    })
      .bindTooltip(buyerStartPoint.value ? 'จุดเริ่มต้นจากตำแหน่งของฉัน' : 'จุดเริ่มต้นที่กรรมการกำหนด')
      .addTo(markerLayer);
    bounds.push([origin.lat, origin.lng]);
  }

  if (buyerStartPoint.value && plan.startLat !== null && plan.startLng !== null) {
    L.marker([plan.startLat, plan.startLng], { icon: pinIcon('D', 'pin-original-start') })
      .bindTooltip('จุดเริ่มต้นเดิมที่กรรมการกำหนด')
      .addTo(markerLayer);
    bounds.push([plan.startLat, plan.startLng]);
  }

  for (const stop of plan.stops) {
    const name = `${stop.request.member.prefix ?? ''}${stop.request.member.firstName} ${stop.request.member.lastName}`;
    L.marker([stop.lat, stop.lng], { icon: pinIcon(String(stop.sequence), `pin-${stop.status}`) })
      .bindTooltip(
        `ลำดับที่ ${stop.sequence}: ${name}<br>${stopStatusMeta(stop.status).label}<br>${addressText(stop)}`,
      )
      .on('click', () => focusStop(stop))
      .addTo(markerLayer);
    bounds.push([stop.lat, stop.lng]);
  }

  const path: L.LatLngExpression[] = [];
  if (origin) path.push([origin.lat, origin.lng]);
  for (const stop of plan.stops) path.push([stop.lat, stop.lng]);
  if (path.length > 1) {
    routeLine = L.polyline(path, {
      color: '#159757',
      weight: 4,
      opacity: 0.85,
      dashArray: '8 6',
    }).addTo(leafletMap);
  }

  if (bounds.length) {
    leafletMap.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
  }
}

// The map lives inside a v-if branch, so it only exists once a plan has loaded -
// mount it on the tick after the branch renders, then keep it in sync.
watch(
  activePlan,
  async () => {
    await nextTick();
    ensureMap();
    // Leaflet mis-sizes a container that was hidden when the map was created.
    map.value?.invalidateSize();
    refreshMap();
  },
  { deep: true },
);

watch(buyerStartPoint, () => {
  refreshMap();
});

onMounted(() => {
  void loadPlans();
});

onBeforeUnmount(() => {
  map.value?.remove();
  map.value = null;
  markerLayer = null;
  routeLine = null;
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.route-shell {
  width: min(1360px, 100%);
}

.hero-add-btn {
  margin-left: auto;
  background: #ffffff;
  color: #165339;
  font-weight: 600;
  border-radius: 12px;
  padding: 8px 20px;
}

.plan-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 18px;
  align-items: start;
}

@media (max-width: 1023px) {
  .plan-grid {
    grid-template-columns: 1fr;
  }
}

.panel-card--flush .panel-head {
  padding: 22px 26px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.map-head {
  flex-wrap: wrap;
}

.map-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  max-width: 560px;
}

.start-origin-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  color: #33584a;
  background: #f7fbf8;
  border: 1px solid #e0e9e2;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.toolbar-btn {
  color: #33584a;
  background: #f2f6f2;
  border: 1px solid #e0e9e2;
  border-radius: 10px;
  font-weight: 700;
}

.toolbar-btn--flat {
  background: #ffffff;
}

.plan-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.plan-tab {
  border-radius: 10px;
  font-weight: 700;
  background: #ffffff;
  border: 1px solid #e0e9e2;
  color: #33584a;

  &.is-active {
    background: #159757;
    color: #ffffff;
    border-color: #159757;
  }
}

.stop-scroll {
  max-height: 620px;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.stop-card {
  padding: 12px 14px;
  margin-top: 10px;
  border: 1px solid #e6ede7;
  border-left: 4px solid #cdd8d0;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;

  &:hover {
    background: #f7fbf8;
  }

  &.is-next {
    border-left-color: #f59e0b;
    background: #fffaf0;
  }

  &.is-collected {
    border-left-color: #159757;
    opacity: 0.75;
  }

  &.is-skipped {
    border-left-color: #dc2626;
    opacity: 0.65;
  }

  &.is-focused {
    box-shadow: 0 0 0 2px rgba(21, 151, 87, 0.35);
  }
}

.stop-card-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.stop-card-info {
  flex: 1;
  min-width: 0;
}

.stop-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  flex: none;
  background: #64748b;

  &.num-next {
    background: linear-gradient(135deg, #d97706, #f59e0b);
  }

  &.num-collected {
    background: linear-gradient(135deg, #159757, #17c13f);
  }

  &.num-skipped {
    background: #dc2626;
  }
}

.stop-name {
  color: #16352a;
  font-weight: 700;
  font-size: 14px;
}

.stop-sub {
  margin-top: 2px;
  color: #6b7770;
  font-size: 12.5px;
  font-weight: 600;
}

.stop-meta {
  margin-top: 3px;
  display: flex;
  gap: 6px;
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
}

.stop-card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}

.status-chip {
  font-weight: 700;
  border-radius: 8px;
  flex: none;
}

.map-box {
  height: 560px;
  border-radius: 0 0 18px 18px;
  z-index: 0;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 56px 24px;
  background: #ffffff;
  border: 1px solid #e6ede7;
  border-radius: 18px;
  color: #9aa59d;
}

.empty-title {
  color: #16352a;
  font-weight: 700;
  font-size: 15px;
}

.empty-sub {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

// Leaflet divIcon markers are injected outside this component's scope.
:deep(.pin-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 4px;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(22, 53, 42, 0.35);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  background: #64748b;
}

:deep(.pin-next) {
  background: linear-gradient(135deg, #d97706, #f59e0b);
}

:deep(.pin-collected) {
  background: linear-gradient(135deg, #159757, #17c13f);
}

:deep(.pin-skipped) {
  background: #dc2626;
}

:deep(.pin-start) {
  background: #0f172a;
  border-radius: 50%;
}

:deep(.pin-my-start) {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  border-radius: 50%;
}

:deep(.pin-original-start) {
  background: #94a3b8;
  border-radius: 50%;
  opacity: 0.86;
}
</style>
