<template>
  <q-page class="muni-page">
    <div class="muni-shell funeral-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="volunteer_activism" />
          </div>
          <div class="hero-copy">
            <h1>รายงานการเสียชีวิต</h1>
            <p>เงินฌาปนกิจสงเคราะห์ของสมาชิกที่เสียชีวิต</p>
          </div>
        </div>
      </section>

      <!-- Committee reports waiting for approval. Nothing has happened to these
           members or the fund yet - approving happens on the case page. -->
      <q-card
        v-if="pendingRows.length"
        flat
        class="panel-card panel-card--flush pending-card q-mt-lg"
      >
        <div class="panel-head">
          <div>
            <div class="panel-title">รอการอนุมัติ ({{ pendingRows.length }} ราย)</div>
            <div class="panel-caption">
              กรรมการหมู่บ้านแจ้งเสียชีวิตแล้ว ตรวจใบมรณะบัตรแล้วกดอนุมัติ ระบบจึงจะหักเงินฌาปนกิจ
            </div>
          </div>
        </div>
        <div class="case-list">
          <button
            v-for="row in pendingRows"
            :key="row.id"
            type="button"
            class="case-row is-pending"
            @click="openCase(row.id)"
          >
            <div class="case-date">
              <span class="case-day">{{ dayOf(row.deathDate) }}</span>
              <span class="case-month">{{ monthShortOf(row.deathDate) }}</span>
            </div>

            <div class="case-main">
              <div class="case-name">{{ row.deceasedMember.fullName }}</div>
              <div class="case-meta">
                รหัส {{ row.deceasedMember.memberCode }}
                <template v-if="row.deceasedMember.household?.moo">
                  · หมู่ {{ row.deceasedMember.household.moo }}
                </template>
                · {{ row.causeOfDeath }}
              </div>
            </div>

            <div class="case-figures">
              <div class="case-figure">
                <span class="figure-label">แจ้งเมื่อ</span>
                <span class="figure-value">{{ formatThaiDate(row.eventDate) }}</span>
              </div>
              <div class="case-figure">
                <span class="figure-label">สถานะ</span>
                <span class="figure-value is-pending">รออนุมัติ</span>
              </div>
            </div>

            <q-icon name="chevron_right" class="case-arrow" />
          </button>
        </div>
      </q-card>

      <!-- Totals across everything currently filtered, so the page answers
           "how much welfare money has been paid out" without opening a case. -->
      <div class="summary-grid">
        <article v-for="card in summaryCards" :key="card.label" class="summary-card">
          <div :class="['summary-icon', card.iconClass]">
            <q-icon :name="card.icon" />
          </div>
          <div class="summary-content">
            <div class="summary-label">{{ card.label }}</div>
            <div class="summary-value">
              {{ card.value }}
              <span>{{ card.unit }}</span>
            </div>
          </div>
        </article>
      </div>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">รายชื่อผู้เสียชีวิต</div>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="picture_as_pdf"
            label="ออกรายงานรายชื่อ (PDF)"
            class="pdf-btn"
            :disable="!rows.length"
            :loading="pdfBusy"
            @click="downloadListPdf"
          />
        </div>

        <div class="filter-row">
          <MidFilterBar
            v-model:search="search"
            search-label="ค้นหาชื่อ / รหัสสมาชิก"
            :search-debounce="400"
            title="กรองรายชื่อผู้เสียชีวิต"
            :active="activeFilters"
            @update:search="reload(1)"
            @clear="clearFilter"
            @clear-all="clearAllFilters"
          >
            <q-select
              v-model="villageAreaId"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="หมู่บ้าน"
              :options="villageOptions"
              :loading="villageAreaStore.loading"
            />
            <MidDateField v-model="dateFrom" label="เสียชีวิตตั้งแต่" clearable />
            <MidDateField v-model="dateTo" label="ถึงวันที่" clearable />
          </MidFilterBar>
        </div>

        <div v-if="slice.loading" class="loading-wrap">
          <q-spinner color="positive" size="42px" />
        </div>

        <q-banner v-else-if="slice.error" rounded class="error-banner q-ma-md">
          <template #avatar><q-icon name="error_outline" color="negative" /></template>
          {{ slice.error }}
          <template #action>
            <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="reload()" />
          </template>
        </q-banner>

        <div v-else-if="!rows.length" class="empty-state">
          <q-icon name="inbox" size="32px" />
          ไม่พบข้อมูลผู้เสียชีวิตตามเงื่อนไขที่เลือก
        </div>

        <template v-else>
          <div class="case-list">
            <button
              v-for="row in rows"
              :key="row.id"
              type="button"
              class="case-row"
              @click="openCase(row.id)"
            >
              <div class="case-date">
                <span class="case-day">{{ dayOf(row.deathDate) }}</span>
                <span class="case-month">{{ monthShortOf(row.deathDate) }}</span>
              </div>

              <div class="case-main">
                <div class="case-name">{{ row.deceasedMember.fullName }}</div>
                <div class="case-meta">
                  รหัส {{ row.deceasedMember.memberCode }}
                  <template v-if="row.deceasedMember.household?.moo">
                    · หมู่ {{ row.deceasedMember.household.moo }}
                  </template>
                  · {{ row.causeOfDeath }}
                </div>
              </div>

              <div class="case-figures">
                <div class="case-figure">
                  <span class="figure-label">ผู้จ่ายสมทบ</span>
                  <span class="figure-value">
                    {{ row.summary.paidInFullCount }}/{{ row.summary.chargedMemberCount }} คน
                  </span>
                </div>
                <div class="case-figure">
                  <span class="figure-label">ทายาทได้รับ</span>
                  <span class="figure-value is-money">
                    {{ formatBaht(row.summary.totalPayout) }} บาท
                  </span>
                </div>
              </div>

              <q-icon name="chevron_right" class="case-arrow" />
            </button>
          </div>

          <div class="pager-row">
            <span class="pager-info">
              แสดง {{ rangeStart }}–{{ rangeEnd }} จาก {{ totalRows.toLocaleString('th-TH') }} ราย
            </span>
            <q-pagination
              v-if="totalPages > 1"
              :model-value="page"
              :max="totalPages"
              :max-pages="5"
              boundary-numbers
              direction-links
              flat
              color="grey-7"
              active-color="positive"
              @update:model-value="reload"
            />
          </div>
        </template>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MidDateField, MidFilterBar, midNotify, type MidActiveFilter } from 'components/MID';
import { useMunicipalityStore } from 'src/stores/municipalityStore';
import { useVillageAreaStore, villageAreaLabel } from 'src/stores/villageAreaStore';
import { createFuneralListPdf } from 'src/pdf/funeralCaseReportPdf';
import { formatBaht, formatThaiDate, THAI_MONTH_NAMES } from './format';

// รายชื่อสมาชิกที่เสียชีวิต (funeral_case) สำหรับเจ้าหน้าที่เทศบาล - กดเข้าไปดูสรุป
// เงินฌาปนกิจของแต่ละรายได้ที่ /municipality/funeral/:id

const router = useRouter();
const store = useMunicipalityStore();
const villageAreaStore = useVillageAreaStore();

const PAGE_SIZE = 10;
const page = ref(1);

const slice = computed(() => store.funeralCases);
const rows = computed(() => slice.value.data?.items ?? []);
const pendingRows = computed(() => store.pendingFuneralCases.data?.items ?? []);
const totalPages = computed(() => slice.value.data?.totalPages ?? 1);
const totalRows = computed(() => slice.value.data?.total ?? 0);
const rangeStart = computed(() => (totalRows.value ? (page.value - 1) * PAGE_SIZE + 1 : 0));
const rangeEnd = computed(() => (page.value - 1) * PAGE_SIZE + rows.value.length);

const search = ref('');
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const villageAreaId = ref<number | null>(null);

const villageOptions = computed(() =>
  villageAreaStore.items.map((area) => ({ value: area.id, label: villageAreaLabel(area) })),
);

const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (villageAreaId.value) {
    const label = villageOptions.value.find((option) => option.value === villageAreaId.value)?.label;
    items.push({ key: 'village', label: 'หมู่บ้าน', value: label ?? '-' });
  }
  if (dateFrom.value) items.push({ key: 'from', label: 'ตั้งแต่', value: formatThaiDate(dateFrom.value) });
  if (dateTo.value) items.push({ key: 'to', label: 'ถึง', value: formatThaiDate(dateTo.value) });
  return items;
});

function clearFilter(key: string) {
  if (key === 'village') villageAreaId.value = null;
  if (key === 'from') dateFrom.value = null;
  if (key === 'to') dateTo.value = null;
}

function clearAllFilters() {
  villageAreaId.value = null;
  dateFrom.value = null;
  dateTo.value = null;
}

const summaryCards = computed(() => {
  // ยอดที่จ่ายให้ทายาทจริง = เงินสมทบ + เงินสะสมของผู้เสียชีวิตที่ปิดบัญชีเข้ากองทุน
  // (backend รวมมาให้ทุกรายการที่ตรงตัวกรอง ไม่ใช่เฉพาะหน้าที่แสดง)
  const received = slice.value.data?.totals.totalPayout ?? 0;
  const shortfall = slice.value.data?.totals.totalShortfall ?? 0;
  return [
    {
      label: 'ผู้เสียชีวิตในรายการ',
      value: totalRows.value.toLocaleString('th-TH'),
      unit: 'ราย',
      icon: 'sentiment_very_dissatisfied',
      iconClass: 'icon-blue',
    },
    {
      label: 'เงินสงเคราะห์ที่จ่ายแล้ว',
      value: formatBaht(received),
      unit: 'บาท',
      icon: 'volunteer_activism',
      iconClass: 'icon-green',
    },
    {
      label: 'เงินสมทบที่ยังค้าง',
      value: formatBaht(shortfall),
      unit: 'บาท',
      icon: 'error_outline',
      iconClass: 'icon-red',
    },
  ];
});

function dayOf(value: string): string {
  return String(Number(value.slice(8, 10)));
}

function monthShortOf(value: string): string {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  const name = THAI_MONTH_NAMES[(month ?? 1) - 1] ?? '';
  return `${name.slice(0, 3)} ${((year ?? 0) + 543) % 100}`;
}

function rangeLabel(): string {
  if (dateFrom.value && dateTo.value) {
    return `${formatThaiDate(dateFrom.value)} ถึง ${formatThaiDate(dateTo.value)}`;
  }
  if (dateFrom.value) return `ตั้งแต่ ${formatThaiDate(dateFrom.value)}`;
  if (dateTo.value) return `จนถึง ${formatThaiDate(dateTo.value)}`;
  return 'ข้อมูลสะสมทั้งหมด';
}

function openCase(caseId: number) {
  void router.push(`/municipality/funeral/${caseId}`);
}

const pdfBusy = ref(false);

// The PDF lists every case matching the filter, not just the page on screen.
async function downloadListPdf() {
  pdfBusy.value = true;
  try {
    const allRows = await store.fetchAllFuneralCases(currentFilters());
    const stamp = new Date().toISOString().slice(0, 10);
    createFuneralListPdf(allRows, {
      preparedBy: 'เจ้าหน้าที่เทศบาล',
      rangeLabel: rangeLabel(),
    }).download(`funeral-cases-${stamp}.pdf`);
  } catch {
    midNotify({ type: 'error', message: 'สร้างไฟล์ PDF ไม่สำเร็จ' });
  } finally {
    pdfBusy.value = false;
  }
}

// The list, its totals and the PDF cover approved deaths only - a pending
// report is shown in its own panel above.
function currentFilters() {
  return {
    search: search.value.trim() || undefined,
    dateFrom: dateFrom.value ?? undefined,
    dateTo: dateTo.value ?? undefined,
    villageAreaId: villageAreaId.value ?? undefined,
    status: 'approved' as const,
  };
}

function reload(nextPage?: number) {
  if (nextPage) page.value = nextPage;
  void store.fetchFuneralCases({ page: page.value, pageSize: PAGE_SIZE, ...currentFilters() });
}

// A new filter changes what the pages hold - start from the first page again.
watch([dateFrom, dateTo, villageAreaId], () => reload(1));

onMounted(() => {
  reload(1);
  void store.fetchPendingFuneralCases();
  if (!villageAreaStore.loaded) void villageAreaStore.fetchActive();
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

.funeral-shell {
  width: min(1180px, 100%);
}

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pdf-btn {
  color: #ffffff;
  background: linear-gradient(135deg, #0f9d52, #17c13f);
  border-radius: 12px;
  font-weight: 700;
}

.filter-row {
  padding: 16px 22px 4px;
}

.case-list {
  display: grid;
  gap: 10px;
  padding: 10px 18px 18px;
}

.case-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: #bcd9c6;
    box-shadow: 0 8px 20px rgba(23, 46, 34, 0.08);
  }
}

.case-date {
  display: grid;
  place-items: center;
  min-width: 62px;
  padding: 8px 6px;
  background: #eef4f8;
  border-radius: 12px;
  line-height: 1.1;
}

.case-day {
  color: #1c4f75;
  font-size: 21px;
  font-weight: 900;
}

.case-month {
  margin-top: 2px;
  color: #6b8299;
  font-size: 12px;
  font-weight: 700;
}

.case-main {
  flex: 1;
  min-width: 0;
}

.case-name {
  color: #16352a;
  font-size: 15px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.case-meta {
  margin-top: 3px;
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
}

.case-figures {
  display: flex;
  gap: 22px;
}

.case-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: right;
}

.figure-label {
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
}

.figure-value {
  color: #16352a;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;

  &.is-money {
    color: #0d7a44;
  }
}

.case-arrow {
  color: #b6c1ba;
  font-size: 20px;
}

// Waiting for approval: amber, so it reads as "needs you" next to the list.
.pending-card {
  border: 1px solid #f6dfb8;
}

.case-row.is-pending {
  border-color: #f6dfb8;

  &:hover {
    border-color: #ecc77f;
  }

  .case-date {
    background: #fff4e5;
  }

  .case-day {
    color: #8a5a12;
  }

  .case-month {
    color: #b0843e;
  }
}

.figure-value.is-pending {
  color: #b45309;
}

.pager-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 0 22px 18px;
}

.pager-info {
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .muni-hero {
    padding: 18px;
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

  .panel-head {
    flex-wrap: wrap;
    gap: 10px;
  }

  .pdf-btn {
    width: 100%;
  }

  .filter-row {
    padding: 12px 14px 2px;
  }

  .case-list {
    padding: 8px 12px 14px;
  }

  // Phone: the two figures move under the name instead of squeezing it.
  .case-row {
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px;
  }

  .case-main {
    flex: 1 1 60%;
  }

  .case-figures {
    flex: 1 1 100%;
    justify-content: space-between;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px dashed #e7efe8;
  }

  .case-figure {
    text-align: left;
  }

  .case-arrow {
    display: none;
  }
}
</style>
