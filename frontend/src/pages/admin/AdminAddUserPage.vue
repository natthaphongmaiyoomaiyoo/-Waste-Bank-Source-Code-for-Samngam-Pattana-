<template>
  <q-page class="muni-page">
    <div class="muni-shell user-form-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon :name="isEdit ? 'manage_accounts' : 'person_add'" />
          </div>
          <div class="hero-copy">
            <h1>{{ isEdit ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานระบบ' }}</h1>
            <p>กำหนดข้อมูลส่วนตัว สิทธิ์การใช้งาน และบัญชีเข้าสู่ระบบของผู้ใช้งาน</p>
          </div>
          <div class="hero-action-group">

            <q-btn
              flat
              no-caps
              icon="groups"
              label="ไปหน้ารายชื่อผู้ใช้งาน"
              class="hero-link-btn"
              to="/admin/users"
            />
          </div>
        </div>
      </section>

      <div v-if="loading" class="loading-wrap q-mt-lg">
        <q-spinner-dots color="green-7" size="42px" />
      </div>

      <q-banner v-else-if="loadError" rounded class="bg-red-1 text-red-9 q-mt-lg">
        {{ loadError }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="กลับไปหน้ารายชื่อ" to="/admin/users" />
        </template>
      </q-banner>

      <q-form v-else ref="formRef" greedy @submit.prevent="submit" @validation-error="onValidationError">
        <!-- 1. Role and General Info -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">1</span> สิทธิ์และข้อมูลทั่วไป</div>
            </div>
            <q-icon name="badge" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <!-- Member Code Field if editing a member -->
            <q-input
              v-if="isEditMember && form.memberCode"
              v-model="form.memberCode"
              outlined
              dense
              class="span-6"
              label="รหัสสมาชิก (Member Code)"
              disable
            />
            <!-- Role Selection -->
            <q-select
              v-else
              v-model="form.roleId"
              outlined
              dense
              emit-value
              map-options
              class="span-6"
              label="สิทธิ์การใช้งาน *"
              :options="formRoleOptions"
              :rules="[(v) => !!v || 'กรุณาเลือกสิทธิ์การใช้งาน']"
            >
              <template #prepend><q-icon name="admin_panel_settings" /></template>
            </q-select>

            <q-input
              v-model.trim="form.username"
              outlined
              dense
              class="span-6"
              label="ชื่อผู้ใช้งาน (Username) *"
              :disable="isEdit"
              :rules="usernameRules"
            >
              <template #prepend><q-icon name="account_circle" /></template>
            </q-input>

            <q-select
              v-model="form.prefix"
              outlined
              dense
              label="คำนำหน้า"
              class="span-2"
              :options="prefixOptions"
              clearable
              :disable="isEdit"
            />
            <q-input
              v-model.trim="form.firstName"
              outlined
              dense
              label="ชื่อ *"
              class="span-5"
              :disable="isEdit"
              :rules="[(v) => !!v || 'กรุณากรอกชื่อ']"
            />
            <q-input
              v-model.trim="form.lastName"
              outlined
              dense
              label="นามสกุล *"
              class="span-5"
              :disable="isEdit"
              :rules="[(v) => !!v || 'กรุณากรอกนามสกุล']"
            />
            
            <q-input
              v-model.trim="form.phone"
              outlined
              dense
              class="span-6"
              label="เบอร์โทรศัพท์ *"
              :rules="[(v) => !!v?.trim() || 'กรุณาระบุเบอร์โทรศัพท์']"
            />

            <!-- In edit mode, allow toggling status here or via the main page -->
            <!-- For simplicity and consistency with old dialog, we don't need status dropdown inside edit, we can use the main page for it. But let's add it if requested. -->
          </div>
        </q-card>

        <!-- 2. Password -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">2</span> รหัสผ่านเข้าสู่ระบบ</div>
              <div class="panel-subtitle">ระบบสร้างบัญชีให้อัตโนมัติ (หากไม่กำหนดระบบจะใช้เบอร์โทรศัพท์เป็นรหัสผ่านเริ่มต้น)</div>
            </div>
            <q-icon name="key" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <q-input
              v-model="form.password"
              outlined
              dense
              class="span-6"
              :type="showPassword ? 'text' : 'password'"
              :label="isEdit ? 'ตั้งรหัสผ่านใหม่ (ไม่บังคับ)' : 'รหัสผ่านเริ่มต้น (ไม่บังคับ)'"
              :rules="passwordRules"
            >
              <template #append>
                <q-icon
                  :name="showPassword ? 'visibility' : 'visibility_off'"
                  class="cursor-pointer"
                  @click="showPassword = !showPassword"
                />
              </template>
            </q-input>
            
            <q-input
              v-model="form.confirmPassword"
              outlined
              dense
              class="span-6"
              :type="showPassword ? 'text' : 'password'"
              label="ยืนยันรหัสผ่าน"
              :rules="confirmPasswordRules"
            />
          </div>
        </q-card>

        <div class="submit-row">
          <q-btn flat no-caps label="ยกเลิก" icon="close" class="reset-btn" to="/admin/users" />
          <q-btn
            v-if="!isEdit"
            flat
            no-caps
            label="ล้างฟอร์ม"
            icon="restart_alt"
            class="reset-btn"
            @click="resetForm"
          />
          <q-btn
            unelevated
            no-caps
            type="submit"
            color="positive"
            icon="save"
            class="submit-btn"
            :label="isEdit ? 'บันทึกการแก้ไข' : 'บันทึกผู้ใช้งาน'"
            :loading="store.loading"
          />
        </div>
      </q-form>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { QForm } from 'quasar';
import { useUserManagementStore } from 'src/stores/userManagementStore';
import { useAdminMasterDataStore } from 'src/stores/adminMasterDataStore';
import { midNotify } from 'components/MID';

const route = useRoute();
const router = useRouter();
const store = useUserManagementStore();
const masterStore = useAdminMasterDataStore();

const formRef = ref<QForm | null>(null);
const showPassword = ref(false);
const loading = ref(false);
const loadError = ref<string | null>(null);

const userId = computed(() => {
  const id = Number(route.params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
});
const isEdit = computed(() => userId.value !== null);

function emptyForm() {
  return {
    roleId: null as number | null,
    username: '',
    prefix: null as string | null,
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    memberCode: ''
  };
}

const prefixOptions = ['นาย', 'นาง', 'นางสาว'];

const form = reactive(emptyForm());

const roleNameMap: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  committee: 'กรรมการ',
  municipality: 'เจ้าหน้าที่เทศบาล',
  buyer: 'ผู้รับซื้อ',
  member: 'สมาชิก',
};

const isEditMember = computed(() => {
  if (!isEdit.value) return false;
  const role = masterStore.roles.find(r => r.id === form.roleId);
  return role?.roleName === 'member';
});

// Filter roles: only Admin, Committee, Municipality, Buyer for new users
const formRoleOptions = computed(() => {
  if (isEditMember.value) {
    const memberRole = masterStore.roles.find(r => r.id === form.roleId);
    if (memberRole) {
      return [{
        label: `${roleNameMap[memberRole.roleName] || memberRole.roleName} (${memberRole.roleName})`,
        value: memberRole.id
      }];
    }
  }
  
  return masterStore.roles
    .filter(r => r.roleName !== 'member')
    .map(r => ({
      label: `${roleNameMap[r.roleName] || r.roleName} (${r.roleName})`,
      value: r.id,
    }));
});

const usernameRules = computed(() =>
  isEdit.value
    ? []
    : [
        (v: string) => !!v?.trim() || 'กรุณาระบุชื่อผู้ใช้อย่างน้อย 3 ตัวอักษร',
      ],
);

const passwordRules = computed(() => [
  (v: string) => !v || v.length >= 8 || 'รหัสผ่านอย่างน้อย 8 ตัวอักษร',
]);

const confirmPasswordRules = computed(() => [
  (v: string) => (!form.password && !v) || !!v || 'กรุณายืนยันรหัสผ่าน',
  (v: string) => v === form.password || 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
]);

onMounted(async () => {
  try {
    loading.value = true;
    
    // Ensure roles are loaded
    if (masterStore.roles.length === 0) {
      await masterStore.fetchRoles();
    }
    
    if (isEdit.value && userId.value) {
      // Ensure users are loaded so we can find the one to edit
      if (store.users.length === 0) {
        await store.fetchUsers();
      }
      const user = store.users.find(u => u.id === userId.value);
      if (user) {
        form.username = user.username;
        const parts = user.fullName.split(' ');
        if (parts.length >= 3 && prefixOptions.includes(parts[0] || '')) {
          form.prefix = parts[0] || null;
          form.firstName = parts[1] || '';
          form.lastName = parts.slice(2).join(' ');
        } else if (parts.length >= 2) {
          form.prefix = null;
          form.firstName = parts[0] || '';
          form.lastName = parts.slice(1).join(' ');
        } else {
          form.prefix = null;
          form.firstName = user.fullName;
          form.lastName = '';
        }
        form.phone = user.phone || '';
        form.roleId = user.role.id;
        form.memberCode = user.member?.memberCode || '';
      } else {
        loadError.value = 'ไม่พบข้อมูลผู้ใช้งานที่ต้องการแก้ไข';
      }
    }
  } catch {
    loadError.value = 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่';
  } finally {
    loading.value = false;
  }
});

function resetForm() {
  Object.assign(form, emptyForm());
  formRef.value?.resetValidation();
}

// function fillMockData() {
//   form.username = 'test_user123';
//   form.prefix = 'นาย';
//   form.firstName = 'ทดสอบ';
//   form.lastName = 'ระบบใหม่';
//   form.phone = '0812345678';
//   form.password = 'password123';
//   form.confirmPassword = 'password123';
//   if (formRoleOptions.value.length > 0) {
//     form.roleId = formRoleOptions.value[0]?.value ?? null;
//   }
// }

function onValidationError() {
  midNotify({
    type: 'warning',
    message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
  });
}

async function submit() {
  const success = await formRef.value?.validate();
  if (!success) return;

  try {
    const combinedFullName = `${form.prefix ?? ''} ${form.firstName} ${form.lastName}`.trim();

    if (isEdit.value && userId.value) {
      const payload: { fullName?: string; phone?: string; roleId?: number; password?: string } = {
        fullName: combinedFullName,
        phone: form.phone
      };
      if (form.roleId) {
        payload.roleId = form.roleId;
      }
      if (form.password) {
        payload.password = form.password;
      }
      await store.updateUser(userId.value, payload);
      midNotify({ type: 'success', message: 'อัปเดตข้อมูลผู้ใช้งานแล้ว' });
    } else {
      let finalPassword = form.password;
      if (!finalPassword && form.phone) {
        finalPassword = form.phone;
      }

      const createPayload: { username: string; password?: string; fullName: string; phone?: string; roleId: number } = {
        username: form.username,
        fullName: combinedFullName,
        phone: form.phone,
        roleId: form.roleId!
      };
      if (finalPassword) {
        createPayload.password = finalPassword;
      }
      await store.createUser(createPayload);
      midNotify({ type: 'success', message: 'เพิ่มผู้ใช้งานใหม่สำเร็จ' });
    }
    void router.push('/admin/users');
  } catch (e: unknown) {
    const data = (e as Record<string, Record<string, Record<string, string>>>)?.response?.data;
    let msg = data?.error || data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    if (msg === 'Username already exists') {
      msg = 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว กรุณาใช้ชื่ออื่น';
    }
    midNotify({ type: 'error', message: msg });
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

// Same form page look as the committee "add member" page.
.user-form-shell {
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
  transition:
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.panel-card:hover {
  border-color: #cfe3d4;
  box-shadow: 0 12px 32px rgba(16, 84, 52, 0.08);
}

.panel-head {
  padding-bottom: 14px;
  border-bottom: 1px dashed #e0ebe2;
}

.panel-subtitle {
  margin-top: 4px;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 500;
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

.user-form-shell :deep(.q-field--outlined .q-field__control) {
  border-radius: 12px;
  background: #fbfdfb;
  transition: background 0.2s ease;
}

.user-form-shell :deep(.q-field--outlined .q-field__control:before) {
  border-color: #dbe6dd;
  transition: border-color 0.2s ease;
}

.user-form-shell :deep(.q-field--outlined:hover .q-field__control:before) {
  border-color: #a9cdb4;
}

.user-form-shell :deep(.q-field--outlined.q-field--focused .q-field__control) {
  background: #ffffff;
}

.user-form-shell :deep(.q-field--outlined.q-field--focused .q-field__control:after) {
  border-color: #17a24f;
}

.user-form-shell :deep(.q-field__label) {
  color: #6b7c72;
  font-weight: 600;
}

// --- Action bar: white rounded strip so the buttons don't float on the page wash.

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
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
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

@media (max-width: 599px) {
  .hero-link-btn {
    width: 100%;
  }
}
</style>
