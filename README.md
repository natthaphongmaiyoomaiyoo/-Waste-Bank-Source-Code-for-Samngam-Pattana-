# ระบบธนาคารขยะรีไซเคิล เพื่อสนับสนุนกองทุนฌาปนกิจสงเคราะห์ชุมชนตำบลสามง่ามพัฒนา

เว็บแอปสำหรับบริหารธนาคารขยะของชุมชน ครอบคลุมสมาชิก กรรมการธนาคารขยะ ผู้รับซื้อ
เจ้าหน้าที่เทศบาล และผู้ดูแลระบบ ตั้งแต่สมัครสมาชิก แจ้งขายขยะ วางแผนเส้นทางรับซื้อ
บัญชีเงินออม ไปจนถึงกองทุนฌาปนกิจและรายงาน PDF สำหรับเทศบาล

## โครงสร้าง

| โฟลเดอร์ | รายละเอียด |
|---|---|
| [backend/](backend/) | REST API: Node.js + TypeScript + Express + Prisma + PostgreSQL (Supabase), zod, JWT, vitest |
| [frontend/](frontend/) | เว็บ: Quasar (Vue 3) + Pinia + ApexCharts + Leaflet + pdfmake |
| [database/](database/) | โครงสร้างฐานข้อมูลเป็นไฟล์ SQL ([schema.sql](database/schema.sql)) สร้างจาก Prisma schema |

วิธีติดตั้งและรันแต่ละส่วนอยู่ใน [backend/README.md](backend/README.md) และ [frontend/README.md](frontend/README.md)
(ต้องสร้างไฟล์ `.env` เองจาก `.env.example` ของแต่ละโฟลเดอร์)

## ทีมผู้พัฒนา (KIMIMETO TEAM)

- Natthaphong Maiyoo
- Apiplon Treenit
- Thanapat Sirisopolporn
- pawarisa

## ลิขสิทธิ์และสิ่งที่ไม่ได้รวมไว้

- โค้ดใน repo นี้เป็นของทีมผู้พัฒนา สงวนสิทธิ์ทั้งหมด
- โลโก้มหาวิทยาลัยบูรพา (`buulogo.png`), มหาวิทยาลัยราชภัฏจันทรเกษม (`chandrakasem.png`) และ
  เทศบาลตำบลสามง่ามพัฒนา (`สามง่าม.png`) ใน `frontend/public/icons/` เป็นทรัพย์สินของหน่วยงานเจ้าของ
  ใช้เพื่อแสดงหน่วยงานร่วมโครงการเท่านั้น ไม่อยู่ภายใต้สิทธิ์ของ repo นี้
- ฟอนต์ Sarabun ที่ฝังใน `frontend/src/pdf/sarabunVfs.ts` ใช้สัญญาอนุญาต SIL Open Font License 1.1
  ดู [frontend/src/pdf/OFL.txt](frontend/src/pdf/OFL.txt)
- รูปประกอบข่าวและโปสเตอร์ที่เป็นผลงานของหน่วยงานอื่นไม่ได้รวมไว้ใน repo นี้
