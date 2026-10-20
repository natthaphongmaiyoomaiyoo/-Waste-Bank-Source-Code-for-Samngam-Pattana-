<template>
  <q-page class="muni-page">
    <div class="muni-shell pdf-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>
        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="picture_as_pdf" />
          </div>
          <div class="hero-copy">
            <h1>ออกรายงาน PDF</h1>
          </div>
        </div>
      </section>

      <div class="pdf-layout q-mt-lg">
        <q-card flat class="panel-card">
          <div class="panel-head">
            <div class="panel-title">1. เลือกประเภทรายงาน</div>
          </div>

          <div class="report-type-list q-mt-sm">
            <button
              v-for="option in reportTypeOptions"
              :key="option.value"
              type="button"
              class="report-type-item"
              :class="{ 'is-active': reportType === option.value }"
              @click="reportType = option.value"
            >
              <q-icon :name="option.icon" />
              <div class="report-type-copy">
                <div class="report-type-title">{{ option.label }}</div>
                <div class="report-type-caption">{{ option.caption }}</div>
              </div>
              <q-icon
                :name="reportType === option.value ? 'radio_button_checked' : 'radio_button_unchecked'"
                class="report-type-radio"
              />
            </button>
          </div>
        </q-card>

        <q-card flat class="panel-card">
          <div class="panel-head">
            <div class="panel-title">2. เงื่อนไขรายงาน</div>
          </div>

          <div class="filter-grid q-mt-md">
            <MidDateField v-model="dateFrom" label="ตั้งแต่วันที่" clearable />
            <MidDateField v-model="dateTo" label="ถึงวันที่" clearable />
            <q-select
              v-model="selectedMoo"
              dense
              outlined
              emit-value
              map-options
              :options="villageSelectOptions"
              label="หมู่บ้าน/พื้นที่"
            />
            <q-input v-model="preparedBy" dense outlined label="ชื่อผู้จัดทำ / หน่วยงาน" />
          </div>

          <div class="hint-line">
            ไม่เลือกช่วงวันที่ = ใช้ข้อมูลสะสมทั้งหมด · ข้อมูลดึงจากฐานข้อมูลจริง ณ เวลาที่กดออกรายงาน
          </div>

          <div class="action-row">
            <q-btn
              outline
              no-caps
              color="green-9"
              icon="visibility"
              label="ดูตัวอย่างรายงาน"
              :loading="previewBusy"
              :disable="downloadBusy"
              @click="openPreview"
            />
            <q-btn
              unelevated
              no-caps
              icon="download"
              label="ดาวน์โหลด PDF"
              class="download-btn"
              :loading="downloadBusy"
              :disable="previewBusy"
              @click="downloadPdf"
            />
          </div>
        </q-card>
      </div>

      <!-- รายงานการเสียชีวิตแยกไปอีกหน้า เพราะต้องเลือกผู้เสียชีวิตเป็นรายคนก่อน
           แล้วจึงออก PDF ของรายนั้น (ที่นี่ออกได้ทีละช่วงวันที่เท่านั้น) -->
      <q-card flat class="panel-card funeral-link-card q-mt-lg">
        <div class="funeral-link-row">
          <div class="funeral-link-icon">
            <q-icon name="volunteer_activism" />
          </div>
          <div class="funeral-link-copy">
            <div class="panel-title">รายงานการเสียชีวิต</div>
            <div class="funeral-link-caption">
              รายชื่อสมาชิกที่เสียชีวิต · จำนวนสมาชิกที่จ่ายเงินสมทบ 50 บาท และยอดเงินที่ทายาทได้รับ
              พร้อมออกเป็น PDF รายคน
            </div>
          </div>
          <q-btn
            unelevated
            no-caps
            icon-right="arrow_forward"
            label="เปิดรายงานการเสียชีวิต"
            class="download-btn"
            to="/municipality/funeral"
          />
        </div>
      </q-card>
    </div>

    <q-dialog v-model="previewOpen" @hide="revokePreviewUrl">
      <q-card class="preview-card">
        <div class="preview-head">
          <div class="panel-title">ตัวอย่าง: {{ REPORT_TITLES[reportType] }}</div>
          <div class="preview-actions">
            <q-btn
              unelevated
              dense
              no-caps
              icon="download"
              label="ดาวน์โหลด PDF"
              class="download-btn"
              :loading="downloadBusy"
              @click="downloadPdf"
            />
            <q-btn flat dense round icon="close" v-close-popup />
          </div>
        </div>
        <iframe v-if="previewUrl" :src="previewUrl" class="preview-frame" title="ตัวอย่างรายงาน PDF"></iframe>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import axios from 'axios';
import { api } from 'src/boot/axios';
import { MidDateField, midNotify } from 'components/MID';
import {
  REPORT_TITLES,
  createReportPdf,
  type PdfReportData,
  type ReportType,
} from 'src/pdf/municipalityReportPdf';


const reportType = ref<ReportType>('overview');
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const selectedMoo = ref<string | null>(null);
const preparedBy = ref('เจ้าหน้าที่เทศบาล');

const villageOptions = ref<{ moo: string; label: string }[]>([]);
const previewBusy = ref(false);
const downloadBusy = ref(false);
const previewOpen = ref(false);
const previewUrl = ref('');

const reportTypeOptions: { value: ReportType; label: string; caption: string; icon: string }[] = [
  {
    value: 'overview',
    label: REPORT_TITLES.overview,
    caption: 'สมาชิก หมู่บ้าน ปริมาณขยะ ยอดรับซื้อ และเงินสะสม',
    icon: 'dashboard',
  },
  {
    value: 'purchases',
    label: REPORT_TITLES.purchases,
    caption: 'รายการรับซื้อรายวัน/รายรอบ พร้อมน้ำหนักและมูลค่า',
    icon: 'event',
  },
  {
    value: 'wasteTypes',
    label: REPORT_TITLES.wasteTypes,
    caption: 'น้ำหนัก ราคาเฉลี่ย และมูลค่า แยกตามประเภทขยะ',
    icon: 'category',
  },
  {
    value: 'villages',
    label: REPORT_TITLES.villages,
    caption: 'ผลการรับซื้อและเงินสะสม แยกตามหมู่บ้าน/พื้นที่',
    icon: 'holiday_village',
  },
  {
    value: 'requests',
    label: REPORT_TITLES.requests,
    caption: 'จำนวนคำขอขายขยะแยกตามสถานะการดำเนินการ',
    icon: 'assignment',
  },
];

const villageSelectOptions = computed(() => [
  { label: 'ทุกหมู่บ้าน/พื้นที่', value: null },
  ...villageOptions.value.map((v) => ({ label: v.label, value: v.moo })),
]);

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { error?: string } | undefined)?.error;
    if (message) return message;
  }
  return fallback;
}

async function fetchReportData(): Promise<PdfReportData> {
  const { data } = await api.get<PdfReportData>('/municipality/reports/pdf-data', {
    params: {
      ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}),
      ...(dateTo.value ? { dateTo: dateTo.value } : {}),
      ...(selectedMoo.value ? { moo: selectedMoo.value } : {}),
    },
  });
  villageOptions.value = data.villageOptions;
  return data;
}

// โลโก้จาก public/icons - แนบใน PDF ถ้าโหลดได้ (โหลดไม่ได้ = ออกรายงานแบบไม่มีโลโก้)
const REPORT_LOGO_PATH = '/icons/สามง่าม.png';
let logoDataUrl: string | undefined;

async function loadLogo() {
  try {
    const response = await fetch(REPORT_LOGO_PATH);
    if (!response.ok) return;
    const blob = await response.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('unexpected reader result'));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    logoDataUrl = undefined;
  }
}

function buildPdf(data: PdfReportData) {
  return createReportPdf(reportType.value, data, {
    preparedBy: preparedBy.value.trim() || 'เจ้าหน้าที่เทศบาล',
    logoDataUrl,
  });
}

function revokePreviewUrl() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
}

async function openPreview() {
  previewBusy.value = true;
  try {
    const data = await fetchReportData();
    const blob = await new Promise<Blob>((resolve) => buildPdf(data).getBlob(resolve));
    revokePreviewUrl();
    previewUrl.value = URL.createObjectURL(blob);
    previewOpen.value = true;
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'สร้างตัวอย่างรายงานไม่สำเร็จ') });
  } finally {
    previewBusy.value = false;
  }
}

async function downloadPdf() {
  downloadBusy.value = true;
  try {
    const data = await fetchReportData();
    const stamp = new Date().toISOString().slice(0, 10);
    buildPdf(data).download(`waste-bank-${reportType.value}-${stamp}.pdf`);
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ดาวน์โหลดรายงานไม่สำเร็จ') });
  } finally {
    downloadBusy.value = false;
  }
}

onMounted(() => {
  void loadLogo();
  // โหลดครั้งแรกเพื่อเติมตัวเลือกหมู่บ้านใน dropdown
  void fetchReportData().catch(() => undefined);
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

.funeral-link-card {
  padding: 18px 22px;
}

.funeral-link-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.funeral-link-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  min-width: 46px;
  color: #0b4f36;
  background: #eef7f1;
  border-radius: 14px;
  font-size: 24px;
}

.funeral-link-copy {
  flex: 1;
  min-width: 0;
}

.funeral-link-caption {
  margin-top: 4px;
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
}

@media (max-width: 599px) {
  .funeral-link-row {
    flex-wrap: wrap;
  }

  .funeral-link-card .download-btn {
    width: 100%;
  }
}

.pdf-shell {
  width: min(1180px, 100%);
}

.pdf-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr);
  gap: 20px;
  align-items: start;
}

.report-type-list {
  display: grid;
  gap: 8px;
}

.report-type-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e0e9e2;
  border-radius: 12px;
  background: #fbfdfb;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.report-type-item > .q-icon:first-child {
  color: #0b7a47;
  font-size: 22px;
}

.report-type-item.is-active {
  border-color: #159757;
  background: #eef8ef;
}

.report-type-copy {
  min-width: 0;
  flex: 1;
}

.report-type-title {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 700;
}

.report-type-caption {
  margin-top: 2px;
  color: #83908a;
  font-size: 12px;
}

.report-type-radio {
  color: #9fb2a7;
  font-size: 20px;
}

.report-type-item.is-active .report-type-radio {
  color: #159757;
}

.filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.filter-grid .q-select,
.filter-grid .q-input:last-child {
  grid-column: 1 / -1;
}

.hint-line {
  margin-top: 10px;
  color: #83908a;
  font-size: 12px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.download-btn {
  color: #ffffff;
  background: linear-gradient(135deg, #159757, #17c13f);
  font-weight: 700;
}

.preview-card {
  display: flex;
  flex-direction: column;
  width: min(960px, calc(100vw - 32px));
  max-width: min(960px, calc(100vw - 32px)) !important;
  height: calc(100vh - 80px);
  border-radius: 14px;
  overflow: hidden;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e9e2;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-frame {
  flex: 1;
  width: 100%;
  border: none;
  background: #58606b;
}

@media (max-width: 900px) {
  .pdf-layout {
    grid-template-columns: 1fr;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
