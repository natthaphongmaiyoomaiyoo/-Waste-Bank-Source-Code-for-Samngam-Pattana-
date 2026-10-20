<template>
  <q-page class="muni-page">
    <div class="muni-shell add-member-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="person_add" />
          </div>
          <div class="hero-copy">
            <h1>เพิ่มสมาชิกใหม่</h1>
          </div>
          <div class="hero-action-group">

            <q-btn
              flat
              no-caps
              icon="group"
              label="ไปหน้าจัดการสมาชิก"
              class="hero-link-btn"
              to="/admin/members"
            />
          </div>
        </div>
      </section>

      <q-form ref="formRef" greedy @submit.prevent="submit">
        <!-- 1. Personal information -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">1</span> ข้อมูลส่วนตัวผู้สมัคร</div>
            </div>
            <q-icon name="badge" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <q-select
              v-model="form.prefix"
              outlined
              dense
              label="คำนำหน้า"
              class="span-2"
              :options="namePrefixOptions"
              emit-value
              map-options
              clearable
            />
            <q-input
              v-model="form.firstName"
              outlined
              dense
              label="ชื่อ *"
              class="span-5"
              :rules="[required]"
            />
            <q-input
              v-model="form.lastName"
              outlined
              dense
              label="นามสกุล *"
              class="span-5"
              :rules="[required]"
            />

            <q-input
              v-model="form.citizenId"
              outlined
              dense
              label="เลขบัตรประชาชน (13 หลัก) *"
              class="span-4"
              mask="#############"
              unmasked-value
              :rules="[(v) => /^\d{13}$/.test(v || '') || 'ต้องเป็นตัวเลข 13 หลัก']"
            />
            <MidDateField
              v-model="form.birthDate"
              class="span-4"
              label="วันเกิด *"
              required
              default-year-month="2000/01"
              no-future
            />
            <q-select
              v-model="form.gender"
              outlined
              dense
              emit-value
              map-options
              label="เพศ"
              class="span-4"
              :options="genderOptions"
              clearable
            />

            <q-input
              v-model="form.phone"
              outlined
              dense
              label="เบอร์โทรศัพท์ *"
              class="span-6"
              :rules="[(v) => (v && v.trim().length >= 6) || 'กรอกเบอร์โทรอย่างน้อย 6 หลัก']"
            />
            <q-input v-model="form.occupation" outlined dense label="อาชีพ" class="span-6" />
          </div>

          <div v-if="ageCanCertify" class="age-line" :class="`age-${ageBand}`">
            <q-icon :name="AGE_BAND_ICONS[ageBand]" />
            อายุผู้สมัคร {{ age }} ปี ({{ AGE_BAND_NOTES[ageBand] }})
          </div>
        </q-card>

        <!-- 2. Address -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">2</span> ที่อยู่ผู้สมัคร</div>
            </div>
            <q-icon name="home" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <q-input v-model="form.address.houseNo" outlined dense label="บ้านเลขที่" class="span-3" />
            <q-select
              v-model="form.address.moo"
              outlined
              dense
              emit-value
              map-options
              clearable
              label="หมู่ที่"
              class="span-3"
              :loading="villageAreaStore.loading"
              :options="mooOptions"
            />
            <q-input v-model="form.address.subdistrict" outlined dense label="ตำบล" class="span-6" />
            <q-input v-model="form.address.district" outlined dense label="อำเภอ" class="span-4" />
            <q-input v-model="form.address.province" outlined dense label="จังหวัด" class="span-4" />
            <q-input v-model="form.address.postcode" outlined dense label="รหัสไปรษณีย์" class="span-4" />
          </div>
        </q-card>

        <!-- 3. Referrer / guarantor -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">3</span> ผู้แนะนำ / ผู้ค้ำประกัน</div>
            </div>
            <q-icon name="handshake" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <q-select
              v-model="form.guarantor.prefix"
              outlined
              dense
              label="คำนำหน้าผู้แนะนำ"
              class="span-3"
              :options="namePrefixOptions"
              emit-value
              map-options
              clearable
            />
            <q-input
              v-model="form.guarantor.firstName"
              outlined
              dense
              label="ชื่อผู้แนะนำ *"
              class="span-4"
              :rules="[required]"
            />
            <q-input
              v-model="form.guarantor.lastName"
              outlined
              dense
              label="นามสกุลผู้แนะนำ *"
              class="span-5"
              :rules="[required]"
            />
            <q-input
              v-model="form.guarantor.guarantorPhone"
              outlined
              dense
              label="เบอร์โทรผู้แนะนำ"
              class="span-3"
            />
            <q-input
              v-model="form.guarantor.relationship"
              outlined
              dense
              label="ความสัมพันธ์กับผู้สมัคร"
              class="span-3"
            />
            <q-input v-model="form.guarantor.note" outlined dense label="หมายเหตุ" class="span-12" />
          </div>
        </q-card>

        <!-- 4. Eligibility verification -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">4</span> การตรวจสอบคุณสมบัติ</div>
            </div>
            <q-icon name="fact_check" class="panel-deco" />
          </div>

          <div class="verify-list q-mt-md">
            <q-checkbox
              v-model="verification.ageVerified"
              :disable="!ageCanCertify"
              color="green-9"
              class="verify-check"
            >
              <div class="verify-title">รับรองอายุผู้สมัคร</div>
              <div class="verify-caption">{{ ageCaption }}</div>
            </q-checkbox>

            <q-checkbox v-model="verification.addressVerified" color="green-9" class="verify-check">
              <div class="verify-title">ตรวจสอบที่อยู่แล้ว</div>
              <div class="verify-caption">ยืนยันว่าผู้สมัครอาศัยอยู่ตามที่อยู่ที่กรอกจริง (อยู่ในเขตพื้นที่บริการ)</div>
            </q-checkbox>

            <q-checkbox v-model="verification.guarantorVerified" color="green-9" class="verify-check">
              <div class="verify-title">ตรวจสอบผู้แนะนำ/ผู้ค้ำประกันแล้ว</div>
              <div class="verify-caption">ยืนยันตัวตนและข้อมูลติดต่อของผู้แนะนำ/ผู้ค้ำประกันเรียบร้อย</div>
            </q-checkbox>
          </div>

          <q-separator class="q-my-md" />

          <div class="result-row">
            <div class="verify-title q-mb-sm">ผลการตรวจสอบคุณสมบัติ *</div>
            <q-option-group
              v-model="verification.result"
              inline
              color="green-9"
              :options="[
                { label: 'ผ่านการตรวจสอบ', value: 'passed', disable: !allChecksOk },
                { label: 'ไม่ผ่านการตรวจสอบ', value: 'failed' },
              ]"
            />
            <div v-if="!allChecksOk" class="verify-caption">
              จะเลือก "ผ่านการตรวจสอบ" ได้เมื่อติ๊กรับรองอายุ ตรวจสอบที่อยู่ และผู้แนะนำครบ
            </div>
            <q-input
              v-model="verification.note"
              outlined
              dense
              autogrow
              label="บันทึกผลการตรวจสอบ / เหตุผล"
              class="q-mt-sm"
            />
          </div>
        </q-card>

        <!-- 5. Approval status -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">5</span> สถานะการอนุมัติ</div>
            </div>
            <q-icon name="how_to_reg" class="panel-deco" />
          </div>

          <q-option-group
            v-model="approveNow"
            class="q-mt-sm approve-group"
            color="green-9"
            :options="[
              {
                label: 'อนุมัติเป็นสมาชิกทันที (สถานะ: ใช้งาน)',
                value: true,
                disable: verification.result !== 'passed',
              },
              { label: 'บันทึกเป็นผู้สมัครรอตรวจสอบ (สถานะ: รอตรวจสอบ)', value: false },
            ]"
          />

          <q-separator class="q-my-md" />

          <div class="verify-title">บัญชีเข้าสู่ระบบของสมาชิก</div>
          <div class="verify-caption q-mb-sm">
            ระบบสร้างบัญชีให้อัตโนมัติ ชื่อผู้ใช้ = เลขบัตรประชาชน
            หากไม่กำหนดรหัสผ่าน ระบบจะใช้เลขบัตรประชาชนเป็นรหัสผ่านเริ่มต้น
          </div>
          <q-input
            v-model="form.password"
            outlined
            dense
            label="รหัสผ่านเริ่มต้น (ไม่บังคับ อย่างน้อย 8 ตัวอักษร)"
            class="password-input"
            :type="showPassword ? 'text' : 'password'"
            :rules="[(v) => !v || v.length >= 8 || 'รหัสผ่านอย่างน้อย 8 ตัวอักษร']"
          >
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility' : 'visibility_off'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>
        </q-card>

        <div class="submit-row">
          <q-btn flat no-caps label="ยกเลิก" icon="close" class="reset-btn" to="/admin/members" />
          <q-btn flat no-caps label="ล้างฟอร์ม" icon="restart_alt" class="reset-btn" @click="resetForm" />
          <q-btn
            unelevated
            no-caps
            type="submit"
            color="positive"
            icon="save"
            class="submit-btn"
            :label="approveNow ? 'บันทึกและอนุมัติสมาชิก' : 'บันทึกผู้สมัคร'"
            :loading="saving"
          />
        </div>
      </q-form>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { QForm } from 'quasar';
import axios from 'axios';
import { useCommitteeStore } from 'src/stores/committeeStore';
import { useVillageAreaStore, villageMooOptions } from 'src/stores/villageAreaStore';
import { apiErrorMessage as sharedApiErrorMessage } from 'src/utils/apiError';
import { required } from 'src/utils/validators';
import { namePrefixOptions } from 'src/utils/namePrefix';
import { MidDateField, midNotify } from 'components/MID';

// The usual age range, mirroring backend MEMBER_MIN_AGE / MEMBER_MAX_AGE
// (backend/src/config/constants.ts) - guidance only. The system just works the
// age out; whether it qualifies is certified by hand (ageVerified), in range or not.
const MIN_AGE = 2;
const MAX_AGE = 70;

type AgeBand = 'ok' | 'outside';
const AGE_BAND_ICONS: Record<AgeBand, string> = { ok: 'check_circle', outside: 'info' };
const AGE_BAND_NOTES: Record<AgeBand, string> = {
  ok: `อยู่ในเกณฑ์ปกติ ${MIN_AGE}-${MAX_AGE} ปี`,
  outside: `นอกเกณฑ์ปกติ ${MIN_AGE}-${MAX_AGE} ปี สมัครได้เมื่อรับรองอายุ`,
};

const router = useRouter();
const store = useCommitteeStore();
const villageAreaStore = useVillageAreaStore();

const formRef = ref<QForm | null>(null);
const saving = ref(false);
const showPassword = ref(false);
const approveNow = ref(false);

const genderOptions = [
  { label: 'ชาย', value: 'male' },
  { label: 'หญิง', value: 'female' },
];


// Community defaults so desk entry only needs house no. / moo in the common case.
function emptyForm() {
  return {
    prefix: null as string | null,
    firstName: '',
    lastName: '',
    citizenId: '',
    birthDate: '',
    gender: null as string | null,
    phone: '',
    occupation: '',
    password: '',
    address: {
      houseNo: '',
      moo: '',
      subdistrict: 'สามง่ามพัฒนา',
      district: 'หันคา',
      province: 'ชัยนาท',
      postcode: '17130',
    },
    guarantor: {
      prefix: null as string | null,
      firstName: '',
      lastName: '',
      guarantorPhone: '',
      relationship: '',
      note: '',
    },
  };
}

function emptyVerification() {
  return {
    ageVerified: false,
    addressVerified: false,
    guarantorVerified: false,
    result: 'failed' as 'passed' | 'failed',
    note: '',
  };
}

const form = reactive(emptyForm());
const verification = reactive(emptyVerification());
const mooOptions = computed(() => villageMooOptions(villageAreaStore.items));

const age = computed(() => {
  if (!form.birthDate) return null;
  const birth = new Date(form.birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years -= 1;
  return years;
});

const ageBand = computed<AgeBand>(() =>
  age.value !== null && age.value >= MIN_AGE && age.value <= MAX_AGE ? 'ok' : 'outside',
);
// Needs a real birth date (not empty, not after today) - any age can be certified.
const ageCanCertify = computed(() => age.value !== null && age.value >= 0);
const ageCaption = computed(() => {
  if (!ageCanCertify.value) return 'กรอกวันเกิดก่อน ระบบจะคำนวณอายุให้';
  if (ageBand.value === 'outside') {
    return `ระบบคำนวณอายุได้ ${age.value} ปี นอกเกณฑ์ปกติ ${MIN_AGE}-${MAX_AGE} ปี ผู้ตรวจสอบพิจารณารับรองได้`;
  }
  return `ระบบคำนวณอายุได้ ${age.value} ปี (เกณฑ์ปกติ ${MIN_AGE}-${MAX_AGE} ปี)`;
});
const allChecksOk = computed(
  () =>
    verification.ageVerified && verification.addressVerified && verification.guarantorVerified,
);

// A certification is for the birth date it was given against.
watch(
  () => form.birthDate,
  () => {
    verification.ageVerified = false;
  },
);

onMounted(() => {
  void villageAreaStore.fetchActive();
});

// Keep the selections consistent when a check is unticked afterwards.
watch(allChecksOk, (ok) => {
  if (!ok && verification.result === 'passed') verification.result = 'failed';
});
watch(
  () => verification.result,
  (result) => {
    if (result !== 'passed') approveNow.value = false;
  },
);
function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    return 'เลขบัตรประชาชนนี้มีในระบบแล้ว';
  }
  return sharedApiErrorMessage(error, fallback);
}

function cleanOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function guarantorFullName() {
  const name = `${form.guarantor.firstName.trim()} ${form.guarantor.lastName.trim()}`.trim();
  return `${form.guarantor.prefix ?? ''}${name}`.trim();
}

async function submit() {
  const valid = await formRef.value?.validate();
  if (!valid) {
    midNotify({ type: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    return;
  }

  saving.value = true;

  // Step 1: register the applicant (status: pending).
  let member;
  try {
    member = await store.createMember({
      citizenId: form.citizenId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.birthDate,
      phone: form.phone.trim(),
      address: {
        houseNo: cleanOptional(form.address.houseNo),
        moo: cleanOptional(form.address.moo),
        subdistrict: cleanOptional(form.address.subdistrict),
        district: cleanOptional(form.address.district),
        province: cleanOptional(form.address.province),
        postcode: cleanOptional(form.address.postcode),
      },
      guarantor: {
        guarantorName: guarantorFullName(),
        guarantorPhone: cleanOptional(form.guarantor.guarantorPhone),
        relationship: cleanOptional(form.guarantor.relationship),
        note: cleanOptional(form.guarantor.note),
      },
      ...(form.prefix ? { prefix: form.prefix } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(cleanOptional(form.occupation) ? { occupation: form.occupation.trim() } : {}),
      ...(form.password ? { password: form.password } : {}),
    });
  } catch (error) {
    saving.value = false;
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ไม่สามารถบันทึกผู้สมัครได้') });
    return;
  }

  // Step 2 + 3: record the eligibility screening, then approve if requested.
  // The member row already exists here, so failures fall back to "จัดการสมาชิก"
  // where the screening/approval can be redone.
  try {
    await store.recordVerification(member.id, {
      ageVerified: verification.ageVerified,
      addressVerified: verification.addressVerified,
      guarantorVerified: verification.guarantorVerified,
      result: verification.result,
      ...(cleanOptional(verification.note) ? { note: verification.note.trim() } : {}),
    });
    if (approveNow.value && verification.result === 'passed') {
      await store.approveMember(member.id);
      midNotify({
        type: 'success',
        message: `อนุมัติสมาชิกใหม่เรียบร้อย (รหัสสมาชิก ${member.memberCode})`,
      });
    } else {
      midNotify({
        type: 'success',
        message: `บันทึกผู้สมัครเรียบร้อย (รหัสสมาชิก ${member.memberCode}) สถานะ: รอตรวจสอบ`,
      });
    }
  } catch (error) {
    midNotify({
      type: 'warning',
      message: apiErrorMessage(
        error,
        `บันทึกผู้สมัคร (รหัส ${member.memberCode}) แล้ว แต่บันทึกผลตรวจสอบ/อนุมัติไม่สำเร็จ ไปดำเนินการต่อได้ที่หน้าจัดการสมาชิก`,
      ),
    });
  } finally {
    saving.value = false;
  }

  void router.push('/committee/members');
}

function resetForm() {
  Object.assign(form, emptyForm());
  Object.assign(verification, emptyVerification());
  approveNow.value = false;
  formRef.value?.resetValidation();
}

// function fillMockData() {
//   form.prefix = 'นาย';
//   form.firstName = 'รักสะอาด';
//   form.lastName = 'รักษ์โลก';
//   form.citizenId = '1122334455667';
//   form.phone = '0899999999';
//   form.birthDate = '1990-08-12';
//   form.address.houseNo = '123/45';
//   form.address.moo = '1';
//
//   form.guarantor.prefix = 'นาง';
//   form.guarantor.firstName = 'ใจดี';
//   form.guarantor.lastName = 'มีสุข';
//   form.guarantor.guarantorPhone = '0811111111';
//   form.guarantor.relationship = 'มารดา';
//   form.guarantor.note = 'ทดสอบระบบ';
// }
</script>

<style lang="scss" scoped>
@use './theme' as *;

.add-member-shell {
  width: min(1080px, 100%);
}

// Softer wash behind the form than the shared flat green.
.muni-page {
  background: linear-gradient(180deg, #e9f4ec 0%, #f5f8f5 320px);
}

.hero-link-btn {
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  padding: 4px 18px;
  font-weight: 800;
  transition: background 0.2s ease;
}

.hero-link-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

// --- Section cards -----------------------------------------------------------

.panel-card {
  border-radius: 20px;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}

.panel-card:hover {
  border-color: #cfe3d4;
  box-shadow: 0 12px 32px rgba(16, 84, 52, 0.08);
}

.panel-head {
  padding-bottom: 14px;
  border-bottom: 1px dashed #e0ebe2;
}

.panel-deco {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  color: #1e8a44;
  background: linear-gradient(135deg, #eaf6ec, #f6fbf7);
  border: 1px solid #dcefe1;
  border-radius: 14px;
  font-size: 22px;
}

.step-chip {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-right: 8px;
  color: #ffffff;
  background: linear-gradient(135deg, #159757, #17c13f);
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(23, 193, 63, 0.28);
  font-size: 14px;
  font-weight: 800;
  vertical-align: 2px;
}

// --- Inputs: rounder, softer than Quasar's default outlined look ---------------

.add-member-shell :deep(.q-field--outlined .q-field__control) {
  border-radius: 12px;
  background: #fbfdfb;
  transition: background 0.2s ease;
}

.add-member-shell :deep(.q-field--outlined .q-field__control:before) {
  border-color: #dbe6dd;
  transition: border-color 0.2s ease;
}

.add-member-shell :deep(.q-field--outlined:hover .q-field__control:before) {
  border-color: #a9cdb4;
}

.add-member-shell :deep(.q-field--outlined.q-field--focused .q-field__control) {
  background: #ffffff;
}

.add-member-shell :deep(.q-field--outlined.q-field--focused .q-field__control:after) {
  border-color: #17a24f;
}

.add-member-shell :deep(.q-field__label) {
  color: #6b7c72;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px 14px;
}

.span-2 { grid-column: span 2; }
.span-3 { grid-column: span 3; }
.span-4 { grid-column: span 4; }
.span-5 { grid-column: span 5; }
.span-6 { grid-column: span 6; }
.span-12 { grid-column: span 12; }

.date-picker-input :deep(.q-field__control),
.date-picker-input :deep(input) {
  cursor: pointer;
}

.age-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 13.5px;
  font-weight: 800;
}

.age-line .q-icon {
  font-size: 20px;
}

.age-ok {
  color: #0d7a44;
  background: #e9f7ee;
  border: 1px solid rgba(19, 184, 79, 0.22);
}

// Outside the usual range: allowed once the age is certified.
.age-outside {
  color: #8a5a12;
  background: #fff4e5;
  border: 1px solid rgba(224, 161, 42, 0.3);
}

.verify-list {
  display: grid;
  gap: 12px;
}

.verify-title {
  color: #1c2b23;
  font-size: 14px;
  font-weight: 900;
}

.verify-caption {
  margin-top: 2px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 700;
}

// Checkboxes read as tappable cards; tint green once ticked.
.verify-check {
  align-items: flex-start;
  padding: 12px 16px 12px 10px;
  background: #fbfdfb;
  border: 1px solid #e2ebe4;
  border-radius: 14px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.verify-check:hover {
  border-color: #b8d8c2;
}

.verify-check:has(.q-checkbox__inner--truthy) {
  background: #f2faf4;
  border-color: rgba(19, 184, 79, 0.4);
}

.verify-check :deep(.q-checkbox__inner--truthy .q-checkbox__bg),
.verify-check :deep(.q-checkbox__inner--indet .q-checkbox__bg),
.result-row :deep(.q-radio__inner--truthy .q-radio__bg),
.approve-group :deep(.q-radio__inner--truthy .q-radio__bg) {
  color: #0f8f46;
}

// Radio choices as selectable pill cards.
.result-row :deep(.q-option-group--inline) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.approve-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.result-row :deep(.q-radio),
.approve-group :deep(.q-radio) {
  padding: 10px 18px 10px 10px;
  background: #fbfdfb;
  border: 1px solid #e2ebe4;
  border-radius: 999px;
  font-weight: 700;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.result-row :deep(.q-radio:hover),
.approve-group :deep(.q-radio:hover) {
  border-color: #b8d8c2;
}

.result-row :deep(.q-radio:has(.q-radio__inner--truthy)),
.approve-group :deep(.q-radio:has(.q-radio__inner--truthy)) {
  background: #eefaf1;
  border-color: rgba(19, 184, 79, 0.45);
}

.result-row :deep(.q-radio.disabled),
.approve-group :deep(.q-radio.disabled) {
  background: #f4f6f4;
  border-style: dashed;
}

.password-input {
  max-width: 420px;
}

// Action bar: white rounded strip so the buttons don't float on the page wash.
.submit-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin: 24px 0 12px;
  padding: 14px 18px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(23, 46, 34, 0.06);
}

.submit-btn {
  min-height: 46px;
  padding: 0 30px;
  border-radius: 999px;
  background: linear-gradient(135deg, #0f9d52, #17c13f) !important;
  box-shadow: 0 8px 20px rgba(23, 193, 63, 0.3);
  font-weight: 900;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.submit-btn:hover {
  box-shadow: 0 10px 26px rgba(23, 193, 63, 0.42);
  transform: translateY(-1px);
}

.reset-btn {
  color: #7f8f85;
  border: 1px solid #e2ebe4;
  border-radius: 999px;
  padding: 0 18px;
  font-weight: 800;
}

@media (max-width: 860px) {
  .span-2,
  .span-3,
  .span-4,
  .span-5 {
    grid-column: span 6;
  }
}

@media (max-width: 560px) {
  .span-2,
  .span-3,
  .span-4,
  .span-5,
  .span-6 {
    grid-column: span 12;
  }

  /* Phone: ยกเลิก and ล้างฟอร์ม share a row, save gets the full row below -
     an even grid instead of buttons wrapping onto ragged rows. */
  .submit-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 12px;
  }

  .reset-btn,
  .submit-btn {
    min-height: 48px;
    padding: 0 14px;
  }

  .submit-btn {
    grid-column: 1 / -1;
  }
}
</style>
