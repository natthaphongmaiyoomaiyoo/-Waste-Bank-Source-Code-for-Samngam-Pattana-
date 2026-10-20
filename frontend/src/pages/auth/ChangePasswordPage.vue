<template>
  <q-page class="change-page">
    <q-card flat class="change-card">
      <div class="heading">
        <q-badge class="heading-badge">
          <q-icon name="lock_reset" />
          เปลี่ยนรหัสผ่าน
        </q-badge>
        <h1>ตั้งรหัสผ่านใหม่</h1>
        <p>บัญชีนี้ใช้รหัสเริ่มต้นหรือรหัสที่ต้องเปลี่ยนก่อนใช้งานระบบต่อ</p>
      </div>

      <q-form class="change-form" @submit.prevent="submit">
        <div class="field-label">รหัสผ่านปัจจุบัน</div>
        <q-input
          v-model="currentPassword"
          outlined
          dense
          hide-bottom-space
          class="change-input"
          :type="showCurrent ? 'text' : 'password'"
          :rules="[(val) => !!val || 'กรุณากรอกรหัสผ่านปัจจุบัน']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-btn
              flat
              dense
              round
              :icon="showCurrent ? 'visibility' : 'visibility_off'"
              @click="showCurrent = !showCurrent"
            />
          </template>
        </q-input>

        <div class="field-label q-mt-md">รหัสผ่านใหม่</div>
        <q-input
          v-model="newPassword"
          outlined
          dense
          hide-bottom-space
          class="change-input"
          :type="showNew ? 'text' : 'password'"
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
              :icon="showNew ? 'visibility' : 'visibility_off'"
              @click="showNew = !showNew"
            />
          </template>
        </q-input>

        <div class="field-label q-mt-md">ยืนยันรหัสผ่านใหม่</div>
        <q-input
          v-model="confirmPassword"
          outlined
          dense
          hide-bottom-space
          class="change-input"
          :type="showNew ? 'text' : 'password'"
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
          class="submit-btn full-width q-mt-lg"
          :loading="isLoading"
        >
          <span>บันทึกรหัสผ่านใหม่</span>
          <template #loading><q-spinner-dots size="1.5em" /></template>
        </q-btn>
      </q-form>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { homePathForRole, useAuthStore } from 'src/stores/authStore';
import { getAuthItem } from 'src/utils/authStorage';
import { midNotify } from 'components/MID';

const router = useRouter();
const authStore = useAuthStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const showCurrent = ref(false);
const showNew = ref(false);

async function submit() {
  if (newPassword.value !== confirmPassword.value) return;
  isLoading.value = true;
  try {
    await authStore.changePassword(currentPassword.value, newPassword.value);
    midNotify({ type: 'success', message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    await router.replace(homePathForRole(getAuthItem('role')));
  } catch {
    midNotify({ type: 'error', message: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านเดิม' });
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.change-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #f3f7f1;
}

.change-card {
  width: min(520px, 100%);
  padding: clamp(26px, 5vw, 42px);
  border: 1px solid #dfe9df;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(31, 71, 45, 0.1);
}

.heading-badge {
  gap: 8px;
  padding: 7px 12px;
  color: #087f49;
  background: #eef8ef;
  border: 1px solid #d6ebd8;
  border-radius: 8px;
  font-weight: 800;
}

.heading h1 {
  margin: 16px 0 8px;
  color: #06492d;
  font-size: 34px;
  font-weight: 900;
  line-height: 1.12;
}

.heading p {
  margin: 0 0 24px;
  color: #5c7769;
  line-height: 1.6;
}

.field-label {
  margin-bottom: 8px;
  color: #17452e;
  font-size: 13px;
  font-weight: 800;
}

:deep(.change-input .q-field__control) {
  min-height: 50px;
  border-radius: 10px;
  background: #fbfdfb;
}

:deep(.change-input .q-field__prepend),
:deep(.change-input .q-field__append) {
  color: #087f49;
}

.submit-btn {
  min-height: 52px;
  border-radius: 10px;
  color: #ffffff;
  background: #087f49;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(0, 102, 58, 0.16);
}
</style>
