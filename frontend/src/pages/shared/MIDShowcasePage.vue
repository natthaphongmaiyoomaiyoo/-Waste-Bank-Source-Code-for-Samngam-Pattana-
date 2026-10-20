<template>
  <q-layout view="hHh lpR fFf" class="mid-showcase-layout">
    <q-header class="showcase-header">
      <q-toolbar class="showcase-toolbar">
        <router-link to="/" class="showcase-brand">
          <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" />
          <span>ธนาคารขยะ</span>
        </router-link>

        <q-space />

        <MidButton label="กลับหน้าข่าวสาร" icon="arrow_back" variant="secondary" size="sm" to="/" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="mid-showcase-page">
        <section class="showcase-hero">
          <q-badge class="showcase-badge">
            <q-icon name="palette" />
            MID Component System
          </q-badge>
          <h1>ตัวอย่าง Component กลาง</h1>
          <p>ใช้เป็นหน้าตัวอย่างสำหรับสี ปุ่ม การ์ด dialog และรูปแบบข้อมูล เพื่อให้หน้าข่าวสารและหน้า user มีหน้าตาไปทางเดียวกัน</p>
        </section>

        <section class="showcase-section">
          <MidSectionHeader title="สีหลักของเว็บ" icon="format_color_fill" caption="ชุดสีนี้ยึดจากหน้าข่าวสารและ dashboard สมาชิก" />

          <div class="color-grid">
            <MidCard v-for="item in colorItems" :key="item.name" padding="sm" class="color-card">
              <div class="color-swatch" :style="{ background: item.value }"></div>
              <div class="color-name">{{ item.name }}</div>
              <div class="color-value">{{ item.value }}</div>
            </MidCard>
          </div>
        </section>

        <section class="showcase-section">
          <MidSectionHeader title="ปุ่มกลาง" icon="smart_button" caption="ใช้กับ action หลัก รอง ลบ ย้อนกลับ และปุ่มแบบโปร่ง" />

          <MidCard padding="lg">
            <div class="button-row">
              <MidButton label="ปุ่มหลัก" icon-right="arrow_forward" />
              <MidButton label="ปุ่มรอง" variant="secondary" />
              <MidButton label="ปุ่มขอบ" variant="outline" icon="how_to_reg" />
              <MidButton label="ปุ่มโปร่ง" variant="ghost" />
              <MidButton label="ปุ่มสีแดง" variant="danger" icon-right="logout" />
            </div>
          </MidCard>
        </section>

        <section class="showcase-section">
          <MidSectionHeader title="การ์ดและข้อมูล" icon="dashboard_customize" caption="การ์ดข่าว การ์ดข้อมูล และ panel ที่ใช้ในหน้า user" />

          <div class="card-grid">
            <MidCard variant="news" padding="none" class="news-preview-card">
              <img src="/icons/hero-recycle.png" alt="ตัวอย่างการ์ดข่าว" />
              <div class="news-preview-shade"></div>
              <div class="news-preview-content">
                <div class="news-preview-icon">
                  <q-icon name="eco" />
                </div>
                <div>
                  <div class="news-preview-title">การ์ดข่าวสาร</div>
                  <div class="news-preview-caption">ใช้กับข่าวหน้าแรก</div>
                </div>
              </div>
            </MidCard>

            <MidCard variant="hero" padding="lg">
              <q-badge class="hero-chip">Hero Card</q-badge>
              <h2>การ์ดโทนเขียวหลัก</h2>
              <p>ใช้กับส่วน hero หรือ panel สำคัญที่ต้องการน้ำหนักภาพรวมสูง</p>
            </MidCard>

            <MidInfoCard label="ยอดเงินกองทุน" icon="savings" value="50" unit="บาท" hint="ตัวอย่างการ์ดข้อมูลแบบหน้า user" :progress="1" />
            <MidInfoCard label="รอบรับซื้อถัดไป" icon="event" value="15" unit="มี.ค." hint="ใช้กับข้อมูลสรุปและสถานะ" tone="blue" />
          </div>
        </section>

        <section class="showcase-section">
          <MidSectionHeader title="Dialog กลาง" icon="wysiwyg" caption="รูปแบบ dialog ยืนยันหรือแจ้งผลที่เข้ากับธีมเว็บ" />

          <MidCard padding="lg">
            <div class="dialog-preview">
              <div>
                <h3>ตัวอย่าง dialog</h3>
                <p>กดปุ่มเพื่อดู dialog มาตรฐาน พร้อม badge, title, caption และ action buttons</p>
              </div>
              <MidButton label="เปิด Dialog" icon-right="open_in_new" @click="isDialogOpen = true" />
            </div>
          </MidCard>
        </section>

        <section class="showcase-section">
          <MidSectionHeader
            title="ตัวกรองรายการ"
            icon="filter_alt"
            caption="ช่องค้นหาพร้อมไอคอนตัวกรอง กดแล้วเปิดหน้าต่างรวมตัวกรองของหน้านั้น"
          />

          <MidCard padding="lg">
            <MidFilterBar
              v-model:search="demoSearch"
              search-label="ค้นหา (ชื่อ / เบอร์โทร)"
              title="กรองรายชื่อตัวอย่าง"
              :active="demoActiveFilters"
              @clear="clearDemoFilter"
              @clear-all="clearDemoFilters"
            >
              <q-select
                v-model="demoStatus"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="สถานะ"
                :options="demoStatusOptions"
              />
              <q-select
                v-model="demoMoo"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="หมู่ที่"
                :options="demoMooOptions"
              />
            </MidFilterBar>
          </MidCard>
        </section>

        <MidDialog
          v-model="isDialogOpen"
          title="ยืนยันการทำรายการ"
          badge="ตัวอย่าง Dialog"
          icon="check_circle"
          caption="นี่คือ dialog กลางที่ใช้สี ปุ่ม และความโค้งมนตาม MID component"
          show-actions
          confirm-label="ตกลง"
          cancel-label="ยกเลิก"
          @confirm="isDialogOpen = false"
        >
          <div class="dialog-sample-body">
            ใช้ component นี้กับงานยืนยัน ลบข้อมูล ออกจากระบบ หรือแจ้งผลสำเร็จ เพื่อให้หน้าตาเหมือนกันทั้งเว็บ
          </div>
        </MidDialog>
      </q-page>
    </q-page-container>

    <AppFooter />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AppFooter from 'components/AppFooter.vue';
import {
  MidButton,
  MidCard,
  MidDialog,
  MidFilterBar,
  MidInfoCard,
  MidSectionHeader,
  midColors,
  midOptionLabel,
  type MidActiveFilter,
} from 'components/MID';

const isDialogOpen = ref(false);

const demoSearch = ref('');
const demoStatus = ref<string | null>('active');
const demoMoo = ref<string | null>(null);
const demoStatusOptions = [
  { value: 'active', label: 'ใช้งาน' },
  { value: 'suspended', label: 'พักสถานะ' },
];
const demoMooOptions = ['1', '2', '4'].map((moo) => ({ value: moo, label: `หมู่ ${moo}` }));

const demoActiveFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (demoStatus.value) {
    items.push({ key: 'status', label: 'สถานะ', value: midOptionLabel(demoStatusOptions, demoStatus.value) });
  }
  if (demoMoo.value) {
    items.push({ key: 'moo', label: 'หมู่ที่', value: `หมู่ ${demoMoo.value}` });
  }
  return items;
});

function clearDemoFilter(key: string) {
  if (key === 'status') demoStatus.value = null;
  if (key === 'moo') demoMoo.value = null;
}

function clearDemoFilters() {
  demoStatus.value = null;
  demoMoo.value = null;
}

const colorItems = computed(() =>
  Object.entries(midColors).map(([name, value]) => ({
    name,
    value,
  })),
);
</script>

<style scoped>
.mid-showcase-layout {
  background:
    radial-gradient(circle at 8% 0, rgba(190, 232, 201, 0.32), transparent 30%),
    #f7faf8;
}

.showcase-header {
  color: #06492d;
  background: rgba(255, 255, 255, 0.74);
  border-bottom: 1px solid rgba(8, 127, 73, 0.08);
  backdrop-filter: blur(18px);
}

.showcase-toolbar {
  min-height: 72px;
  padding: 0 28px;
}

.showcase-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #075f38;
  text-decoration: none;
  font-size: 22px;
  font-weight: 950;
}

.showcase-brand img {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  object-fit: cover;
}

.mid-showcase-page {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 34px 28px 70px;
}

.showcase-hero {
  padding: 38px 42px;
  color: white;
  background:
    radial-gradient(circle at 78% 24%, rgba(156, 216, 66, 0.5), transparent 26%),
    linear-gradient(135deg, #00573d 0%, #00843e 56%, #48b52f 100%);
  border-radius: 22px;
  box-shadow: 0 22px 48px rgba(0, 83, 52, 0.18);
}

.showcase-badge,
.hero-chip {
  padding: 8px 14px;
  color: #087f49;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 999px;
  font-weight: 900;
}

.showcase-hero h1 {
  margin: 18px 0 10px;
  font-size: clamp(34px, 5vw, 58px);
  font-weight: 950;
  line-height: 1;
}

.showcase-hero p {
  max-width: 720px;
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.7;
}

.showcase-section {
  margin-top: 32px;
}

.color-grid,
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.color-card :deep(.mid-card__body) {
  display: grid;
  gap: 8px;
}

.color-swatch {
  height: 58px;
  border: 1px solid rgba(7, 95, 56, 0.08);
  border-radius: 12px;
}

.color-name {
  color: #17452e;
  font-size: 14px;
  font-weight: 950;
}

.color-value {
  color: #6d8a7c;
  font-size: 12px;
  font-weight: 800;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.news-preview-card {
  position: relative;
  min-height: 260px;
}

.news-preview-card img {
  width: 100%;
  height: 100%;
  min-height: 260px;
  display: block;
  object-fit: cover;
}

.news-preview-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 72, 38, 0.02) 22%, rgba(0, 94, 52, 0.88));
}

.news-preview-content {
  position: absolute;
  right: 22px;
  bottom: 22px;
  left: 22px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.news-preview-icon {
  display: grid;
  width: 48px;
  height: 48px;
  min-width: 48px;
  place-items: center;
  color: #087f49;
  background: white;
  border-radius: 999px;
}

.news-preview-title {
  font-size: 18px;
  font-weight: 950;
}

.news-preview-caption {
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
  font-weight: 800;
}

.card-grid :deep(.mid-card--hero h2) {
  margin: 18px 0 10px;
  font-size: 34px;
  font-weight: 950;
}

.card-grid :deep(.mid-card--hero p) {
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-weight: 800;
  line-height: 1.7;
}

.dialog-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.dialog-preview h3 {
  margin: 0 0 8px;
  color: #06492d;
  font-size: 24px;
  font-weight: 950;
}

.dialog-preview p,
.dialog-sample-body {
  margin: 0;
  color: #6d8a7c;
  font-weight: 800;
  line-height: 1.6;
}

@media (max-width: 980px) {
  .color-grid,
  .card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .showcase-toolbar,
  .mid-showcase-page {
    padding-inline: 16px;
  }

  .showcase-hero {
    padding: 30px 24px;
  }

  .color-grid,
  .card-grid {
    grid-template-columns: 1fr;
  }

  .dialog-preview {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
