<template>
  <q-dialog
    class="login-modal-dialog"
    :model-value="modelValue"
    transition-show="scale"
    transition-hide="fade"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="login-dialog-card">
      <div class="login-visual">
        <img src="/icons/hero-recycle.png" alt="เข้าสู่ระบบธนาคารขยะรีไซเคิล" />
        <div class="login-visual-shade"></div>
        <div class="login-visual-text">
          <img src="/icons/สามง่าม.png" alt="ตราเทศบาลตำบลสามง่ามพัฒนา" />
          <div>
            <div class="login-visual-title">กองทุนธนาคารขยะ</div>
            <div class="login-visual-caption">เทศบาลตำบลสามง่ามพัฒนา</div>
          </div>
        </div>
      </div>

      <div class="login-form-panel">
        <div class="login-dialog-head">
          <div>
            <q-badge class="login-dialog-badge">
              <q-icon name="person" />
              สมาชิกระบบ
            </q-badge>
            <h2>เข้าสู่ระบบ</h2>
          </div>
          <q-btn flat round dense icon="close" v-close-popup />
        </div>

        <q-form class="login-form" @submit.prevent="login">
          <q-input
            v-model="username"
            outlined
            rounded
            dense
            color="green-8"
            label="เลขบัตรประชาชน / ชื่อผู้ใช้"
            class="dialog-input"
          >
            <template #prepend><q-icon name="person" /></template>
          </q-input>

          <q-input
            v-model="password"
            outlined
            rounded
            dense
            color="green-8"
            :type="showPassword ? 'text' : 'password'"
            label="รหัสผ่าน"
            class="dialog-input q-mt-sm"
          >
            <template #prepend><q-icon name="lock" /></template>
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility' : 'visibility_off'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <div class="login-dialog-row">
            <q-checkbox v-model="rememberMe" color="green-8" label="จดจำฉันไว้" dense />
            <router-link to="/forgot-password" class="login-dialog-forgot" @click="close"
              >ลืมรหัสผ่าน?</router-link
            >
          </div>

          <div class="login-actions">
            <q-btn
              type="submit"
              unelevated
              no-caps
              icon-right="arrow_forward"
              label="เข้าสู่ระบบ"
              class="dialog-submit-btn"
              :loading="isLoading"
            />
          </div>
        </q-form>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { homePathForRole, useAuthStore } from 'src/stores/authStore';
import { getAuthItem } from 'src/utils/authStorage';
import { midNotify } from 'components/MID';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const rememberMe = ref(false);
const showPassword = ref(false);
const isLoading = ref(false);
function close() {
  emit('update:modelValue', false);
}

async function login() {
  isLoading.value = true;
  try {
    const result = await authStore.login(username.value.trim(), password.value, rememberMe.value);
    isLoading.value = false;
    close();
    void router.push(
      result.user.mustChangePassword ? '/change-password' : homePathForRole(getAuthItem('role')),
    );
  } catch {
    isLoading.value = false;
    midNotify({
      type: 'error',
      message: 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบเลขบัตรประชาชน/เบอร์โทรและรหัสผ่าน',
    });
  }
}
</script>

<style scoped>
/* Mirrors FristPage.vue's .register-dialog-card two-panel format (same left
   visual image/treatment) so login and register dialogs feel like one system.
   Duplicated here (not shared) because Vue SFC styles don't cross files. */
.login-dialog-card {
  position: relative;
  width: min(920px, calc(100vw - 64px));
  max-width: min(920px, calc(100vw - 64px));
  max-height: min(600px, 92vh);
  display: grid;
  grid-template-columns: 44% 56%;
  overflow: hidden;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 28px 90px rgba(0, 72, 40, 0.28);
}

.login-visual {
  position: relative;
  min-height: 460px;
  overflow: hidden;
  background: #dcefe1;
}

.login-visual img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.login-visual-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 72, 40, 0.03), rgba(0, 88, 51, 0.82));
}

.login-visual-text {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  width: min(280px, calc(100% - 48px));
  text-align: center;
  color: white;
  transform: translate(-50%, -50%);
}

/* The municipality's round seal, on a white disc so it reads against the
   photo. */
.login-visual-text img {
  width: 140px;
  height: 140px;
  padding: 5px;
  border-radius: 50%;
  object-fit: contain;
  background: white;
  box-shadow: 0 16px 34px rgba(0, 62, 35, 0.24);
}

.login-visual-title {
  font-size: 26px;
  font-weight: 950;
  line-height: 1.15;
}

.login-visual-caption {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.3;
}

.login-form-panel {
  min-width: 0;
  max-height: min(600px, 92vh);
  overflow-y: auto;
  padding: clamp(32px, 4vw, 44px);
  background: #ffffff;
}

.login-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.login-dialog-head h2 {
  margin: 16px 0 6px;
  color: #06492d;
  font-size: clamp(30px, 3.6vw, 40px);
  font-weight: 950;
  line-height: 1;
}

.login-dialog-badge {
  gap: 8px;
  padding: 8px 14px;
  color: #087f49;
  background: #dbf4df;
  border-radius: 999px;
  font-weight: 900;
}

.login-form {
  display: flex;
  flex-direction: column;
}

:deep(.dialog-input .q-field__control) {
  height: 52px;
  min-width: 0;
  border-radius: 999px;
  background: #f8fbf8;
}

:deep(.dialog-input .q-field__control:before) {
  border-color: #d6e8db;
}

:deep(.dialog-input .q-field__control:hover:before) {
  border-color: #0a8b51;
}

:deep(.dialog-input.q-field--focused .q-field__control:after) {
  border-color: #087f49;
  border-width: 2px;
}

:deep(.dialog-input .q-field__prepend),
:deep(.dialog-input .q-field__append) {
  color: #087f49;
}

.login-dialog-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 2px 0;
}

.login-dialog-forgot {
  color: #087f49;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.login-actions {
  margin-top: 22px;
}

.dialog-submit-btn {
  width: 100%;
  min-height: 56px;
  border-radius: 999px;
  color: white;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  font-size: 16px;
  font-weight: 900;
  box-shadow: 0 18px 34px rgba(0, 102, 58, 0.22);
}

@media (max-width: 768px) {
  .login-dialog-card {
    grid-template-columns: 1fr;
    width: min(560px, calc(100vw - 28px));
    max-width: min(560px, calc(100vw - 28px));
    min-width: 0;
  }

  .login-visual {
    min-height: 160px;
  }

  /* Seal + two lines must fit the 160px strip. */
  .login-visual-text {
    gap: 10px;
  }

  .login-visual-text img {
    width: 72px;
    height: 72px;
  }

  .login-form-panel {
    max-height: calc(92vh - 160px);
    padding: 32px 28px 30px;
  }
}

@media (max-width: 640px) {
  .login-dialog-card {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    min-width: 0;
    border-radius: 16px;
  }

  .login-visual {
    display: none;
  }

  .login-form-panel {
    max-height: min(80vh, 560px);
    padding: 30px 22px 26px;
  }

}
</style>
