import { defineStore } from 'pinia';
import type { Member } from './models';

// ขยาย Type ชั่วคราวเพื่อให้ครอบคลุมฟิลด์ในหน้าตาราง (สามารถนำไปอัปเดตใน models.ts ได้ครับ)
interface ExtendedMember extends Member {
  idCard?: string;
  phone?: string;
}

export const useMemberStore = defineStore('member', {
  state: () => ({
    // เก็บข้อมูลแบบ Entity Pattern
    entities: {
      '1': {
        id: '1',
        memberCode: '001',
        name: 'สมชาย วงศ์ใหญ่',
        idCard: '1-1234-56789-01-2',
        phone: '081-234-5678',
        balance: 125.5,
        status: 'active',
        villageId: 'v1',
      },
      '2': {
        id: '2',
        memberCode: '002',
        name: 'สุดา ใจดี',
        idCard: '1-2345-67890-12-3',
        phone: '082-345-6789',
        balance: 42.0,
        status: 'active',
        villageId: 'v1',
      },
      '3': {
        id: '3',
        memberCode: '003',
        name: 'วิชัย รักษ์ดี',
        idCard: '1-3456-78901-23-4',
        phone: '083-456-7890',
        balance: 18.75,
        status: 'active',
        villageId: 'v1',
      },
      '4': {
        id: '4',
        memberCode: '004',
        name: 'มาลี สวยงาม',
        idCard: '1-4567-89012-34-5',
        phone: '084-567-8901',
        balance: 35.25,
        status: 'active',
        villageId: 'v1',
      },
      '5': {
        id: '5',
        memberCode: '005',
        name: 'สมศักดิ์ ดีใจ',
        idCard: '1-5678-90123-45-6',
        phone: '085-678-9012',
        balance: 89.75,
        status: 'inactive',
        villageId: 'v1',
      },
      '6': {
        id: '6',
        memberCode: '006',
        name: 'นิรันดร์ สุขใส',
        idCard: '1-6789-01234-56-7',
        phone: '086-789-0123',
        balance: 156.0,
        status: 'active',
        villageId: 'v1',
      },
      '7': {
        id: '7',
        memberCode: '007',
        name: 'ประยุทธ์ มั่นคง',
        idCard: '1-7890-12345-67-8',
        phone: '087-890-1234',
        balance: 0.0,
        status: 'inactive',
        villageId: 'v1',
      },
      '8': {
        id: '8',
        memberCode: '008',
        name: 'อคิระ สุคะชิ',
        idCard: '1-3390-15245-58-5',
        phone: '088-710-5464',
        balance: 100.7,
        status: 'active',
        villageId: 'v1',
      },
      '9': {
        id: '9',
        memberCode: '009',
        name: 'ทาเคชิ ชิมะซุชิ',
        idCard: '1-4602-59020-94-2',
        phone: '097-541-1156',
        balance: 18.7,
        status: 'active',
        villageId: 'v1',
      },
      '10': {
        id: '10',
        memberCode: '010',
        name: 'ฮินะตะ เคบาอะเตะ',
        idCard: '1-0325-8548-33-9',
        phone: '090-761-1178',
        balance: 58.9,
        status: 'inactive',
        villageId: 'v1',
      },
    } as Record<string, ExtendedMember>,

    // เรียงลำดับ ID
    ids: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  }),

  getters: {
    // ดึงสมาชิกทั้งหมดออกมาเป็น Array สำหรับแสดงในตาราง
    allMembers: (state) => state.ids.map((id) => state.entities[id]!),

    // ดึงเฉพาะคนที่ยอดเงินต่ำ (เอาไว้ใช้ในหน้า Dashboard)

    lowBalanceMembers: (state) =>
      state.ids.map((id) => state.entities[id]!).filter((m) => m?.balance < 50),
  },

  actions: {
    // ฟังก์ชันสำหรับบันทึกสมาชิกใหม่จากหน้า Dialog
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addMember(payload: any) {
      // สร้าง ID และ รหัสสมาชิกใหม่ (จำลอง)
      const newId = String(Date.now());
      const newMemberCode = String(this.ids.length + 1).padStart(3, '0');

      const newMember: ExtendedMember = {
        id: newId,
        memberCode: newMemberCode,
        name: payload.name,
        idCard: payload.idCard,
        phone: payload.phone,
        balance: 0, // สมาชิกใหม่เริ่มที่ 0 บาท
        status: 'active',
        villageId: payload.village || 'v1',
      };

      // บันทึกลง Store
      this.entities[newId] = newMember;
      this.ids.push(newId);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMember(id: string, payload: any) {
      if (this.entities[id]) {
        // อัปเดตข้อมูลเดิมด้วยข้อมูลใหม่
        this.entities[id] = { ...this.entities[id], ...payload };
      }
    },

    deleteMember(id: string) {
      // ลบออกจาก entities
      delete this.entities[id];
      // ลบออกจาก ids array
      this.ids = this.ids.filter((memberId) => memberId !== id);
    },
  },
});
