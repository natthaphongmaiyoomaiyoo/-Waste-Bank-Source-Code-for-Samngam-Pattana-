# MID components

ชุด component และธีมกลางของเว็บธนาคารขยะ โดยยึดหน้าข่าวสารและหน้าสมาชิกเป็นแนวทางหลัก

**กฎหลัก: เรื่องสี ฟอร์ม ปฏิทิน และเวลา ให้แก้ที่นี่ที่เดียว แล้วทุกหน้าจะเปลี่ยนตาม**
อย่าเขียนสีหรือ locale ซ้ำในหน้าใด ๆ อีก

## ธีม (โหลดอัตโนมัติทั้งเว็บ)

- `mid.variables.scss` ตัวแปรสีกลาง (ฝั่ง SCSS) — `src/css/quasar.variables.scss` ดึงค่าจากไฟล์นี้
  ไปตั้งเป็น `$primary` ของ Quasar ทำให้ทุก accent ในตัว Quasar เป็นสีเขียวของระบบ
  (ขอบช่องกรอกตอน focus, ตัวเลือกใน dropdown, ปฏิทิน, นาฬิกา, checkbox, radio, toggle, spinner, tab)
- `mid-theme.scss` override ส่วนที่ตัวแปร Quasar เอื้อมไม่ถึง เช่น หัวปฏิทิน/นาฬิกา
  ตัว `<input type="date">` ของเบราว์เซอร์ และหน้าตาช่องกรอกกลาง (มุมโค้ง พื้นเขียวอ่อน)
  ถูก import ครั้งเดียวใน `src/css/app.scss`
- `midTokens.ts` สีหลัก สีรอง radius shadow gradient และ spacing (ฝั่ง TS)

> เพิ่ม/แก้สี: แก้ `mid.variables.scss` (SCSS) และ `midTokens.ts` (TS) ให้ตรงกัน

### สีเฉพาะบางหน้า (accent)

หน้าที่ต้องใช้สีต่างจากธีมหลัก ให้ใส่ class ครอบแทนการเขียนสีเองในหน้า
ตอนนี้มี `mid-accent-purple` (สีม่วง) ใช้กับ flow แจ้งเสียชีวิต:

```vue
<div class="mid-accent-purple">
  <q-input label="สาเหตุการเสียชีวิต" />
  <!-- ปฏิทิน/นาฬิกาถูก portal ไปที่ body จึงต้องบอกผ่าน prop accent ด้วย -->
  <MidDateField v-model="deathDate" label="วันที่เสียชีวิต" accent="purple" />
</div>
```

## วันที่และเวลา (ภาษาไทย)

- `thaiDate.ts` ชื่อเดือน/วันภาษาไทย และตัวช่วยแปลง ค.ศ. ↔ พ.ศ.
  (`midThaiDateLocale`, `isoToThaiDate`, `thaiDateToIso`, `isoToThaiLongDate`)
- `MidDateField.vue` ช่องกรอกวันที่ของทั้งเว็บ พิมพ์เป็น วว/ดด/ปปปป (พ.ศ.)
  เลือกจากปฏิทินไทย แต่ `v-model` เป็น ISO (`YYYY-MM-DD`) ส่งเข้า API ได้ตรง ๆ
- `MidTimeField.vue` ช่องกรอกเวลา 24 ชั่วโมง (`HH:mm`) พร้อมนาฬิกาสีเขียว

Quasar lang pack ถูกตั้งเป็น `th` ใน `quasar.config.ts` แล้ว ข้อความในตัว Quasar
(เช่น "แถวต่อหน้า" ในตาราง) จึงเป็นภาษาไทยด้วย

## ตัวกรองรายการ (MidFilterBar)

ทุกหน้าที่มีตัวกรองรายการใช้ `MidFilterBar` ตัวเดียวกัน อย่าวางแถว dropdown + ปุ่ม "ค้นหา" เองอีก

- มีช่องค้นหา → ไอคอนตัวกรองอยู่ **ในช่องค้นหา** (ส่ง `v-model:search`)
- หน้ารายการควรมีช่องค้นหาเสมอ ถ้าจำเป็นจริง ๆ ที่จะไม่มี ก็ไม่ต้องส่ง `search` แล้วจะได้ปุ่ม "ตัวกรอง" แยกออกมาแทน
- หน้าที่ไม่มีตัวกรองให้ใส่ในหน้าต่าง (ไม่ใส่ default slot) จะได้แค่ช่องค้นหา ไม่มีไอคอนตัวกรอง
  ถ้าแต่ละครั้งที่พิมพ์ต้องยิง API ให้ใส่ `:search-debounce="300"`
- ตัวกรองของหน้าใส่ใน default slot ซึ่งจะไปอยู่ในหน้าต่าง (MidDialog) และ **มีผลทันทีที่เปลี่ยนค่า**
  หน้าเดิมจึงใช้ field ชุดเดิมได้ทั้งหมด (q-select, MidDateField, เดือนที่ขึ้นกับปี ฯลฯ)
- หน้าต้องส่ง `active` (`MidActiveFilter[]`) บอกว่ากรองอะไรอยู่ บนไอคอนจะขึ้นตัวเลข
  และใต้ช่องค้นหาจะมีชิปที่กด ✕ ลบได้ นับเฉพาะค่าที่ **ต่างจากค่าเริ่มต้นของหน้า**
  (เช่น ช่วงเวลาที่ตั้งต้นเป็น "ตั้งแต่วันนี้" จะไม่นับ) และตอน `clear` ให้ย้อนกลับเป็นค่าเริ่มต้นนั้น
- ของที่ต้องเห็นตลอด เช่น ช่องเลือกหมู่บ้านที่บังคับเลือก ใส่ใน slot `#actions` (อยู่แถวเดียวกับช่องค้นหา)
- ตัวกรองสถานะก็ใช้ตัวนี้เหมือนกัน อย่าวางแถวชิปสถานะของหน้าใครหน้ามันไว้เหนือตาราง
  (หน้าคำขอขายขยะของสมาชิกย้ายมาใช้ q-select ในหน้าต่างตัวกรองแล้ว)

```vue
<script setup lang="ts">
import { MidFilterBar, midOptionLabel, type MidActiveFilter } from 'components/MID';

const search = ref('');
const status = ref<string | null>(null);

const activeFilters = computed<MidActiveFilter[]>(() =>
  status.value
    ? [{ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, status.value) }]
    : [],
);

function clearFilter(key: string) {
  if (key === 'status') status.value = null;
  applyFilters();
}
</script>

<template>
  <MidFilterBar
    v-model:search="search"
    search-label="ค้นหา (ชื่อ / เบอร์โทร)"
    title="กรองรายชื่อสมาชิก"
    :active="activeFilters"
    @update:search="applyFilters"
    @clear="clearFilter"
    @clear-all="resetFilters"
  >
    <q-select
      v-model="status"
      dense
      outlined
      clearable
      emit-value
      map-options
      label="สถานะ"
      :options="statusOptions"
      @update:model-value="applyFilters"
    />
  </MidFilterBar>
</template>
```

## แจ้งเตือนและกล่องยืนยัน (midNotify / midConfirm)

ห้ามใช้ `$q.notify`, `$q.dialog` หรือ `window.alert` (ถอด plugin Notify/Dialog ออกจาก `quasar.config.ts` แล้ว)
ให้ใช้ฟังก์ชันกลางชุดนี้แทน เรียกจากที่ไหนก็ได้ ไม่ต้องวาง component ในหน้า
เพราะ `MidNotifyHost` ถูก mount ไว้ใน `App.vue` ครั้งเดียว

- `midNotify({ type, message, title?, timeout? })` toast มุมขวาบน ปิดเองตามเวลา (เอาเมาส์ชี้ค้างไว้ = หยุดนับ)
  `type`: `success` เขียว / `error` แดง / `warning` ส้ม / `info` ฟ้า
  หัวข้อเริ่มต้นตาม type (สำเร็จ / ไม่สำเร็จ / แจ้งเตือน / แจ้งให้ทราบ) เปลี่ยนได้ด้วย `title`
- `await midConfirm({ title, message?, tone?, confirmLabel?, cancelLabel?, item?, note? })` กล่องยืนยันบน `MidDialog`
  - `item: { name, details? }` แสดงรายการที่ถูกลบ/ระงับแยกเป็นกล่อง: ชื่อตัวใหญ่ แล้วรายละเอียดบรรทัดละข้อ
  - `note` บรรทัดเล็กสีเทาท้ายกล่อง บอกผลที่จะตามมา เพื่อให้ `message` เหลือแค่คำถามสั้นๆ
  คืน `true` เมื่อกดยืนยัน งานลบหรือยกเลิกใช้ `tone: 'danger'`
- `await midPrompt({ ...เหมือน midConfirm, inputLabel })` แบบมีช่องกรอกข้อความ
  คืนข้อความ (ตัดช่องว่างหัวท้ายแล้ว) หรือ `null` เมื่อปิดโดยไม่ยืนยัน

```ts
import { midConfirm, midNotify } from 'components/MID';

async function deleteBanner(id: number) {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: 'คุณต้องการลบแบนเนอร์นี้ใช่หรือไม่?',
    tone: 'danger',
    confirmLabel: 'ลบแบนเนอร์',
  });
  if (!confirmed) return;
  try {
    await bannerStore.removeBanner(id);
    midNotify({ type: 'success', message: 'ลบแบนเนอร์เรียบร้อยแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ลบแบนเนอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
}
```

## Files

- `MidButton.vue` ปุ่มหลัก ปุ่มรอง ปุ่มขอบ ปุ่มโปร่ง และปุ่มอันตราย
- `MidCard.vue` การ์ดพื้นฐาน การ์ด panel การ์ดข่าว การ์ด soft และ hero card
- `MidDateField.vue` ช่องกรอกวันที่ (ปฏิทินไทย + พ.ศ.) (`buddhist-year` ให้ปฏิทินที่เด้งขึ้นแสดงปีเป็น พ.ศ. ด้วย)
- `MidDialog.vue` dialog มาตรฐานของเว็บ พร้อม header, badge, action buttons (`tone="info"` = โทนสีฟ้า เช่นหน้าต่างแก้ไขข้อมูล, `tone="warning"` = โทนสีส้ม เช่นหน้าต่างเปลี่ยนรหัสผ่าน, `tone="danger"` = โทนสีแดง เช่นยกเลิกสมาชิกภาพ ปุ่ม MID ข้างในเปลี่ยนสีตาม)
- `MidFilterBar.vue` ช่องค้นหา + ไอคอนตัวกรองที่เปิดหน้าต่างตัวกรอง พร้อมตัวเลขและชิปตัวกรองที่ใช้อยู่
- `midFilter.ts` type `MidActiveFilter` และ `midOptionLabel` สำหรับทำชิป
- `MidInfoCard.vue` การ์ดข้อมูลแบบหน้าสมาชิก ใช้กับยอดเงิน สถานะ และ progress
- `MidNotifyHost.vue` + `midNotify.ts` toast แจ้งผล และกล่องยืนยัน/กรอกข้อความ (`midNotify`, `midConfirm`, `midPrompt`) host ถูก mount ใน `App.vue` แล้ว
- `MidSectionHeader.vue` หัว section แบบหน้าข่าวสาร พร้อม underline และ action slot
- `MidSuccessDialog.vue` dialog แจ้งบันทึกสำเร็จ (เครื่องหมายถูก + หัวข้อ + แผงสรุปแบบ label/value + ปุ่มปิดกับปุ่มหลัก) ใช้หลังเพิ่มสมาชิกและหลังส่งคำขอขายขยะ
- `MidTablePagination.vue` เลขหน้าใต้ตาราง (‹ 1 2 3 … ›) ใส่ใน slot `#pagination` ของทุก q-table แทน "1–20 จาก 26 ‹ ›" ของ Quasar
- `MidTimeField.vue` ช่องกรอกเวลา 24 ชั่วโมง (`picker="digital"` เปลี่ยนนาฬิกาเข็มเป็นวงล้อเลื่อนชั่วโมง/นาที)
- `index.ts` export รวมเพื่อ import จาก `components/MID`

## Example

```vue
<script setup lang="ts">
import { MidButton, MidDateField, MidInfoCard, MidTimeField, midColors } from 'components/MID';

const birthDate = ref(''); // "2026-07-26"
const startTime = ref('09:00');
const endTime = ref('12:00');
</script>

<template>
  <MidInfoCard label="ยอดเงินกองทุน" icon="savings" value="50" unit="บาท" :progress="1" />

  <MidDateField v-model="birthDate" label="วันเกิด *" required default-year-month="2000/01" />
  <MidTimeField v-model="startTime" label="เวลาเริ่ม *" required />
  <MidTimeField v-model="endTime" label="เวลาสิ้นสุด *" required :after="startTime" />

  <MidButton label="บันทึก" icon-right="arrow_forward" />
</template>
```

### ต้องใช้ปฏิทินแบบเฉพาะทางเอง

ใช้ locale กลางเสมอ อย่าประกาศชื่อเดือนไทยขึ้นมาใหม่:

```vue
<script setup lang="ts">
import { midThaiDateLocale } from 'components/MID';
</script>

<template>
  <q-date v-model="value" :locale="midThaiDateLocale" />
</template>
```
