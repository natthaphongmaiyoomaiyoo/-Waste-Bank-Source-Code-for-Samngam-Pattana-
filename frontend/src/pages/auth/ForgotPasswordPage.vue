<template>
  <q-page class="forgot-page">
    <div class="forgot-shell">
      <q-btn flat no-caps icon="arrow_back" label="กลับหน้าเข้าสู่ระบบ" class="back-btn" to="/?login=1" />

      <q-card flat class="forgot-card">
        <div class="visual-panel">
          <div class="visual-overlay"></div>
          <img src="/icons/hero-recycle.png" alt="ธนาคารขยะรีไซเคิล" />
          <div class="visual-content">
            <div class="logo-badge">
              <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" />
            </div>
            <h2>ธนาคารขยะรีไซเคิล</h2>
            <p>เปลี่ยนขยะเป็นเงินออม เพื่อกองทุนชุมชน</p>
          </div>
        </div>

        <div class="form-panel">
          <div v-if="isSubmitted" class="success-state">
            <div class="success-check">
              <q-icon name="check" />
            </div>
            <h1>
              {{
                isResetComplete
                  ? 'ตั้งรหัสผ่านใหม่แล้ว'
                  : isDirectReset
                    ? 'ยืนยันตัวตนสำเร็จ'
                    : 'ส่งคำขอแล้ว'
              }}
            </h1>
            <p>
              {{
                isResetComplete
                  ? 'คุณสามารถกลับไปเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที'
                  : isDirectReset
                    ? 'ตั้งรหัสผ่านใหม่สำหรับบัญชีกรรมการได้เลย'
                    : 'ระบบได้รับคำขอรีเซ็ตรหัสผ่านเรียบร้อยแล้ว หากข้อมูลตรงกับบัญชีที่ลงทะเบียนไว้ ระบบจะสร้าง token สำหรับตั้งรหัสใหม่'
              }}
            </p>

            <q-form v-if="!isResetComplete" class="forgot-form reset-form" @submit.prevent="submitReset">
              <!-- Committee accounts get the token back already verified - no need to show it. -->
              <div v-if="!isDirectReset" class="field-label">Reset token</div>
              <q-input
                v-if="!isDirectReset"
                v-model="resetToken"
                outlined
                rounded
                dense
                hide-bottom-space
                class="forgot-input"
                placeholder="วาง token สำหรับตั้งรหัสผ่านใหม่"
                :rules="[(val) => !!val || 'กรุณากรอก reset token']"
              >
                <template #prepend><q-icon name="vpn_key" /></template>
              </q-input>

              <div class="field-label" :class="{ 'q-mt-md': !isDirectReset }">รหัสผ่านใหม่</div>
              <q-input
                v-model="newPassword"
                outlined
                rounded
                dense
                hide-bottom-space
                class="forgot-input"
                :type="showNewPassword ? 'text' : 'password'"
                :rules="[
                  (val) => !!val || 'กรุณากรอกรหัสผ่านใหม่',
                  (val) => val.length >= 8 || 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร',
                ]"
              >
                <template #prepend><q-icon name="password" /></template>
                <template #append>
                  <q-btn
                    flat
                    dense
                    round
                    :icon="showNewPassword ? 'visibility' : 'visibility_off'"
                    @click="showNewPassword = !showNewPassword"
                  />
                </template>
              </q-input>

              <div class="field-label q-mt-md">ยืนยันรหัสผ่านใหม่</div>
              <q-input
                v-model="confirmPassword"
                outlined
                rounded
                dense
                hide-bottom-space
                class="forgot-input"
                :type="showNewPassword ? 'text' : 'password'"
                :rules="[
                  (val) => !!val || 'กรุณายืนยันรหัสผ่านใหม่',
                  (val) => val === newPassword || 'รหัสผ่านใหม่ไม่ตรงกัน',
                ]"
              >
                <template #prepend><q-icon name="verified_user" /></template>
              </q-input>

              <q-btn
                type="submit"
                unelevated
                no-caps
                class="primary-btn full-width q-mt-lg"
                :loading="isResetting"
              >
                <span>ตั้งรหัสผ่านใหม่</span>
                <template #loading><q-spinner-dots size="1.5em" /></template>
              </q-btn>
            </q-form>

            <div class="success-actions">
              <q-btn unelevated no-caps class="primary-btn" label="กลับไปเข้าสู่ระบบ" to="/?login=1" />
              <q-btn flat no-caps class="secondary-btn" label="ส่งคำขอใหม่" @click="resetForm" />
            </div>
          </div>

          <div v-else class="form-content">
            <div class="form-heading">
              <q-badge class="form-badge">
                <q-icon name="lock_reset" />
                ขอรีเซ็ตรหัสผ่าน
              </q-badge>
              <h1>ยืนยันตัวตนสมาชิก</h1>
              <p>ใช้เลขบัตรประชาชนหรือชื่อผู้ใช้ร่วมกับเบอร์โทรศัพท์ที่ลงทะเบียนไว้</p>
            </div>

            <q-banner rounded class="info-banner">
              เพื่อความปลอดภัย ระบบจะรับคำขอและนำไปตรวจสอบกับข้อมูลสมาชิกก่อนรีเซ็ตรหัสผ่าน
            </q-banner>

            <q-form class="forgot-form" @submit.prevent="submitRequest">
              <div class="field-label">เลขบัตรประชาชน / ชื่อผู้ใช้</div>
              <q-input
                v-model="identity"
                outlined
                rounded
                dense
                hide-bottom-space
                class="forgot-input"
                placeholder="เช่น 1100000000000 หรือ somchai01"
                :rules="[(val) => !!val || 'กรุณากรอกข้อมูลสมาชิก']"
              >
                <template #prepend>
                  <q-icon name="badge" />
                </template>
              </q-input>

              <div class="field-label q-mt-md">เบอร์โทรศัพท์</div>
              <q-input
                v-model="phoneNumber"
                outlined
                rounded
                dense
                hide-bottom-space
                class="forgot-input"
                mask="###-###-####"
                placeholder="เช่น 081-234-5678"
                :rules="[(val) => !!val || 'กรุณากรอกเบอร์โทรศัพท์']"
              >
                <template #prepend>
                  <q-icon name="call" />
                </template>
              </q-input>

              <div class="field-label q-mt-md">หมายเหตุเพิ่มเติม</div>
              <q-input
                v-model="note"
                outlined
                rounded
                type="textarea"
                autogrow
                class="forgot-input"
                placeholder="เช่น จำชื่อผู้ใช้ได้แต่จำรหัสผ่านไม่ได้"
              >
                <template #prepend>
                  <q-icon name="edit_note" />
                </template>
              </q-input>

              <div class="action-row">
                <q-btn flat no-caps class="secondary-btn" label="ยกเลิก" to="/?login=1" />
                <q-btn
                  type="submit"
                  unelevated
                  no-caps
                  :loading="isLoading"
                  class="primary-btn"
                >
                  <span>ส่งคำขอรีเซ็ตรหัสผ่าน</span>
                  <template #loading>
                    <q-spinner-dots size="1.5em" />
                  </template>
                </q-btn>
              </div>
            </q-form>
          </div>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from 'src/stores/authStore';
import { midNotify } from 'components/MID';

const authStore = useAuthStore();
const isLoading = ref(false);
const isResetting = ref(false);
const isSubmitted = ref(false);
const isResetComplete = ref(false);
const isDirectReset = ref(false);
const identity = ref('');
const phoneNumber = ref('');
const note = ref('');
const resetToken = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showNewPassword = ref(false);

async function submitRequest() {
  isLoading.value = true;
  try {
    const result = await authStore.requestPasswordReset(
      identity.value.trim(),
      phoneNumber.value.trim(),
      note.value.trim() || undefined,
    );
    resetToken.value = result.resetToken ?? '';
    isDirectReset.value = result.directReset === true && !!result.resetToken;
    isLoading.value = false;
    isSubmitted.value = true;
  } catch (error) {
    isLoading.value = false;
    midNotify({
      type: 'error',
      message: isRateLimited(error)
        ? TOO_MANY_ATTEMPTS_MESSAGE
        : 'ส่งคำขอรีเซ็ตรหัสผ่านไม่สำเร็จ',
    });
  }
}

// Login, forgot-password and reset-password share one limit (10 tries per 15
// minutes per IP); say so instead of a generic failure.
const TOO_MANY_ATTEMPTS_MESSAGE = 'ลองหลายครั้งเกินไป กรุณารอประมาณ 15 นาทีแล้วลองใหม่';

function isRateLimited(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 429;
}

async function submitReset() {
  if (newPassword.value !== confirmPassword.value) return;
  isResetting.value = true;
  try {
    await authStore.resetPassword(resetToken.value.trim(), newPassword.value);
    isResetComplete.value = true;
    midNotify({ type: 'success', message: 'ตั้งรหัสผ่านใหม่สำเร็จ' });
  } catch (error) {
    midNotify({
      type: 'error',
      message: isRateLimited(error)
        ? TOO_MANY_ATTEMPTS_MESSAGE
        : isDirectReset.value
          ? 'หมดเวลาตั้งรหัสผ่าน กรุณากด "ส่งคำขอใหม่" แล้วยืนยันตัวตนอีกครั้ง'
          : 'Reset token ไม่ถูกต้องหรือหมดอายุ',
    });
  } finally {
    isResetting.value = false;
  }
}

function resetForm() {
  identity.value = '';
  phoneNumber.value = '';
  note.value = '';
  resetToken.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  isSubmitted.value = false;
  isResetComplete.value = false;
  isDirectReset.value = false;
}
</script>

<style scoped>
.forgot-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px 20px;
  background: #f3f7f1;
}

.forgot-shell {
  width: min(980px, 100%);
}

.back-btn {
  margin-bottom: 12px;
  color: #087f49;
  font-weight: 700;
}

.forgot-card {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(380px, 1.1fr);
  overflow: hidden;
  border: 1px solid #dfe9df;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(31, 71, 45, 0.1);
}

.visual-panel {
  position: relative;
  min-height: 580px;
  overflow: hidden;
  background: #e8f2e9;
}

.visual-panel img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.visual-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 72, 40, 0.1), rgba(0, 75, 42, 0.78));
}

.visual-content {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: #ffffff;
}

.logo-badge {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  overflow: hidden;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 26px rgba(0, 62, 35, 0.16);
}

.logo-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.visual-content h2 {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 900;
}

.visual-content p {
  max-width: 320px;
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
  font-weight: 700;
}

.form-panel {
  display: flex;
  align-items: center;
  padding: clamp(28px, 5vw, 48px);
}

.form-content,
.success-state {
  width: 100%;
}

.form-badge {
  gap: 8px;
  padding: 7px 12px;
  color: #087f49;
  background: #eef8ef;
  border: 1px solid #d6ebd8;
  border-radius: 8px;
  font-weight: 800;
}

.form-heading h1,
.success-state h1 {
  margin: 16px 0 8px;
  color: #06492d;
  font-size: clamp(30px, 4.3vw, 42px);
  font-weight: 900;
  line-height: 1.08;
}

.form-heading p,
.success-state p {
  margin: 0 0 24px;
  color: #5c7769;
  line-height: 1.65;
}

.info-banner {
  margin-bottom: 22px;
  color: #185238;
  background: #f2faf4;
  border: 1px solid #d8ecdc;
}

.field-label {
  margin-bottom: 8px;
  color: #17452e;
  font-size: 13px;
  font-weight: 800;
}

:deep(.forgot-input .q-field__control) {
  border-radius: 10px;
  background: #fbfdfb;
}

:deep(.forgot-input .q-field__prepend) {
  color: #087f49;
}

.action-row,
.success-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.primary-btn {
  min-height: 50px;
  padding-inline: 20px;
  border-radius: 10px;
  color: #ffffff;
  background: #087f49;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(0, 102, 58, 0.16);
}

.secondary-btn {
  min-height: 50px;
  padding-inline: 16px;
  color: #087f49;
  font-weight: 700;
}

.success-state {
  text-align: center;
}

.reset-form {
  margin-top: 22px;
  text-align: left;
}

.success-check {
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  margin: 0 auto 18px;
  color: #ffffff;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  border-radius: 999px;
  font-size: 46px;
  box-shadow: 0 18px 34px rgba(0, 102, 58, 0.2);
}

.success-actions {
  justify-content: center;
}

@media (max-width: 900px) {
  .forgot-card {
    grid-template-columns: 1fr;
  }

  .visual-panel {
    min-height: 240px;
  }
}

@media (max-width: 560px) {
  .forgot-page {
    padding: 18px 12px;
  }

  .forgot-card {
    border-radius: 10px;
  }

  .visual-panel {
    min-height: 200px;
  }

  .visual-content {
    padding: 18px;
  }

  .visual-content h2 {
    font-size: 24px;
  }

  .visual-content p {
    font-size: 13px;
  }

  .form-panel {
    padding: 24px 18px;
  }

  .action-row,
  .success-actions {
    flex-direction: column;
  }
}
</style>
