import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import type { WasteCollectionSchedule } from './models';

// Shape returned by GET /schedule (backend/src/services/scheduleService.ts).
interface BackendCollectionRound {
  id: number;
  roundDate: string;
  startTime: string;
  endTime: string;
  locationNote: string | null;
  status: 'planned' | 'completed' | 'cancelled';
  buyer?: { buyerName: string };
  // false = รอบนี้ยังไกลเกินหน้าต่างแจ้งล่วงหน้า จึงยังแจ้งขายไม่ได้
  openForRequest: boolean;
  requestOpensOn: string;
}

// Backend status vocabulary -> the frontend's existing WasteCollectionSchedule vocabulary,
// so scheduleAvailability() below (and every page that already consumes this store) needs
// no changes at all.
function mapStatus(status: BackendCollectionRound['status']): WasteCollectionSchedule['status'] {
  if (status === 'planned') return 'scheduled';
  if (status === 'cancelled') return 'cancelled';
  return 'completed';
}

function mapRound(round: BackendCollectionRound): WasteCollectionSchedule {
  return {
    id: String(round.id),
    villageId: String(round.id),
    villageName: round.buyer?.buyerName || 'ไม่ระบุพื้นที่',
    // The committee's "จุดนัดหมาย / หมายเหตุ" for the round, shown to members
    // as its own note line under the time.
    ...(round.locationNote ? { note: round.locationNote } : {}),
    date: round.roundDate.slice(0, 10),
    timeStart: round.startTime,
    timeEnd: round.endTime,
    status: mapStatus(round.status),
    openForRequest: round.openForRequest,
    requestOpensOn: round.requestOpensOn?.slice(0, 10) ?? '',
  };
}

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    schedules: [] as WasteCollectionSchedule[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    upcomingEvents: (state) =>
      state.schedules
        .filter((s) => s.status === 'scheduled')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),

    // รอบที่สมาชิกยังดำเนินการได้ (ยังไม่เสร็จสิ้น) เรียงจากใกล้ไปไกล
    // ใช้ร่วมกันโดยหน้า "ตารางธนาคารขยะ" และ "แจ้งขายขยะ" ของสมาชิก เพื่อไม่ให้ข้อมูลสองหน้าขัดแย้งกัน
    openSchedules: (state) =>
      state.schedules
        .filter((s) => s.status !== 'completed')
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),

    // รอบที่เสร็จสิ้นแล้ว เรียงจากล่าสุดไปเก่าสุด
    // หมายเหตุ: backend ยังไม่มี endpoint สำหรับรอบรับซื้อในอดีตของสมาชิก (GET /schedule
    // ส่งเฉพาะรอบที่ยังไม่ถึง/ยังไม่เสร็จสิ้น) รายการนี้จึงว่างเสมอจนกว่าจะมี endpoint นั้นเพิ่ม
    pastSchedules: (state) =>
      state.schedules
        .filter((s) => s.status === 'completed')
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  },

  actions: {
    async fetchSchedules() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<BackendCollectionRound[]>('/schedule');
        this.schedules = data.map(mapRound);
      } catch {
        this.error = 'ไม่สามารถโหลดตารางรับซื้อขยะได้ กรุณาลองใหม่อีกครั้ง';
      } finally {
        this.loading = false;
      }
    },

    // ใช้เฉพาะหน้าตารางฝั่งกรรมการ (ยังไม่เชื่อมกับ backend จริง) - เพิ่มรายการแบบ local เท่านั้น
    addSchedule(payload: Omit<WasteCollectionSchedule, 'id' | 'status'>) {
      this.schedules.push({
        id: String(Date.now()),
        status: 'scheduled',
        ...payload,
      });
    },
  },
});

// สถานะที่สมาชิกมองเห็น อ้างอิงจาก status ของรอบรับซื้อ
// อยู่ที่นี่ที่เดียวเพื่อให้หน้า Schedule และ Sell Request แสดงผลตรงกันเสมอ
// 'not-open' = รอบยังมาไม่ถึงหน้าต่างแจ้งล่วงหน้า (backend เป็นผู้ตัดสินผ่าน openForRequest
// แล้วปฏิเสธคำขอเดียวกันนี้ตอนกดส่งด้วย)
export function scheduleAvailability(
  schedule: WasteCollectionSchedule,
): 'available' | 'full' | 'closed' | 'not-open' {
  if (schedule.status === 'full') return 'full';
  if (schedule.status === 'cancelled') return 'closed';
  // รอบวันนี้ที่เลยเวลาสิ้นสุดไปแล้วถือว่าปิด ไม่ใช่ "ยังไม่เปิด" - ต้องเช็คก่อน
  // openForRequest ไม่งั้นจะไปแสดงวันเปิดแจ้งที่ผ่านมาแล้ว
  if (scheduleWindowEnded(schedule)) return 'closed';
  if (schedule.openForRequest === false) return 'not-open';
  return 'available';
}

// เลยเวลาสิ้นสุดของรอบหรือยัง (เทียบเวลาท้องถิ่น เกณฑ์เดียวกับ
// scheduleService.roundWindowEnded ที่ backend ใช้ตอนรับคำร้อง)
function scheduleWindowEnded(schedule: WasteCollectionSchedule): boolean {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const nowStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${schedule.date} ${schedule.timeEnd}` < nowStamp;
}

// "2026-08-20" -> "20 ส.ค." สำหรับข้อความ "เปิดให้แจ้งวันที่ ..."
export function formatOpensOn(schedule: WasteCollectionSchedule): string {
  if (!schedule.requestOpensOn) return '';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(
    new Date(schedule.requestOpensOn),
  );
}
