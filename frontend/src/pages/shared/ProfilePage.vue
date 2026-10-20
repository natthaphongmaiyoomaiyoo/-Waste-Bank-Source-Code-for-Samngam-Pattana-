<template>
  <q-page class="profile-page">
    <div class="profile-shell">
      <div v-if="isLoadingProfile" class="state-card profile-loading">
        <q-spinner-dots size="2em" color="positive" />
      </div>

      <div v-else-if="loadError" class="state-card profile-error">
        <q-icon name="error_outline" size="32px" />
        <p>{{ loadError }}</p>
        <q-btn no-caps unelevated color="positive" label="ลองใหม่อีกครั้ง" @click="loadProfile" />
      </div>

      <q-card v-else flat class="profile-card">
        <!-- Identity banner -->
        <div class="profile-banner">
          <div class="avatar-wrap">
            <q-avatar size="96px" class="profile-avatar-lg">
              <img v-if="avatarUrl" :src="avatarUrl" alt="รูปโปรไฟล์" />
              <template v-else>{{ avatarLetter }}</template>
              <div v-if="isUploadingAvatar" class="avatar-uploading">
                <q-spinner-dots size="1.6em" color="white" />
              </div>
            </q-avatar>
            <q-btn
              round
              unelevated
              icon="photo_camera"
              size="sm"
              class="avatar-edit-btn"
              :disable="isUploadingAvatar"
              @click="triggerFilePicker"
            >
              <q-tooltip>เปลี่ยนรูปโปรไฟล์</q-tooltip>
            </q-btn>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden-file-input"
              @change="onAvatarSelected"
            />
          </div>

          <div class="banner-identity">
            <div class="banner-name-row">
              <h1 class="profile-name">{{ user?.fullName || '-' }}</h1>
              <q-badge class="role-badge">{{ roleLabel }}</q-badge>
            </div>
            <div class="banner-meta">
              <span class="meta-item">
                <q-icon name="badge" />
                {{ user?.username || '-' }}
              </span>
              <span v-if="member" class="meta-item">
                <q-icon name="verified" />
                รหัสสมาชิก {{ member.memberCode }}
              </span>
              <span v-if="user?.phone" class="meta-item">
                <q-icon name="call" />
                {{ user.phone }}
              </span>
            </div>
          </div>
        </div>

        <!-- Body sections -->
        <div class="profile-body">
          <section class="profile-section">
            <div class="section-head">
              <h2 class="section-title">ข้อมูลส่วนตัว</h2>
              <q-btn
                v-if="!isEditing"
                no-caps
                flat
                dense
                icon="edit"
                label="แก้ไข"
                class="edit-btn"
                @click="startEditing"
              />
            </div>

            <q-form class="form-grid" @submit.prevent>
              <div class="form-field">
                <div class="field-label">ชื่อ-นามสกุล</div>
                <q-input
                  v-if="isEditing"
                  v-model="editFullName"
                  outlined
                  dense
                  hide-bottom-space
                  :rules="[(val) => !!val?.trim() || 'กรุณากรอกชื่อ-นามสกุล']"
                />
                <div v-else class="field-value">{{ user?.fullName || '-' }}</div>
              </div>

              <div class="form-field">
                <div class="field-label">เบอร์โทรศัพท์</div>
                <q-input
                  v-if="isEditing"
                  v-model="editPhone"
                  outlined
                  dense
                  hide-bottom-space
                  :rules="[(val) => !val || val.length >= 6 || 'เบอร์โทรศัพท์ไม่ถูกต้อง']"
                />
                <div v-else class="field-value">{{ user?.phone || '-' }}</div>
              </div>

              <div class="form-field">
                <div class="field-label">ชื่อผู้ใช้ / เลขบัตรประชาชน</div>
                <div class="field-value is-readonly">{{ user?.username || '-' }}</div>
              </div>

              <div class="form-field">
                <div class="field-label">บทบาท</div>
                <div class="field-value is-readonly">{{ roleLabel }}</div>
              </div>
            </q-form>

            <div v-if="isEditing" class="section-actions">
              <q-btn no-caps flat label="ยกเลิก" :disable="isSaving" @click="cancelEditing" />
              <q-btn
                no-caps
                unelevated
                icon="save"
                label="บันทึก"
                class="save-btn"
                :loading="isSaving"
                @click="saveProfile"
              >
                <template #loading><q-spinner-dots size="1.2em" /></template>
              </q-btn>
            </div>
          </section>

          <q-separator v-if="member" class="section-divider" />

          <section v-if="member" class="profile-section">
            <div class="section-head">
              <h2 class="section-title">ข้อมูลสมาชิก</h2>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <div class="field-label">รหัสสมาชิก</div>
                <div class="field-value is-readonly">{{ member.memberCode }}</div>
              </div>

              <div class="form-field">
                <div class="field-label">สถานะสมาชิก</div>
                <q-badge :class="['status-badge', `status-${member.status}`]">
                  {{ memberStatusLabel }}
                </q-badge>
              </div>
            </div>
          </section>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from 'src/stores/authStore';
import { midNotify } from 'components/MID';

const authStore = useAuthStore();

const isLoadingProfile = ref(true);
const loadError = ref('');
const isEditing = ref(false);
const isSaving = ref(false);
const isUploadingAvatar = ref(false);

const editFullName = ref('');
const editPhone = ref('');

const fileInputRef = ref<HTMLInputElement | null>(null);

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const user = computed(() => authStore.user);
const member = computed(() => authStore.member);
const avatarUrl = computed(() => user.value?.avatarUrl ?? null);

const avatarLetter = computed(() => {
  const name = user.value?.fullName?.trim() || user.value?.username?.trim() || '';
  return name ? name.charAt(0).toUpperCase() : '?';
});

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  committee: 'กรรมการธนาคารขยะ',
  municipality: 'เจ้าหน้าที่เทศบาล',
  buyer: 'ผู้รับซื้อ',
  member: 'สมาชิก',
};
const roleLabel = computed(() => ROLE_LABELS[user.value?.roleName ?? ''] ?? user.value?.roleName ?? '-');

// Same statuses the backend can report (prisma Member.status) - 'suspended' was
// dropped there, so it is gone from here and from MEMBER_STATUS_LABELS in
// pages/municipality/format.ts too.
const MEMBER_STATUS_LABELS: Record<string, string> = {
  pending: 'รอตรวจสอบ/อนุมัติ',
  active: 'ใช้งาน',
  resigned: 'ลาออก',
  deceased: 'เสียชีวิต',
};
const memberStatusLabel = computed(
  () => MEMBER_STATUS_LABELS[member.value?.status ?? ''] ?? member.value?.status ?? '-',
);

async function loadProfile() {
  isLoadingProfile.value = true;
  loadError.value = '';
  try {
    await authStore.fetchProfile();
  } catch {
    loadError.value = 'โหลดข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  } finally {
    isLoadingProfile.value = false;
  }
}

onMounted(() => {
  void loadProfile();
});

function startEditing() {
  editFullName.value = user.value?.fullName ?? '';
  editPhone.value = user.value?.phone ?? '';
  isEditing.value = true;
}

function cancelEditing() {
  isEditing.value = false;
}

async function saveProfile() {
  if (!editFullName.value.trim()) {
    midNotify({ type: 'warning', message: 'กรุณากรอกชื่อ-นามสกุล' });
    return;
  }

  isSaving.value = true;
  try {
    await authStore.updateProfile({
      fullName: editFullName.value.trim(),
      phone: editPhone.value.trim(),
    });
    midNotify({ type: 'success', message: 'บันทึกข้อมูลโปรไฟล์เรียบร้อย' });
    isEditing.value = false;
  } catch {
    midNotify({ type: 'error', message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    isSaving.value = false;
  }
}

function triggerFilePicker() {
  fileInputRef.value?.click();
}

async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    midNotify({ type: 'warning', message: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น' });
    return;
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    midNotify({ type: 'warning', message: 'ขนาดไฟล์รูปภาพต้องไม่เกิน 2MB' });
    return;
  }

  isUploadingAvatar.value = true;
  try {
    await authStore.uploadAvatar(file);
    midNotify({ type: 'success', message: 'อัปโหลดรูปโปรไฟล์เรียบร้อย' });
  } catch {
    midNotify({ type: 'error', message: 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    isUploadingAvatar.value = false;
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  padding: 32px clamp(16px, 3vw, 40px) 48px;
  background: transparent;
}

/* Matches the app's existing dashboard-width convention (see
   user/DashboardPage.vue .member-home-shell) so this page fills the
   viewport like the rest of the app instead of floating as a narrow card. */
.profile-shell {
  width: min(1380px, 100%);
  margin: 0 auto;
}

.state-card {
  display: grid;
  place-items: center;
  gap: 12px;
  padding: 64px 24px;
  color: #5c7769;
  text-align: center;
  background: #ffffff;
  border: 1px solid #dfe9df;
  border-radius: 14px;
  box-shadow: 0 18px 44px rgba(31, 71, 45, 0.08);
}

.profile-error .q-icon {
  color: #b91c1c;
}

.profile-card {
  overflow: hidden;
  border: 1px solid rgba(8, 127, 73, 0.1);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 22px 52px rgba(20, 60, 40, 0.1);
}

/* --- Identity banner --- */
.profile-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 30px 32px;
  overflow: hidden;
  color: #ffffff;
  background:
    radial-gradient(circle at 12% -20%, rgba(255, 255, 255, 0.16), transparent 55%),
    radial-gradient(circle at 100% 120%, rgba(255, 255, 255, 0.12), transparent 50%),
    linear-gradient(135deg, #0c623a 0%, #159757 55%, #1cbf5c 100%);
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.profile-avatar-lg {
  overflow: hidden;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
  border: 3px solid rgba(255, 255, 255, 0.55);
  font-size: 36px;
  font-weight: 900;
}

.avatar-uploading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
}

.avatar-edit-btn {
  position: absolute;
  right: -4px;
  bottom: -4px;
  color: #087f49;
  background: #ffffff;
  border: 3px solid #0c623a;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
}

.hidden-file-input {
  display: none;
}

.banner-identity {
  min-width: 0;
  flex: 1;
}

.banner-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.profile-name {
  margin: 0;
  overflow: hidden;
  font-size: 22px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-badge {
  padding: 4px 11px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  font-weight: 800;
}

.banner-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 10px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 700;
}

.meta-item .q-icon {
  font-size: 16px;
  opacity: 0.85;
}

/* --- Body sections --- */
.profile-body {
  padding: 8px 32px 32px;
}

.profile-section {
  padding: 24px 0;
}

.section-divider {
  margin: 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.section-title {
  margin: 0;
  color: #17452e;
  font-size: 16px;
  font-weight: 900;
}

.edit-btn {
  color: #087f49;
  font-weight: 800;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px 24px;
}

@media (max-width: 599px) {
  .profile-banner {
    flex-direction: column;
    text-align: center;
    padding: 28px 20px;
  }

  .banner-name-row,
  .banner-meta {
    justify-content: center;
  }

  .profile-body {
    padding: 8px 18px 24px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-field {
  min-width: 0;
}

.field-label {
  margin-bottom: 6px;
  color: #17452e;
  font-size: 12px;
  font-weight: 800;
}

.field-value {
  min-height: 20px;
  color: #26352d;
  font-size: 15px;
  font-weight: 700;
  word-break: break-word;
}

.field-value.is-readonly {
  color: #5c7769;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 800;
}

.status-active {
  color: #087f49;
  background: #eef8ef;
}

.status-pending {
  color: #92650a;
  background: #fdf3d9;
}

.status-resigned,
.status-deceased {
  color: #b91c1c;
  background: #fdeaea;
}

.section-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.save-btn {
  min-height: 42px;
  padding: 0 20px;
  color: #ffffff;
  background: #087f49;
  border-radius: 10px;
  font-weight: 800;
  box-shadow: 0 10px 20px rgba(0, 102, 58, 0.16);
}
</style>
