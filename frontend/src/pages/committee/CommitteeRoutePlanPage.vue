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
            <h1>แสดงเส้นทางการรับซื้อ</h1>
            <p v-if="roundInfo">{{ roundInfo.buyerName }}</p>
          </div>
          <div v-if="roundInfo" class="hero-meta">
            <span class="hero-chip">
              <q-icon name="event" size="16px" />
              {{ roundInfo.date }}
            </span>
            <span class="hero-chip">
              <q-icon name="schedule" size="16px" />
              {{ roundInfo.time }}
            </span>
          </div>
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="เลือกรอบอื่น"
            class="hero-link-btn"
            to="/committee/route-plan"
          />
        </div>
      </section>

      <div class="plan-grid q-mt-lg">
        <!-- ============ Left: the run in visiting order, and what can't be on it ============ -->
        <div class="plan-col">
          <q-card flat class="panel-card panel-card--flush order-card">
            <div class="panel-head order-head">
              <div class="order-head-text">
                <div class="panel-title">
                  ลำดับการไปรับ<template v-if="plan"> ({{ plan.stops.length }} จุด)</template>
                </div>
                <div class="panel-caption">
                  รับเรื่องคำขอแล้ว ระบบปักจุดและจัดเส้นทางที่สั้นที่สุดให้อัตโนมัติ
                </div>
              </div>
              <q-btn dense flat round icon="refresh" :loading="loading" @click="load">
                <q-tooltip>โหลดใหม่</q-tooltip>
              </q-btn>
            </div>

            <q-banner v-if="loadError" dense rounded class="error-banner q-ma-md">
              <template #avatar><q-icon name="error_outline" color="negative" /></template>
              {{ loadError }}
            </q-banner>

            <template v-else-if="plan">
              <div class="plan-summary">
                <q-chip
                  dense
                  square
                  class="status-chip"
                  :color="planStatusMeta(plan.status).color"
                  :text-color="planStatusMeta(plan.status).textColor"
                  :icon="planStatusMeta(plan.status).icon"
                >
                  {{ planStatusMeta(plan.status).label }}
                </q-chip>
                <span class="summary-text">
                  เหลืออีก {{ remainingStops.length }} จุด
                  <template v-if="plan.totalDistanceKm">
                    · ระยะทางรวมประมาณ {{ formatKm(plan.totalDistanceKm) }}
                  </template>
                </span>
              </div>

              <!-- Same target as tapping the pin on the map. -->
              <div class="stop-rows">
                <div
                  v-for="stop in plan.stops"
                  :key="stop.id"
                  class="stop-row"
                  @click="openStopDetail(stop)"
                >
                  <div class="stop-number" :class="`is-${stop.status}`">{{ stop.sequence }}</div>
                  <div class="stop-info">
                    <div class="stop-name">{{ memberNameOf(stop) }}</div>
                    <div class="stop-sub">{{ stopAddress(stop) }}</div>
                  </div>
                  <q-chip
                    dense
                    square
                    class="status-chip"
                    :color="stopStatusMeta(stop.status).color"
                    :text-color="stopStatusMeta(stop.status).textColor"
                  >
                    {{ stopStatusMeta(stop.status).label }}
                  </q-chip>
                </div>
              </div>

              <div v-if="remainingStops.length" class="order-actions">
                <q-btn
                  dense
                  no-caps
                  unelevated
                  class="toolbar-btn"
                  icon="near_me"
                  label="นำทางจุดที่เหลือด้วย Google Maps"
                  :href="googleMapsUrl"
                  target="_blank"
                />
              </div>
            </template>

            <div v-else-if="!loading" class="empty-state">
              <q-icon name="wrong_location" size="32px" />
              ยังไม่มีจุดรับซื้อในรอบนี้
              <span class="empty-hint">เมื่อกรรมการรับเรื่องคำขอที่ปักหมุดไว้ จุดจะขึ้นที่นี่อัตโนมัติ</span>
            </div>
          </q-card>

          <!-- Accepted, but the member never pinned where to collect - the run
               can't include them, so they are listed here instead. -->
          <q-card
            v-if="noLocationRequests.length"
            flat
            class="panel-card panel-card--flush no-location-card"
          >
            <div class="panel-head">
              <div>
                <div class="panel-title">ไม่มีตำแหน่ง ({{ noLocationRequests.length }})</div>
                <div class="panel-caption">รับเรื่องแล้ว แต่สมาชิกไม่ได้ปักหมุด จึงไม่อยู่บนแผนที่</div>
              </div>
            </div>
            <div class="stop-rows">
              <router-link
                v-for="request in noLocationRequests"
                :key="request.id"
                :to="`/committee/sell-requests/${request.id}`"
                class="stop-row"
              >
                <q-icon name="location_off" class="no-location-icon" size="22px" />
                <div class="stop-info">
                  <div class="stop-name">
                    {{ request.member.prefix ?? '' }}{{ request.member.firstName }}
                    {{ request.member.lastName }}
                  </div>
                  <div class="stop-sub">
                    {{ request.member.phone }} · {{ requestAddress(request) }}
                  </div>
                </div>
                <q-icon name="chevron_right" class="row-arrow" />
              </router-link>
            </div>
          </q-card>
        </div>

        <!-- ================= Right: the map ================= -->
        <div class="plan-col map-column">
          <q-card flat class="panel-card panel-card--flush map-card">
            <div class="panel-head map-head">
              <div>
                <div class="panel-title">แผนที่จุดรับซื้อ</div>
                <div class="panel-caption">
                  จุดเริ่มต้น:
                  {{
                    startPoint
                      ? 'ปักหมุดแล้ว (ลากหมุดธงเพื่อย้ายได้)'
                      : 'กดปุ่มใช้ตำแหน่งฉัน หรือคลิกขวาบนแผนที่'
                  }}
                </div>
              </div>
              <div class="map-actions">
                <q-btn
                  dense
                  no-caps
                  unelevated
                  class="toolbar-btn"
                  icon="my_location"
                  label="ใช้ตำแหน่งฉันเป็นจุดเริ่ม"
                  :loading="locating || savingStart"
                  :disable="!plan"
                  @click="useMyLocation"
                />
              </div>
            </div>
            <div ref="mapEl" class="map-box"></div>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Who is behind a stop: opened from a pin on the map or a row in the list. -->
    <q-dialog :model-value="stopDetail !== null" @update:model-value="stopDetail = null">
      <q-card v-if="stopDetail" class="stop-card">
        <div class="stop-card-head">
          <div>
            <div class="stop-card-name">{{ memberNameOf(stopDetail) }}</div>
            <div class="stop-card-sub">
              จุดที่ {{ stopDetail.sequence }} · รหัส {{ stopDetail.request.member.memberCode }}
            </div>
          </div>
          <q-btn flat dense round icon="close" v-close-popup />
        </div>

        <q-separator />

        <div class="stop-card-body">
          <q-chip
            dense
            square
            class="status-chip"
            :color="stopStatusMeta(stopDetail.status).color"
            :text-color="stopStatusMeta(stopDetail.status).textColor"
            :icon="stopStatusMeta(stopDetail.status).icon"
          >
            {{ stopStatusMeta(stopDetail.status).label }}
          </q-chip>

          <dl class="stop-list-rows">
            <div>
              <dt>เบอร์โทร</dt>
              <dd>
                <a :href="`tel:${stopDetail.request.member.phone}`">
                  {{ stopDetail.request.member.phone }}
                </a>
              </dd>
            </div>
            <div>
              <dt>ที่อยู่</dt>
              <dd>{{ stopAddress(stopDetail) }}</dd>
            </div>
            <div>
              <dt>แจ้งขาย</dt>
              <dd>{{ stopDetail.request.estimatedQuantity }} กก.</dd>
            </div>
            <div v-if="stopDetail.legDistanceKm">
              <dt>ระยะจากจุดก่อนหน้า</dt>
              <dd>{{ formatKm(stopDetail.legDistanceKm) }}</dd>
            </div>
            <div v-if="stopDetail.note">
              <dt>หมายเหตุจากผู้รับซื้อ</dt>
              <dd>{{ stopDetail.note }}</dd>
            </div>
          </dl>

          <div v-if="stopDetail.request.items.length" class="stop-items">
            <div class="stop-items-title">ประเภทขยะที่แจ้ง</div>
            <div class="stop-item-chips">
              <span v-for="item in stopDetail.request.items" :key="item.id" class="stop-item-chip">
                {{ item.wasteType.wasteName }} · {{ item.estimatedQuantity }} กก.
              </span>
            </div>
          </div>
        </div>

        <q-separator />

        <div class="stop-card-actions">
          <q-btn
            flat
            no-caps
            icon="near_me"
            color="primary"
            label="นำทางไปจุดนี้"
            :href="`https://www.google.com/maps/dir/?api=1&destination=${stopDetail.lat},${stopDetail.lng}`"
            target="_blank"
          />
          <q-space />
          <q-btn
            flat
            no-caps
            icon="open_in_new"
            label="เปิดคำขอ"
            :to="`/committee/sell-requests/${stopDetail.request.id}`"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from 'src/boot/axios';
import { apiErrorMessage } from 'src/utils/apiError';
import { formatThaiDate } from '../municipality/format';
import type { CommitteeSellRequest, Paginated } from 'src/stores/committeeRequestStore';
import { useCommitteeRoundStore } from 'src/stores/committeeRoundStore';
import {
  planStatusMeta,
  stopStatusMeta,
  useRoutePlanStore,
  type RouteStop,
} from 'src/stores/routePlanStore';
import { midNotify } from 'components/MID';

// The pickup run of one round, as the system keeps it: accepting a sell request
// that has a pinned location puts it on the round's run and re-orders the run
// into the shortest path (backend routePlanService.addRequestToRoundPlan). The
// buyer sees the same run at once. All the committee does here is read it and
// choose where it starts - the unvisited stops are re-ordered from there.

const route = useRoute();
const routePlanStore = useRoutePlanStore();
const roundStore = useCommitteeRoundStore();

// The round on view (picked on /committee/route-plan).
const roundId = computed(() => Number(route.params.roundId));

const roundInfo = ref<{ buyerName: string; date: string; time: string } | null>(null);

const loading = ref(false);
const loadError = ref<string | null>(null);
const noLocationRequests = ref<CommitteeSellRequest[]>([]);
const locating = ref(false);
const savingStart = ref(false);

// One run per round for this village, so the list holds at most one plan.
const plan = computed(() => routePlanStore.plans[0] ?? null);

const remainingStops = computed(
  () => plan.value?.stops.filter((stop) => stop.status === 'pending' || stop.status === 'next') ?? [],
);

const startPoint = computed(() =>
  plan.value && plan.value.startLat !== null && plan.value.startLng !== null
    ? { lat: plan.value.startLat, lng: plan.value.startLng }
    : null,
);

// Leaflet objects are kept out of Vue reactivity (shallowRef/plain refs) -
// wrapping them in proxies breaks Leaflet's internal bookkeeping.
const mapEl = ref<HTMLElement | null>(null);
const map = shallowRef<L.Map | null>(null);
let markerLayer: L.LayerGroup | null = null;
let routeLine: L.Polyline | null = null;

// --- Data loading -----------------------------------------------------------

async function loadRoundHeader() {
  if (!roundId.value) return;
  try {
    const round = await roundStore.fetchRound(roundId.value);
    roundInfo.value = {
      buyerName: round.buyer.buyerName,
      date: formatThaiDate(round.roundDate),
      time: `${round.startTime}-${round.endTime} น.`,
    };
  } catch {
    // The header is decoration; the page works without it.
  }
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const [, requests] = await Promise.all([
      // Page 1: the store outlives the page, and another round's page number
      // could be past this round's last page.
      routePlanStore.fetchCommitteePlans(roundId.value, 1),
      api.get<Paginated<CommitteeSellRequest>>('/committee/sell-requests', {
        params: {
          status: 'confirmed',
          located: false,
          roundId: roundId.value,
          page: 1,
          pageSize: 100,
        },
      }),
    ]);
    if (routePlanStore.error) loadError.value = routePlanStore.error;
    noLocationRequests.value = requests.data.items;
    refreshMap();
  } catch {
    loadError.value = 'ไม่สามารถโหลดเส้นทางได้ กรุณาลองใหม่อีกครั้ง';
  } finally {
    loading.value = false;
  }
}

// --- Text helpers -------------------------------------------------------------

function isUnreadableAddress(value: string): boolean {
  return /\?{3,}/.test(value);
}

function householdAddress(
  home: CommitteeSellRequest['member']['household'],
  withDistrict: boolean,
): string {
  if (!home) return 'ไม่ระบุที่อยู่';
  const parts = [
    home.houseNo ? `บ้านเลขที่ ${home.houseNo}` : '',
    home.moo ? `หมู่ ${home.moo}` : '',
    home.subdistrict ? `ต.${home.subdistrict}` : '',
    withDistrict && home.district ? `อ.${home.district}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'ไม่ระบุที่อยู่';
}

function requestAddress(request: CommitteeSellRequest): string {
  if (request.pickupAddress && !isUnreadableAddress(request.pickupAddress)) {
    return request.pickupAddress;
  }
  return householdAddress(request.member.household, false);
}

function memberNameOf(stop: RouteStop): string {
  const member = stop.request.member;
  return `${member.prefix ?? ''}${member.firstName} ${member.lastName}`;
}

function stopAddress(stop: RouteStop): string {
  if (stop.request.pickupAddress && !isUnreadableAddress(stop.request.pickupAddress)) {
    return stop.request.pickupAddress;
  }
  return householdAddress(stop.request.member.household, true);
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(2)} กม.`;
}

// The stops still to visit, in order, from the start point when there is one.
const googleMapsUrl = computed(() => {
  const stops = remainingStops.value;
  if (!stops.length) return '';
  const coords = stops.map((stop) => `${stop.lat},${stop.lng}`);
  const destination = coords[coords.length - 1]!;
  const waypoints = coords.slice(0, -1).join('|');
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
  if (startPoint.value) params.set('origin', `${startPoint.value.lat},${startPoint.value.lng}`);
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
});

// --- Start point ----------------------------------------------------------------

// The server stores it and re-orders the unvisited stops from it, so the list,
// the line on the map and the buyer's board all follow.
async function setStartPoint(lat: number, lng: number) {
  const current = plan.value;
  if (!current) {
    midNotify({ type: 'warning', message: 'ยังไม่มีจุดรับซื้อในรอบนี้ จึงยังกำหนดจุดเริ่มต้นไม่ได้' });
    return;
  }
  savingStart.value = true;
  try {
    await routePlanStore.setStartPoint(current.id, lat, lng);
    refreshMap();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกจุดเริ่มต้นไม่สำเร็จ') });
  } finally {
    savingStart.value = false;
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    midNotify({ type: 'error', message: 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง' });
    return;
  }
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false;
      void setStartPoint(position.coords.latitude, position.coords.longitude);
    },
    () => {
      locating.value = false;
      midNotify({
        type: 'error',
        message: 'ไม่สามารถอ่านตำแหน่งได้ ลองคลิกขวาบนแผนที่เพื่อปักจุดเริ่มต้นแทน',
      });
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

// --- Stop detail ------------------------------------------------------------------

const stopDetail = ref<RouteStop | null>(null);

function openStopDetail(stop: RouteStop) {
  stopDetail.value = stop;
}

// --- Map rendering ------------------------------------------------------------

// Default center: Chonburi (Buu area) - overridden by fitBounds as soon as any
// pin exists.
const DEFAULT_CENTER: [number, number] = [13.2827, 100.9256];

function numberedIcon(label: string, cls: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="pin-marker ${cls}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// The run as stored: start flag, then every stop in visiting order coloured by
// what the buyer reported, joined by one line.
function refreshMap() {
  const leafletMap = map.value;
  if (!leafletMap || !markerLayer) return;

  markerLayer.clearLayers();
  if (routeLine) {
    routeLine.remove();
    routeLine = null;
  }

  const bounds: L.LatLngExpression[] = [];
  const path: L.LatLngExpression[] = [];

  if (startPoint.value) {
    const start = startPoint.value;
    const startMarker = L.marker([start.lat, start.lng], {
      draggable: true,
      icon: numberedIcon('⚑', 'pin-start'),
    })
      .bindTooltip('จุดเริ่มต้น (ลากเพื่อย้าย)')
      .on('dragend', () => {
        const position = startMarker.getLatLng();
        void setStartPoint(position.lat, position.lng);
      })
      .addTo(markerLayer);
    bounds.push([start.lat, start.lng]);
    path.push([start.lat, start.lng]);
  }

  for (const stop of plan.value?.stops ?? []) {
    L.marker([stop.lat, stop.lng], {
      icon: numberedIcon(String(stop.sequence), `pin-stop is-${stop.status}`),
    })
      .bindTooltip(`${stop.sequence}. ${memberNameOf(stop)} — แตะเพื่อดูรายละเอียด`)
      .on('click', () => openStopDetail(stop))
      .addTo(markerLayer);
    bounds.push([stop.lat, stop.lng]);
    path.push([stop.lat, stop.lng]);
  }

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

onMounted(() => {
  if (mapEl.value) {
    const leafletMap = L.map(mapEl.value, { zoomControl: true }).setView(DEFAULT_CENTER, 13);
    // แผนที่ภูมิประเทศจริง: แรเงาความสูงจาก Esri เป็นพื้น แล้วซ้อน OpenTopoMap ที่มี
    // เส้นชั้นความสูง ลำน้ำ ป่า และถนนในหมู่บ้านทับด้านบน
    // - OpenTopoMap มี tile ถึงซูม 17 เท่านั้น maxNativeZoom จึงบอกให้ Leaflet ขยาย
    //   ภาพของซูม 17 ต่อให้เอง แทนที่จะกลายเป็นจอว่างตอนซูมลึกกว่านั้น
    // - ทั้งสองชั้นเป็น tile ฟรี ไม่ต้องใช้ API key (Esri ชุดเดียวกับแผนที่ปักหมุด
    //   ของสมาชิกใน SellRequestPage)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 },
    ).addTo(leafletMap);
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      maxNativeZoom: 17,
      opacity: 0.85,
      attribution:
        'แผนที่ภูมิประเทศ &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), แรเงาความสูง &copy; Esri',
    }).addTo(leafletMap);
    markerLayer = L.layerGroup().addTo(leafletMap);
    leafletMap.on('contextmenu', (event: L.LeafletMouseEvent) => {
      void setStartPoint(event.latlng.lat, event.latlng.lng);
    });
    map.value = leafletMap;
  }
  void loadRoundHeader();
  void load();
});

onBeforeUnmount(() => {
  map.value?.remove();
  map.value = null;
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.route-shell {
  width: min(1360px, 100%);
}

// Left: the run in visiting order (and anything that can't be on it). Right:
// the map.
.plan-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 18px;
  align-items: start;
}

.plan-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

// One column: the map first, then the order, then what is off the map.
@media (max-width: 1023px) {
  .plan-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .plan-col {
    display: contents;
  }

  .map-card {
    order: 1;
  }

  .order-card {
    order: 2;
  }

  .no-location-card {
    order: 3;
  }
}

.panel-card--flush .panel-head {
  padding: 22px 26px 0;
}

// The caption is long: keep the reload button beside the title instead of
// letting the shared head wrap it onto a line of its own.
.order-head {
  flex-wrap: nowrap;
  align-items: flex-start;
}

.order-head-text {
  flex: 1;
  min-width: 0;
}

.map-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px !important;
}

.map-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-btn {
  color: #33584a;
  background: #f2f6f2;
  border: 1px solid #e0e9e2;
  border-radius: 10px;
  font-weight: 700;
}

.map-box {
  height: 560px;
  border-radius: 0 0 18px 18px;
  z-index: 0;
}

.plan-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 26px 4px;
}

.summary-text {
  color: #5c6b63;
  font-size: 13px;
  font-weight: 600;
}

.status-chip {
  font-weight: 700;
  border-radius: 8px;
}

.stop-rows {
  max-height: 520px;
  overflow-y: auto;
  padding: 6px 14px 14px;
}

.stop-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid #f0f4f1;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f4f9f6;
  }
}

// Same colours as the pins: blue still to visit, amber on the way, green
// collected, red skipped.
.stop-number {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: #ffffff;
  background: #1f6feb;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;

  &.is-next {
    background: linear-gradient(135deg, #d97706, #f59e0b);
  }

  &.is-collected {
    background: linear-gradient(135deg, #159757, #17c13f);
  }

  &.is-skipped {
    background: #b91c1c;
  }
}

.stop-info {
  flex: 1;
  min-width: 0;
}

.stop-name {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 700;
}

.stop-sub {
  margin-top: 2px;
  overflow: hidden;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.no-location-icon {
  flex: none;
  color: #b45309;
}

.row-arrow {
  color: #b6c1ba;
}

.order-actions {
  display: flex;
  padding: 0 26px 20px;

  .q-btn {
    flex: 1;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  color: #9aa59d;
  font-weight: 600;
  text-align: center;
}

.empty-hint {
  font-size: 12.5px;
  font-weight: 500;
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
}

:deep(.pin-start) {
  background: linear-gradient(135deg, #d97706, #f59e0b);
  border-radius: 50%;
}

// A stop of the run: blue until the buyer reports on it.
:deep(.pin-stop) {
  background: #1f6feb;
  cursor: pointer;
}

:deep(.pin-stop.is-next) {
  background: linear-gradient(135deg, #d97706, #f59e0b);
}

:deep(.pin-stop.is-collected) {
  background: linear-gradient(135deg, #159757, #17c13f);
}

:deep(.pin-stop.is-skipped) {
  background: #b91c1c;
}

// --- Round header -----------------------------------------------------------

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
}

.hero-link-btn {
  margin-left: auto;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  font-weight: 700;
}

// --- Stop detail dialog -------------------------------------------------------

.stop-card {
  width: min(460px, calc(100vw - 32px));
  border-radius: 18px;
}

.stop-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
}

.stop-card-name {
  color: #10241a;
  font-size: 18px;
  font-weight: 900;
}

.stop-card-sub {
  margin-top: 4px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 700;
}

.stop-card-body {
  padding: 16px 20px;
}

.stop-list-rows {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
}

.stop-list-rows div {
  display: flex;
  gap: 10px;
}

.stop-list-rows dt {
  min-width: 132px;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 800;
}

.stop-list-rows dd {
  margin: 0;
  color: #1c2b23;
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;

  a {
    color: #087f49;
    text-decoration: none;
  }
}

.stop-items {
  margin-top: 16px;
}

.stop-items-title {
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 800;
}

.stop-item-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.stop-item-chip {
  padding: 5px 10px;
  color: #16352a;
  background: #eef7f1;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.stop-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 14px;
}

// --- Phone --------------------------------------------------------------------
@media (max-width: 599px) {
  .muni-hero {
    padding: 18px;
  }

  .hero-row {
    gap: 12px;
  }

  .hero-icon {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 13px;
    font-size: 23px;
  }

  // `flex: 1` from the theme lets the title shrink to one word per line once the
  // round chips sit beside it. A real basis keeps the name on the first row and
  // pushes the chips onto their own.
  .hero-copy {
    flex: 1 1 150px;
  }

  .hero-copy h1 {
    font-size: 18.5px;
    line-height: 1.3;
  }

  .hero-meta {
    flex: 1 1 100%;
  }

  .hero-chip {
    padding: 5px 10px;
    font-size: 11.5px;
  }

  .hero-link-btn {
    width: 100%;
    margin-left: 0;
  }

  .plan-grid {
    gap: 12px;
  }

  .panel-card--flush .panel-head {
    padding: 16px 16px 0;
  }

  .plan-summary {
    padding: 10px 16px 4px;
  }

  .stop-rows {
    max-height: none;
    padding: 6px 8px 12px;
  }

  .order-actions {
    padding: 0 16px 16px;
  }

  .toolbar-btn {
    font-size: 12px;
  }

  .map-head {
    padding-bottom: 10px !important;
  }

  .map-actions {
    width: 100%;

    .q-btn {
      flex: 1 1 0;
      min-width: 0;
    }
  }

  .map-box {
    height: 340px;
  }

  .stop-list-rows dt {
    min-width: 104px;
    font-size: 12.5px;
  }

  .stop-list-rows dd {
    font-size: 12.5px;
  }
}
</style>
