<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="admin_panel_settings" />
          </div>
          <div class="hero-copy">
            <h1>จัดการบทบาทผู้ใช้งาน</h1>
          </div>
          <q-btn unelevated no-caps icon="add" label="เพิ่มบทบาทใหม่" class="hero-add-btn" @click="openAddDialog" />
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="บทบาท/สิทธิ์การใช้งานในระบบ"
          :caption="`ทั้งหมด ${roles.length} รายการ`"
        />

        <q-table flat row-key="id" class="muni-table" :grid="$q.screen.lt.sm" :rows="roles" :columns="columns" v-model:pagination="rolePagination" :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          :loading="store.loading">
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>

          <template #item="props">
            <AdminGridCard
              :title="props.row.roleName"
              :subtitle="props.row.description || '-'"
            >
              <template #actions>
                <q-btn
                  unelevated
                  no-caps
                  icon="edit"
                  label="แก้ไข"
                  class="is-edit"
                  @click="openEditDialog(props.row)"
                />
                <q-btn
                  unelevated
                  no-caps
                  icon="delete"
                  label="ลบ"
                  class="is-cancel"
                  @click="deleteRole(props.row)"
                />
              </template>
            </AdminGridCard>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" align="right">
              <div class="action-btns" style="justify-content: flex-end;">
                <q-btn flat dense round size="sm" icon="edit" color="primary" @click="openEditDialog(props.row)">
                  <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                </q-btn>
                <q-btn flat dense round size="sm" icon="delete" color="negative" @click="deleteRole(props.row)">
                  <q-tooltip>ลบข้อมูล</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Dialog -->
    <q-dialog v-model="showDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEdit ? 'edit' : 'add'" />
            </div>
            {{ isEdit ? 'แก้ไขบทบาทผู้ใช้' : 'เพิ่มบทบาทใหม่' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <q-input
              v-model="form.roleName"
              outlined
              dense
              class="span-12"
              label="ชื่อบทบาท (Role Name - ภาษาอังกฤษ) *"
              placeholder="เช่น officer, inspector"
            />
            <q-input
              v-model="form.description"
              outlined
              dense
              type="textarea"
              rows="3"
              autogrow
              class="span-12"
              label="คำอธิบาย/รายละเอียดสิทธิ์"
            />
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn unelevated no-caps label="บันทึกข้อมูล" color="positive" icon="save" @click="saveRole" />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useAdminMasterDataStore } from 'src/stores/adminMasterDataStore';
import type { RoleMaster } from 'src/stores/adminMasterDataStore';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';
import {
  MidTablePagination,
  midConfirm,
  midNotify,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const rolePagination = useRememberedPagination('admin-member-types', { rowsPerPage: 10 });

const $q = useQuasar();
const store = useAdminMasterDataStore();

onMounted(() => {
  void store.fetchRoles();
});

const roles = computed(() => store.roles);

const columns = [
  { name: 'roleName', label: 'ชื่อบทบาท (Role Name)', field: 'roleName', align: 'left' as const, sortable: true },
  { name: 'description', label: 'คำอธิบาย/รายละเอียดสิทธิ์', field: (row: RoleMaster) => row.description || '-', align: 'left' as const },
  { name: 'actions', label: 'จัดการ', field: 'actions', align: 'right' as const },
];

const showDialog = ref(false);
const isEdit = ref(false);
const form = ref({
  id: 0,
  roleName: '',
  description: ''
});

const openAddDialog = () => {
  isEdit.value = false;
  form.value = { id: 0, roleName: '', description: '' };
  showDialog.value = true;
};

// const fillMockData = () => {
//   form.value.roleName = 'guest_user';
//   form.value.description = 'ผู้ใช้งานทั่วไป (ทดสอบ)';
// };

const openEditDialog = (role: RoleMaster) => {
  isEdit.value = true;
  form.value = {
    id: role.id,
    roleName: role.roleName,
    description: role.description || ''
  };
  showDialog.value = true;
};

const saveRole = async () => {
  try {
    const payload: { roleName: string; description?: string; id?: number } = {
      roleName: form.value.roleName,
      description: form.value.description,
    };
    if (isEdit.value) payload.id = form.value.id;
    await store.saveRole(payload);
    showDialog.value = false;
    midNotify({ type: 'success', message: isEdit.value ? 'อัปเดตข้อมูลสำเร็จ' : 'เพิ่มบทบาทใหม่สำเร็จ' });
  } catch (err: unknown) {
    const msg = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.error || 'เกิดข้อผิดพลาด';
    midNotify({ type: 'error', message: msg });
  }
};

const deleteRole = async (role: RoleMaster) => {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: `คุณต้องการลบบทบาท "${role.roleName}" ใช่หรือไม่?`,
    tone: 'danger',
    confirmLabel: 'ลบบทบาท'
  });
  if (!confirmed) return;
  try {
    await store.deleteRole(role.id);
    midNotify({ type: 'success', message: 'ลบบทบาทสำเร็จ' });
  } catch (err: unknown) {
    const msg = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.error || 'ไม่สามารถลบได้ (อาจมีผู้ใช้อยู่ในสิทธิ์นี้)';
    midNotify({ type: 'error', message: msg });
  }
};
</script>

<style lang="scss" scoped>
@use './theme' as *;
</style>
