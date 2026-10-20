export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  avatar?: string;
  // เชื่อมไปยังโปรไฟล์ตามบทบาท
  adminProfileId?: string;
  memberProfileId?: string;
}

// ข้อมูลหมู่บ้าน/กองทุน
export interface Village {
  id: string;
  name: string; // เช่น "หมู่ 1 บ้านหนองน้ำ"
  fundBalance: number; // เงินกองทุนคงเหลือ (บาท)
  memberCount: number; // จำนวนสมาชิกในหมู่บ้าน
}

// ข้อมูลสมาชิก (Member Profile)
export interface Member {
  id: string;
  memberCode: string; // รหัสสมาชิก
  name: string; // ชื่อ-นามสกุล
  balance: number; // ยอดเงินปัจจุบัน
  villageId: string; // FK เชื่อมกับ Village
  status: 'active' | 'inactive';
}

// ประเภทขยะ
export interface WasteType {
  id: string;
  name: string; // เช่น พลาสติก, ขวดแก้ว
  unit: string; // เช่น kg, ชิ้น
  pricePerUnit: number; // ราคารับซื้อ
}

export interface WasteTypes {
  id: number;
  name: string;
  price: number;
  unit?: string;
  status?: string;
}

// บันทึกการรับซื้อขยะ (หัวบิล)
export interface WasteTransaction {
  id: string;
  memberId: string; // ใครมาขาย
  villageId: string; // ขายให้กองทุนไหน
  totalWeight: number; // น้ำหนักรวม (kg)
  totalAmount: number; // ยอดเงินรวม (บาท)
  createdAt: string; // วันที่ทำรายการ (ISO Date)
}

// รายละเอียดการรับซื้อ (รายการย่อยในบิล)
export interface WasteTransactionDetail {
  id: string;
  transactionId: string;
  wasteTypeId: string;
  weight: number;
  priceAtTime: number; // ราคา ณ วันที่ขาย
  amount: number; // ยอดเงินย่อย (weight * priceAtTime)
}

export interface DashboardSummary {
  totalBalance: number; // แก้จาก balance เป็น totalBalance
  memberCount: number;
  nextCollection: string; // แก้จาก nextCollectionDate เป็น nextCollection
  daysRemaining: number;
}
// ข้อมูลสำหรับกราฟประวัติ
export interface HistoryChartData {
  month: string; // ม.ค., ก.พ., ...
  value: number;
  [key: string]: string | number;
}

// ตัวกรองหน้ารายงาน
export interface ReportFilter {
  villageId: string;
  startDate: string;
  endDate: string;
}

export interface WasteCollectionSchedule {
  id: string;
  villageId: string;
  villageName: string;
  date: string; // เช่น "2026-03-15"
  timeStart: string; // เช่น "09:00"
  timeEnd: string; // เช่น "12:00"
  note?: string; // รายละเอียดเพิ่มเติมหรือประเภทขยะที่เน้น
  status: 'scheduled' | 'completed' | 'cancelled' | 'full';
  // รอบที่ยังอยู่ไกลเกินกว่าจะแจ้งขายได้ (backend เปิดให้แจ้งล่วงหน้าได้ SELL_REQUEST_ADVANCE_DAYS วัน)
  openForRequest?: boolean;
  requestOpensOn?: string; // "2026-08-20" - วันแรกที่แจ้งขายรอบนี้ได้
}

// ประวัติความเคลื่อนไหวทางการเงินของสมาชิก (รายรับ-รายจ่าย)
export interface MemberTransaction {
  id: string | number;
  memberId: string; // FK เชื่อมกับ Member
  date: string; // วันที่ทำรายการ (เช่น 15 ต.ค. 66)
  time: string; // เวลาทำรายการ (เช่น 14:30)
  type: string; // ประเภท: 'ขายขยะรีไซเคิล', 'ถอนเงิน', 'ฝากเงินสด', 'หักเงินกองทุน'
  detail: string; // รายละเอียด เช่น 'ขวดพลาสติก 15 กก.'
  amount: number; // จำนวนเงิน
  isIncome: boolean; // true = รายรับ (+), false = รายจ่าย (-)
  balance: number; // ยอดคงเหลือ ณ เวลานั้น
  operator: string; // ชื่อผู้ทำรายการ (Admin)
}
