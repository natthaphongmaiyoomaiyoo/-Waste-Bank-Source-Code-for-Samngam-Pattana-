<template>
  <q-layout view="hHh lpR fFf" class="apply-layout">
    <q-page-container>
      <q-page class="apply-page">
        <div class="apply-shell">
      <q-btn flat no-caps icon="arrow_back" label="กลับหน้าข่าวสาร" class="back-btn" to="/" />

      <q-card flat class="apply-card">
        <div class="apply-visual-panel">
          <img src="/icons/hero-recycle.png" alt="สมัครสมาชิกธนาคารขยะ" />
          <div class="visual-overlay"></div>
          <div class="visual-content">
            <div class="logo-badge">
              <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" />
            </div>
            <q-badge class="visual-badge">
              <q-icon name="how_to_reg" />
              สมัครสมาชิก
            </q-badge>
            <h1>สมัครสมาชิกธนาคารขยะ</h1>
            <p>กรอกข้อมูลส่วนตัว แนบเอกสาร และเก็บเลขอ้างอิงไว้ตรวจสอบสถานะ</p>
            <div class="visual-stat">
              <strong>{{ applicationStore.latestApplications.length }}</strong>
              <span>ใบสมัครที่ส่งแล้ว</span>
            </div>
          </div>
        </div>

        <div class="apply-form-panel">
          <q-tabs v-model="activeTab" dense no-caps align="left" class="apply-tabs" active-color="green-9">
            <q-tab name="form" icon="edit_document" label="สมัครสมาชิก" />
            <q-tab name="status" icon="fact_check" label="ตรวจสอบสถานะ" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="activeTab" animated class="apply-tab-panels">
            <q-tab-panel name="form" class="panel-content">
              <q-form class="application-form" @submit.prevent="submitApplication">
              <div class="section-title">ข้อมูลส่วนตัว</div>
              <div class="form-grid">
                <q-input
                  v-model="form.fullName"
                  outlined
                  dense
                  label="ชื่อ-นามสกุล"
                  :rules="[(value) => !!value || 'กรุณากรอกชื่อ-นามสกุล']"
                />
                <q-input
                  v-model="form.idCard"
                  outlined
                  dense
                  label="เลขบัตรประชาชน"
                  mask="#-####-#####-##-#"
                  :rules="[(value) => !!value || 'กรุณากรอกเลขบัตรประชาชน']"
                />
                <MidDateField v-model="form.birthDate" label="วันเกิด" required no-future />
                <q-input
                  v-model="form.phone"
                  outlined
                  dense
                  label="เบอร์โทรศัพท์"
                  mask="###-###-####"
                  :rules="[(value) => !!value || 'กรุณากรอกเบอร์โทรศัพท์']"
                />
                <q-input v-model="form.email" outlined dense label="อีเมล (ถ้ามี)" type="email" />
                <q-input v-model="form.occupation" outlined dense label="อาชีพ" />
              </div>

              <q-input
                v-model="form.address"
                outlined
                dense
                type="textarea"
                rows="3"
                label="ที่อยู่"
                class="q-mt-sm"
                :rules="[(value) => !!value || 'กรุณากรอกที่อยู่']"
              />

              <q-select
                v-model="form.village"
                outlined
                dense
                emit-value
                map-options
                label="หมู่บ้าน"
                :options="villageOptions"
                class="q-mt-sm"
                :rules="[(value) => !!value || 'กรุณาเลือกหมู่บ้าน']"
              />

              <div class="section-title document-title">เอกสารประกอบการสมัคร</div>
              <q-file
                v-model="documents"
                outlined
                dense
                multiple
                counter
                use-chips
                accept=".pdf,.jpg,.jpeg,.png"
                label="อัปโหลดสำเนาบัตรประชาชน / ทะเบียนบ้าน / เอกสารอื่น ๆ"
                :rules="[(value) => (value && value.length > 0) || 'กรุณาแนบเอกสารอย่างน้อย 1 ไฟล์']"
              >
                <template #prepend>
                  <q-icon name="upload_file" />
                </template>
              </q-file>

              <div class="form-actions">
                <q-btn flat no-caps label="ล้างข้อมูล" class="clear-btn" @click="resetForm" />
                <q-btn
                  unelevated
                  no-caps
                  type="submit"
                  icon-right="arrow_forward"
                  label="ส่งใบสมัคร"
                  class="submit-btn"
                />
              </div>
              </q-form>
            </q-tab-panel>

            <q-tab-panel name="status" class="panel-content">
            <div class="status-layout">
              <div class="status-search">
                <div class="section-title">ตรวจสอบสถานะการสมัคร</div>
                <p>กรอกเลขอ้างอิงที่ได้รับหลังส่งใบสมัคร หรือเลขบัตรประชาชนที่ใช้สมัคร</p>
                <q-input
                  v-model="statusKeyword"
                  outlined
                  dense
                  label="เลขอ้างอิง / เลขบัตรประชาชน"
                  @keyup.enter="checkStatus"
                >
                  <template #prepend>
                    <q-icon name="search" />
                  </template>
                </q-input>
                <q-btn
                  unelevated
                  no-caps
                  label="ตรวจสอบ"
                  icon-right="fact_check"
                  class="submit-btn full-width q-mt-md"
                  @click="checkStatus"
                />
              </div>

              <div class="status-result">
                <q-card v-if="foundApplication" flat class="result-card">
                  <q-badge :class="['status-chip', foundApplication.status]">
                    {{ statusMeta[foundApplication.status].label }}
                  </q-badge>
                  <h2>{{ foundApplication.fullName }}</h2>
                  <div class="reference">เลขอ้างอิง {{ foundApplication.referenceNo }}</div>
                  <q-linear-progress
                    rounded
                    size="10px"
                    :value="statusMeta[foundApplication.status].progress"
                    :color="statusMeta[foundApplication.status].color"
                    class="q-mt-lg"
                  />
                  <div class="result-note">{{ foundApplication.note }}</div>
                  <div class="result-meta">
                    ส่งใบสมัคร: {{ formatDate(foundApplication.submittedAt) }}<br />
                    อัปเดตล่าสุด: {{ formatDate(foundApplication.updatedAt) }}
                  </div>
                </q-card>

                <q-card v-else flat class="empty-result">
                  <q-icon name="assignment_late" size="48px" />
                  <div>{{ statusMessage }}</div>
                </q-card>
              </div>
            </div>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </q-card>

      <q-dialog v-model="showSuccessDialog" persistent>
        <q-card class="success-dialog">
          <div class="success-check">
            <q-icon name="check" />
          </div>
          <h2>ส่งใบสมัครสำเร็จ</h2>
          <p>กรุณาเก็บเลขอ้างอิงนี้ไว้เพื่อตรวจสอบสถานะ</p>
          <div class="success-reference">{{ submittedApplication?.referenceNo }}</div>
          <q-card-actions class="success-actions">
            <q-btn flat no-caps label="ปิด" class="clear-btn" @click="showSuccessDialog = false" />
            <q-btn
              unelevated
              no-caps
              label="ตรวจสอบสถานะ"
              class="submit-btn"
              @click="goToSubmittedStatus"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
        </div>
      </q-page>
    </q-page-container>

    <AppFooter />
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppFooter from 'components/AppFooter.vue';
import { useMemberApplicationStore, type MemberApplication } from 'src/stores/memberApplicationStore';
import { MidDateField, midNotify } from 'components/MID';

const applicationStore = useMemberApplicationStore();

const activeTab = ref<'form' | 'status'>('form');
const documents = ref<File[]>([]);
const statusKeyword = ref('');
const statusMessage = ref('ยังไม่มีข้อมูลการตรวจสอบ');
const foundApplication = ref<MemberApplication | null>(null);
const submittedApplication = ref<MemberApplication | null>(null);
const showSuccessDialog = ref(false);

const form = ref({
  fullName: '',
  idCard: '',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  village: '',
  occupation: '',
});

const villageOptions = [
  { label: 'หมู่บ้านที่ 1', value: 'v1' },
  { label: 'หมู่บ้านที่ 2', value: 'v2' },
  { label: 'หมู่บ้านที่ 3', value: 'v3' },
  { label: 'หมู่บ้านที่ 4', value: 'v4' },
];

const statusMeta = {
  pending: { label: 'รอตรวจสอบ', color: 'orange', progress: 0.35 },
  reviewing: { label: 'กำลังตรวจเอกสาร', color: 'blue', progress: 0.62 },
  approved: { label: 'อนุมัติแล้ว', color: 'positive', progress: 1 },
  rejected: { label: 'ไม่อนุมัติ', color: 'negative', progress: 1 },
};

async function submitApplication() {
  try {
    const application = await applicationStore.submitApplication({
      ...form.value,
      documents: documents.value.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'unknown',
        uploadedAt: new Date().toISOString(),
      })),
    });

    submittedApplication.value = application;
    showSuccessDialog.value = true;
    resetForm();
  } catch {
    midNotify({ type: 'error', message: 'ส่งใบสมัครไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือเลขบัตรประชาชนซ้ำ' });
  }
}

function checkStatus() {
  foundApplication.value = applicationStore.findApplication(statusKeyword.value);
  statusMessage.value = foundApplication.value
    ? ''
    : 'ไม่พบใบสมัคร กรุณาตรวจสอบเลขอ้างอิงหรือเลขบัตรประชาชนอีกครั้ง';
}

function goToSubmittedStatus() {
  if (!submittedApplication.value) return;

  statusKeyword.value = submittedApplication.value.referenceNo;
  showSuccessDialog.value = false;
  activeTab.value = 'status';
  checkStatus();
}

function resetForm() {
  form.value = {
    fullName: '',
    idCard: '',
    birthDate: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    occupation: '',
  };
  documents.value = [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<style scoped>
.apply-layout {
  background:
    radial-gradient(circle at 0 0, rgba(194, 232, 199, 0.68), transparent 34%),
    linear-gradient(135deg, #edf8ed 0%, #ffffff 58%, #eef7ed 100%);
}

.apply-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px 20px 56px;
  background: transparent;
}

.apply-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.back-btn {
  margin-bottom: 14px;
  color: #087f49;
  font-weight: 800;
}

.apply-card {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(520px, 1.08fr);
  min-height: 680px;
  overflow: hidden;
  border: 1px solid rgba(8, 127, 73, 0.1);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 22px 54px rgba(31, 71, 45, 0.12);
}

.apply-visual-panel {
  position: relative;
  min-height: 680px;
  overflow: hidden;
  background: #dcefe1;
}

.apply-visual-panel > img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.visual-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 72, 40, 0.04), rgba(0, 88, 51, 0.86)),
    linear-gradient(90deg, rgba(3, 55, 34, 0.12), transparent);
}

.visual-content {
  position: absolute;
  right: 32px;
  bottom: 34px;
  left: 32px;
  z-index: 1;
  color: #ffffff;
}

.logo-badge {
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  overflow: hidden;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(0, 62, 35, 0.24);
}

.logo-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.visual-badge {
  gap: 8px;
  padding: 8px 14px;
  color: #087f49;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  font-weight: 900;
}

.visual-content h1 {
  margin: 18px 0 10px;
  font-size: clamp(32px, 4vw, 46px);
  font-weight: 950;
  line-height: 1.05;
}

.visual-content p {
  max-width: 360px;
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-weight: 800;
  line-height: 1.7;
}

.visual-stat {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.visual-stat strong {
  font-size: 26px;
  line-height: 1;
}

.visual-stat span {
  font-size: 13px;
  font-weight: 900;
}

.apply-form-panel {
  min-width: 0;
  max-height: 680px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.apply-tabs {
  flex: 0 0 auto;
  padding: 8px 12px;
  color: #4d7560;
  font-weight: 900;
}

.apply-tab-panels {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: transparent;
}

.panel-content {
  padding: clamp(22px, 4vw, 34px);
}

.section-title {
  margin-bottom: 14px;
  color: #06492d;
  font-size: 18px;
  font-weight: 950;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.document-title {
  margin-top: 24px;
}

.form-actions,
.success-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.clear-btn,
.submit-btn {
  min-height: 44px;
  border-radius: 10px;
  font-weight: 900;
}

.clear-btn {
  color: #087f49;
  background: #f3faf3;
}

.submit-btn {
  color: #ffffff;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  box-shadow: 0 14px 28px rgba(0, 102, 58, 0.18);
}

.status-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.status-search p {
  margin: -4px 0 18px;
  color: #5c7769;
  font-weight: 700;
  line-height: 1.7;
}

.result-card,
.empty-result {
  min-height: 260px;
  padding: 28px;
  border-radius: 18px;
  background: #f8fbf8;
  border: 1px solid #d6e8db;
}

.result-card h2 {
  margin: 18px 0 4px;
  color: #06492d;
  font-size: 28px;
  font-weight: 950;
}

.reference,
.result-meta {
  color: #6d8a7c;
  font-weight: 800;
}

.result-note {
  margin-top: 18px;
  color: #17452e;
  font-weight: 800;
}

.result-meta {
  margin-top: 18px;
  font-size: 12px;
  line-height: 1.7;
}

.status-chip {
  padding: 7px 12px;
  border-radius: 999px;
  font-weight: 900;
}

.status-chip.pending {
  color: #9a5a00;
  background: #fff4d6;
}

.status-chip.reviewing {
  color: #075985;
  background: #e0f2fe;
}

.status-chip.approved {
  color: #087f49;
  background: #dbf4df;
}

.status-chip.rejected {
  color: #b91c1c;
  background: #fee2e2;
}

.empty-result {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  color: #6d8a7c;
  text-align: center;
  font-weight: 800;
}

.success-dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 32px 30px 26px;
  text-align: center;
  border-radius: 20px;
}

.success-check {
  display: grid;
  width: 78px;
  height: 78px;
  place-items: center;
  margin: 0 auto 18px;
  color: #ffffff;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  border-radius: 999px;
  font-size: 42px;
}

.success-dialog h2 {
  margin: 0;
  color: #06492d;
  font-weight: 950;
}

.success-dialog p {
  margin: 8px 0 16px;
  color: #5c7769;
  font-weight: 700;
}

.success-reference {
  padding: 14px;
  color: #06492d;
  background: #edf8ee;
  border-radius: 12px;
  font-size: 20px;
  font-weight: 950;
}

@media (max-width: 980px) {
  .apply-card {
    grid-template-columns: 1fr;
  }

  .apply-visual-panel {
    min-height: 260px;
  }

  .apply-form-panel {
    max-height: none;
  }

  .apply-tab-panels {
    overflow: visible;
  }
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions,
  .success-actions {
    flex-direction: column;
  }
}
</style>
