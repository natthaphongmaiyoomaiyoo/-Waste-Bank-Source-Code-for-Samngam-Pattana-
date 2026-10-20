import { defineStore } from 'pinia';
import type { MemberTransaction } from './models'; // Import Model เข้ามาใช้งาน

export const useTransactionStore = defineStore('transaction', {
  state: () => ({
    // ข้อมูลจำลองตั้งต้น ผูกกับสมาชิก ID '1' (คุณสมชาย)
    transactions: [
      {
        id: 1,
        memberId: '10',
        date: '15 ต.ค. 66',
        time: '14:30',
        type: 'ขายขยะรีไซเคิล',
        detail: 'ขวดพลาสติก 15 กก., กระดาษ 8 กก.',
        amount: 45.0,
        isIncome: true,
        balance: 125.5,
        operator: 'Admin A',
      },
      {
        id: 2,
        memberId: '10',
        date: '10 ต.ค. 66',
        time: '09:15',
        type: 'หักเงินกองทุน (สมาชิกเสียชีวิต)',
        detail: 'กองทุนสงเคราะห์ - สมาชิก #005',
        amount: 50.0,
        isIncome: false,
        balance: 80.5,
        operator: 'System Auto',
      },
      {
        id: 3,
        memberId: '10',
        date: '01 ต.ค. 66',
        time: '16:45',
        type: 'ฝากเงินสด (สมทบ)',
        detail: 'เงินสมทบกองทุนรายเดือน',
        amount: 20.0,
        isIncome: true,
        balance: 130.5,
        operator: 'Admin B',
      },
      {
        id: 4,
        memberId: '10',
        date: '28 ก.ย. 66',
        time: '11:20',
        type: 'ขายขยะรีไซเคิล',
        detail: 'แก้ว 12 กก., เหล็ก 5 กก.',
        amount: 67.5,
        isIncome: true,
        balance: 110.5,
        operator: 'Admin A',
      },
    ] as MemberTransaction[],
  }),

  getters: {
    // ฟังก์ชันสำหรับดึงประวัติเฉพาะของสมาชิกคนที่เลือก
    getTransactionsByMember: (state) => {
      return (memberId: string) => state.transactions.filter((t) => t.memberId === memberId);
    },
  },

  actions: {
    // ฟังก์ชันเพิ่มประวัติใหม่จากการทำรายการหรือ "ถอนเงิน"
    addTransaction(payload: Omit<MemberTransaction, 'id'>) {
      const newId = Date.now();
      // ใช้ unshift เพื่อให้รายการใหม่ล่าสุดไปอยู่ด้านบนสุดของตาราง
      this.transactions.unshift({ id: newId, ...payload });
    },
  },
});
