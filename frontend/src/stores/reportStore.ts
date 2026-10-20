import { defineStore } from 'pinia';
import type { ReportFilter, HistoryChartData } from './models';
import { useWasteTypesStore } from './wasteTypeStore';
import type { WasteTypes } from './models';

export const useReportStore = defineStore('report', {
  state: () => ({
    filter: {
      villageId: '', // ✅ ใช้เลือกหมู่บ้าน
      startDate: '',
      endDate: '',
    } as ReportFilter,

    chartData: [
      { month: 'ม.ค.', 'ขวดพลาสติกใส (PET)': 170, value: 180 },
      { month: 'ก.พ.', กระดาษขาวดำ: 709, value: 220 },
      { month: 'มี.ค.', แก้วสี: 100, value: 250 },
      { month: 'เม.ย.', 'ขวดพลาสติกใส (PET)': 100, value: 190 },
      { month: 'พ.ค.', กระดาษขาวดำ: 250, value: 280 },
      { month: 'มิ.ย.', แก้วใส: 520, value: 80 },
    ] as HistoryChartData[],
  }),

  getters: {
    maxMonth: (state) =>
      state.chartData.reduce((prev, current) =>
        Number(prev.value || 0) > Number(current.value || 0) ? prev : current,
      ),

    minMonth: (state) =>
      state.chartData.reduce((prev, current) =>
        Number(prev.value || 0) < Number(current.value || 0) ? prev : current,
      ),

    averageWeight: (state) =>
      state.chartData.reduce((acc, curr) => acc + Number(curr.value || 0), 0) /
      state.chartData.length,

    summary: (state) => {
      const wasteStore = useWasteTypesStore();

      let totalWeight = 0;
      let totalAmount = 0;

      state.chartData.forEach((d) => {
        wasteStore.wasteTypes.forEach((w: WasteTypes) => {
          const weight = Number(d[w.name as keyof typeof d] || 0);

          totalWeight += weight;
          totalAmount += weight * w.price;
        });
      });
      return {
        totalWeight,
        totalAmount,
      };
    },
  },
});
