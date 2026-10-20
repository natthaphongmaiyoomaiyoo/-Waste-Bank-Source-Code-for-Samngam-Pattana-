<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <!-- Hero -->
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>
        <div class="hero-row">
          <div class="hero-icon"><q-icon name="bar_chart" /></div>
          <div class="hero-copy">
            <h1>รายงานสรุปผล</h1>
          </div>
          <q-btn
            unelevated no-caps icon="upload"
            label="พิมพ์รายงานส่งเทศบาล"
            class="hero-add-btn"
          />
        </div>
      </section>

      <!-- Filter Panel -->
      <q-card flat class="panel-card q-mt-lg">
        <div class="row q-col-gutter-md items-end">
          <div class="col-12 col-md-3">
            <div class="dialog-section-label">เลือกหมู่บ้าน/กองทุน</div>
            <q-select
              outlined dense
              v-model="store.filter.villageId"
              :options="villageOptions"
              emit-value map-options
            />
          </div>
          <div class="col-12 col-md-3">
            <div class="dialog-section-label">วันที่เริ่มต้น</div>
            <MidDateField v-model="store.filter.startDate" />
          </div>
          <div class="col-12 col-md-3">
            <div class="dialog-section-label">วันที่สิ้นสุด</div>
            <MidDateField v-model="store.filter.endDate" />
          </div>
          <div class="col-12 col-md-3">
            <q-btn color="positive" label="ค้นหา/กรองข้อมูล" unelevated class="full-width" style="height: 40px" icon="search" />
          </div>
        </div>
      </q-card>

      <!-- Summary KPIs -->
      <div class="summary-grid q-mt-md">
        <div v-for="card in kpiCards" :key="card.label" class="summary-card">
          <div class="summary-label">{{ card.label }}</div>
          <div class="summary-value" :class="card.colorClass">
            {{ card.value.toLocaleString() }}
            <span>{{ card.unit }}</span>
          </div>
          <div class="summary-icon"><q-icon :name="card.icon" /></div>
        </div>
      </div>

      <!-- Charts Area -->
      <div class="row q-col-gutter-lg q-mt-sm">
        <div class="col-12 col-lg-8">
          <q-card flat class="panel-card full-height">
            <div class="panel-head">
              <div class="panel-title">สถิติการรับซื้อขยะ (รายเดือน)</div>
              <div class="panel-caption">{{ selectedVillage?.name || '-' }}</div>
            </div>
            <div class="q-mt-md">
              <apexchart type="bar" height="350" :options="chartOptions" :series="chartSeries" />
            </div>
          </q-card>
        </div>

        <div class="col-12 col-lg-4">
          <q-card flat class="panel-card full-height">
            <div class="panel-head">
              <div class="panel-title">สรุปข้อมูลเด่น</div>
            </div>
            
            <div class="q-mt-md">
              <div class="q-mb-lg">
                <div class="text-caption text-grey-6">เดือนที่มีปริมาณสูงสุด</div>
                <div class="text-h6 text-weight-bold text-dark">{{ store.maxMonth.month }}</div>
                <div class="text-positive text-weight-bold">{{ store.maxMonth.value }} กิโลกรัม</div>
              </div>

              <q-separator class="q-my-md" />

              <div class="q-mb-lg">
                <div class="text-caption text-grey-6">เดือนที่มีปริมาณต่ำสุด</div>
                <div class="text-h6 text-weight-bold text-dark">{{ store.minMonth.month }}</div>
                <div class="text-red-7 text-weight-bold">{{ store.minMonth.value }} กิโลกรัม</div>
              </div>

              <q-separator class="q-my-md" />

              <div class="q-mb-lg">
                <div class="text-caption text-grey-6">ค่าเฉลี่ยต่อเดือน</div>
                <div class="text-h6 text-weight-bold text-dark">
                  {{ store.averageWeight.toFixed(0) }} กิโลกรัม
                </div>
              </div>

              <div class="q-mt-xl p-3 bg-green-1 rounded-borders q-pa-md">
                <div class="text-caption text-grey-7">แนวโน้มการรับซื้อ</div>
                <div class="row items-center text-positive text-weight-bold text-subtitle1">
                  <q-icon name="trending_up" class="q-mr-xs" size="sm" /> เพิ่มขึ้น 12%
                </div>
                <div class="text-caption text-grey-6">เทียบกับช่วงเดียวกันของปีที่แล้ว</div>
              </div>
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useReportStore } from 'src/stores/reportStore';
import apexchart from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useVillageStore } from 'src/stores/villageStore';
import type { Village } from 'src/stores/models';
import { MidDateField } from 'components/MID';

const store = useReportStore();
const villageStore = useVillageStore();

const villageOptions = computed(() =>
  villageStore.villages.map((v: Village) => ({
    label: v.name,
    value: v.id,
  })),
);

const selectedVillage = computed(() =>
  villageStore.villages.find((v: Village) => v.id === store.filter.villageId),
);

const kpiCards = computed(() => [
  {
    label: 'เงินกองทุนคงเหลือ',
    value: selectedVillage.value?.fundBalance || 0,
    unit: 'บาท',
    icon: 'account_balance_wallet',
    colorClass: 'text-positive',
  },
  {
    label: 'ปริมาณขยะรวม',
    value: store.summary.totalWeight,
    unit: 'กก.',
    icon: 'scale',
    colorClass: 'text-dark',
  },
  {
    label: 'ยอดรับซื้อรวม',
    value: store.summary.totalAmount,
    unit: 'บาท',
    icon: 'payments',
    colorClass: 'text-dark',
  },
  {
    label: 'สมาชิกทั้งหมด',
    value: selectedVillage.value?.memberCount || 0,
    unit: 'คน',
    icon: 'people',
    colorClass: 'text-dark',
  },
]);

const chartSeries = computed(() => [
  {
    name: 'ปริมาณขยะ (kg)',
    data: store.chartData.map((d) => d.value),
  },
]);

const chartOptions: ApexOptions = {
  chart: { toolbar: { show: false }, fontFamily: 'Prompt, sans-serif' },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } },
  colors: ['#0b7a47'],
  xaxis: { categories: store.chartData.map((d) => d.month) },
  dataLabels: { enabled: true, offsetY: -20, style: { colors: ['#333'] } },
};

onMounted(() => {
  const first = villageOptions.value[0];
  if (first && !store.filter.villageId) {
    store.filter.villageId = first.value;
  }
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;
</style>
