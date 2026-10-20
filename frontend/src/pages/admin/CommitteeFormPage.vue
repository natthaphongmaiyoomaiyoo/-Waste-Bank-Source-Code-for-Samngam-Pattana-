<template>
  <q-page class="muni-page">
    <div class="muni-shell committee-form-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon :name="isEdit ? 'manage_accounts' : 'person_add'" />
          </div>
          <div class="hero-copy">
            <h1>{{ isEdit ? 'แก้ไขข้อมูลกรรมการ' : 'เพิ่มกรรมการหมู่บ้าน' }}</h1>
          </div>
          <q-btn
            flat
            no-caps
            icon="groups"
            label="ไปหน้ากรรมการหมู่บ้าน"
            class="hero-link-btn"
            to="/admin/committees"
          />
        </div>
      </section>

      <div v-if="loading" class="loading-wrap q-mt-lg">
        <q-spinner-dots color="green-7" size="42px" />
      </div>

      <q-banner v-else-if="loadError" rounded class="bg-red-1 text-red-9 q-mt-lg">
        {{ loadError }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="กลับไปหน้ารายชื่อ" to="/admin/committees" />
        </template>
      </q-banner>

      <q-form v-else ref="formRef" greedy @submit.prevent="submit">
        <!-- 1. Village the committee is responsible for -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">1</span> หมู่บ้านที่รับผิดชอบ</div>
            </div>
            <q-icon name="holiday_village" class="panel-deco" />
          </div>

          <q-banner v-if="!villageAreaStore.loading && villageOptions.length === 0" rounded class="warn-banner q-mt-md">
            <template #avatar><q-icon name="warning" color="amber-9" /></template>
            ยังไม่มีหมู่บ้านในระบบ กรุณาเพิ่มหมู่บ้านก่อนจึงจะสร้างกรรมการได้
            <template #action>
              <q-btn flat no-caps color="amber-9" label="ไปหน้าหมู่บ้าน" to="/village" />
            </template>
          </q-banner>

          <div class="form-grid q-mt-md">
            <q-select
              v-model="form.villageAreaId"
              outlined
              dense
              emit-value
              map-options
              class="span-6"
              label="หมู่บ้านที่รับผิดชอบ *"
              :loading="villageAreaStore.loading"
              :options="villageOptions"
              :rules="[(v) => !!v || 'กรุณาเลือกหมู่บ้านที่รับผิดชอบ']"
            >
              <template #prepend><q-icon name="holiday_village" /></template>
            </q-select>

            <div class="span-6">
              <div v-if="selectedVillage" class="village-preview">
                <q-badge class="moo-badge">หมู่ {{ selectedVillage.moo ?? '-' }}</q-badge>
                <div>
                  <div class="village-name">{{ selectedVillage.villageName }}</div>
                  <div class="village-sub">{{ villageSubtitle(selectedVillage) }}</div>
                </div>
              </div>
              <div v-else class="village-preview is-empty">
                <q-icon name="info" />
                <span>ยังไม่ได้เลือกหมู่บ้าน</span>
              </div>
            </div>
          </div>
        </q-card>

        <!-- 2. Committee's personal details -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">2</span> ข้อมูลกรรมการ</div>
            </div>
            <q-icon name="badge" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <q-input
              v-model.trim="form.fullName"
              outlined
              dense
              class="span-6"
              label="ชื่อ-นามสกุล *"
              :rules="[(v) => !!v?.trim() || 'กรุณาระบุชื่อ-นามสกุล']"
            />
            <q-input
              v-model.trim="form.phone"
              outlined
              dense
              class="span-3"
              label="เบอร์โทรศัพท์"
              :rules="[(v) => !v || v.trim().length >= 6 || 'กรอกเบอร์โทรอย่างน้อย 6 หลัก']"
            />
            <q-select
              v-model="form.status"
              outlined
              dense
              emit-value
              map-options
              class="span-3"
              label="สถานะการใช้งาน"
              :options="statusOptions"
            />
          </div>
        </q-card>

        <!-- 3. Login account -->
        <q-card flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title"><span class="step-chip">3</span> บัญชีเข้าสู่ระบบ</div>
              <div v-if="isEdit" class="panel-caption">
                เปลี่ยนชื่อผู้ใช้ไม่ได้ เว้นช่องรหัสผ่านไว้หากไม่ต้องการเปลี่ยน
              </div>
            </div>
            <q-icon name="lock" class="panel-deco" />
          </div>

          <div class="form-grid q-mt-md">
            <q-input
              v-model.trim="form.username"
              outlined
              dense
              class="span-6"
              label="ชื่อผู้ใช้ (Username) *"
              :disable="isEdit"
              :rules="usernameRules"
            />
            <q-input
              v-model="form.password"
              outlined
              dense
              class="span-3"
              :type="showPassword ? 'text' : 'password'"
              :label="isEdit ? 'ตั้งรหัสผ่านใหม่ (ไม่บังคับ)' : 'รหัสผ่าน *'"
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
              class="span-3"
              :type="showPassword ? 'text' : 'password'"
              label="ยืนยันรหัสผ่าน"
              :rules="confirmPasswordRules"
            />
          </div>
        </q-card>

        <div class="submit-row">
          <q-btn flat no-caps label="ยกเลิก" icon="close" class="reset-btn" to="/admin/committees" />
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
            :label="isEdit ? 'บันทึกการแก้ไข' : 'บันทึกกรรมการ'"
            :loading="store.saving"
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
import { useAdminCommitteeStore } from 'src/stores/adminCommitteeStore';
import { useVillageAreaStore, type VillageArea } from 'src/stores/villageAreaStore';
import { apiErrorMessage } from 'src/utils/apiError';
import { midNotify } from 'components/MID';

// Add / edit form for a village-committee account. One page for both modes:
// /admin/committees/new and /admin/committees/:id/edit.

const route = useRoute();
const router = useRouter();
const store = useAdminCommitteeStore();
const villageAreaStore = useVillageAreaStore();

const formRef = ref<QForm | null>(null);
const showPassword = ref(false);
const loading = ref(false);
const loadError = ref<string | null>(null);

const committeeId = computed(() => {
  const id = Number(route.params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
});
const isEdit = computed(() => committeeId.value !== null);

const statusOptions = [
  { label: 'เปิดใช้งาน', value: 'active' },
  { label: 'ระงับการใช้งาน', value: 'inactive' },
];

function emptyForm() {
  return {
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    villageAreaId: null as number | null,
    status: 'active',
  };
}

const form = reactive(emptyForm());

// Villages come from the master data the admin maintains first (/village).
const villageOptions = computed(() =>
  villageAreaStore.items.map((village) => ({
    label: `หมู่ ${village.moo ?? '-'} - ${village.villageName}`,
    value: village.id,
  })),
);

const selectedVillage = computed(
  () => villageAreaStore.items.find((village) => village.id === form.villageAreaId) ?? null,
);

const usernameRules = computed(() =>
  isEdit.value
    ? []
    : [
        (v: string) => !!v?.trim() || 'กรุณาระบุชื่อผู้ใช้',
        (v: string) => v.trim().length >= 3 || 'ชื่อผู้ใช้อย่างน้อย 3 ตัวอักษร',
      ],
);

const passwordRules = computed(() =>
  isEdit.value
    ? [(v: string) => !v || v.length >= 8 || 'รหัสผ่านอย่างน้อย 8 ตัวอักษร']
    : [
        (v: string) => !!v || 'กรุณาระบุรหัสผ่าน',
        (v: string) => v.length >= 8 || 'รหัสผ่านอย่างน้อย 8 ตัวอักษร',
      ],
);

const confirmPasswordRules = computed(() => [
  (v: string) => (!form.password && !v) || !!v || 'กรุณายืนยันรหัสผ่าน',
  (v: string) => v === form.password || 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
]);

function villageSubtitle(village: VillageArea) {
  return (
    [
      village.subdistrict ? `ต.${village.subdistrict}` : null,
      village.district ? `อ.${village.district}` : null,
      village.province ? `จ.${village.province}` : null,
    ]
      .filter(Boolean)
      .join(' ') || 'ไม่ได้ระบุที่ตั้ง'
  );
}

// Backend errors come back as { error: "..." } - apiErrorMessage unwraps that
// so the specific Thai message (duplicate username, inactive village, ...)
// reaches the user instead of a generic fallback.
const apiMessage = apiErrorMessage;

onMounted(async () => {
  void villageAreaStore.fetchActive().catch(() => {
    midNotify({ type: 'error', message: 'โหลดรายชื่อหมู่บ้านไม่สำเร็จ' });
  });

  if (!committeeId.value) return;

  loading.value = true;
  try {
    const committee = await store.fetchCommittee(committeeId.value);
    form.username = committee.username;
    form.fullName = committee.fullName;
    form.phone = committee.phone ?? '';
    form.villageAreaId = committee.villageArea?.id ?? null;
    form.status = committee.status;
  } catch (error) {
    loadError.value = apiMessage(error, 'ไม่พบข้อมูลกรรมการที่ต้องการแก้ไข');
  } finally {
    loading.value = false;
  }
});

function resetForm() {
  Object.assign(form, emptyForm());
  formRef.value?.resetValidation();
}

async function submit() {
  const valid = await formRef.value?.validate();
  if (!valid || !form.villageAreaId) return;

  try {
    if (committeeId.value) {
      await store.updateCommittee(committeeId.value, {
        fullName: form.fullName,
        phone: form.phone || undefined,
        villageAreaId: form.villageAreaId,
        status: form.status,
        password: form.password || undefined,
      });
    } else {
      await store.createCommittee({
        username: form.username,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone || undefined,
        villageAreaId: form.villageAreaId,
        status: form.status,
      });
    }

    midNotify({
      type: 'success',
      message: isEdit.value ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มกรรมการหมู่บ้านแล้ว',
    });
    void router.push('/admin/committees');
  } catch (error) {
    midNotify({
      type: 'error',
      message: apiMessage(error, 'บันทึกข้อมูลกรรมการไม่สำเร็จ'),
    });
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

.committee-form-shell {
  width: min(1080px, 100%);
}

// Softer wash behind the form, same as the committee "add member" page.
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

.committee-form-shell :deep(.q-field--outlined .q-field__control) {
  border-radius: 12px;
  background: #fbfdfb;
  transition: background 0.2s ease;
}

.committee-form-shell :deep(.q-field--outlined .q-field__control:before) {
  border-color: #dbe6dd;
  transition: border-color 0.2s ease;
}

.committee-form-shell :deep(.q-field--outlined:hover .q-field__control:before) {
  border-color: #a9cdb4;
}

.committee-form-shell :deep(.q-field--outlined.q-field--focused .q-field__control) {
  background: #ffffff;
}

.committee-form-shell :deep(.q-field--outlined.q-field--focused .q-field__control:after) {
  border-color: #17a24f;
}

.committee-form-shell :deep(.q-field__label) {
  color: #6b7c72;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px 14px;
}

.span-3 { grid-column: span 3; }
.span-6 { grid-column: span 6; }

@media (max-width: 720px) {
  .span-3,
  .span-6 {
    grid-column: span 12;
  }
}

// --- Selected village preview --------------------------------------------------

.village-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 10px 16px;
  background: #f2faf4;
  border: 1px solid rgba(19, 184, 79, 0.22);
  border-radius: 14px;
}

.village-preview.is-empty {
  color: #7f8f85;
  background: #fbfdfb;
  border: 1px dashed #dbe6dd;
  font-weight: 700;
  font-size: 13px;
}

.moo-badge {
  background: #e6f5ed;
  color: #0b7a47;
  font-weight: 700;
  border-radius: 8px;
  padding: 4px 10px;
}

.village-name {
  color: #0e2d1e;
  font-weight: 800;
}

.village-sub {
  color: #6b7c72;
  font-size: 12.5px;
  font-weight: 600;
}

.warn-banner {
  background: #fff8e6;
  color: #8a5a00;
  border: 1px solid #f5e0b0;
}

// --- Submit bar ----------------------------------------------------------------
// White rounded strip so the buttons don't float on the page wash (same as the
// committee "add member" page).
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

.reset-btn {
  color: #7f8f85;
  border: 1px solid #e2ebe4;
  border-radius: 999px;
  padding: 0 18px;
  font-weight: 800;
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

// Phones: ยกเลิก / ล้างฟอร์ม share a row at equal width, save fills the row below.
@media (max-width: 599px) {
  .submit-row {
    gap: 10px;
    padding: 14px;
  }

  .reset-btn {
    flex: 1 1 0;
    min-height: 46px;
  }

  .submit-btn {
    flex: 1 0 100%;
  }
}
</style>
