<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="manage_accounts" />
          </div>
          <div class="hero-copy">
            <h1>จัดการผู้ใช้งานระบบ</h1>
          </div>
          <q-btn unelevated no-caps icon="person_add" label="เพิ่มผู้ใช้งาน" class="hero-add-btn"
            to="/admin/users/new" />
        </div>
      </section>

      <section class="summary-grid">
        <article v-for="card in summaryCards" :key="card.label" class="summary-card">
          <div :class="['summary-icon', card.iconClass]">
            <q-icon :name="card.icon" />
          </div>
          <div class="summary-content">
            <div class="summary-label">{{ card.label }}</div>
            <div class="summary-value">
              <q-skeleton v-if="store.loading" type="text" width="70px" />
              <template v-else>
                {{ card.value }}
                <span>คน</span>
              </template>
            </div>
          </div>
        </article>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายชื่อผู้ใช้งานระบบ"
        >
          <template #filters>
            <div class="filter-row">
              <MidFilterBar
                v-model:search="search"
                search-label="ค้นหาชื่อผู้ใช้ / อีเมล / เบอร์โทร"
                :search-debounce="300"
                title="กรองผู้ใช้งาน"
                :active="activeFilters"
                @clear="clearFilter"
                @clear-all="clearAllFilters"
              >
                <q-select v-model="roleFilter" dense outlined clearable emit-value map-options
                  label="สิทธิ์การใช้งาน" :options="roleFilterOptions" />
                <q-select v-model="statusFilter" dense outlined clearable emit-value map-options
                  label="สถานะ" :options="statusOptions" />
              </MidFilterBar>
            </div>
          </template>
        </AdminPanelHeader>

        <q-table v-model:pagination="pagination" flat row-key="id" class="muni-table" :grid="$q.screen.lt.sm" :rows="store.users" :columns="columns" :loading="store.loading"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS" @request="onTableRequest">
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>


          <template #body-cell-status="props">
            <q-td :props="props" align="center">
              <q-badge :color="props.row.status === 'active' ? 'green-2' : 'red-2'"
                :text-color="props.row.status === 'active' ? 'green-9' : 'red-9'" class="q-px-sm q-py-xs" rounded>
                {{ props.row.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ' }}
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" align="right">
              <div class="action-btns" style="justify-content: flex-end;">
                <q-btn flat dense round size="sm" icon="edit" color="primary" @click="openEditDialog(props.row)">
                  <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                </q-btn>
                <q-btn v-if="props.row.status === 'active'" flat dense round size="sm" icon="pause_circle"
                  color="amber-9" @click="toggleStatus(props.row)">
                  <q-tooltip>พักสถานะ</q-tooltip>
                </q-btn>
                <q-btn v-if="props.row.status === 'inactive'" flat dense round size="sm" icon="play_circle"
                  color="positive" @click="toggleStatus(props.row)">
                  <q-tooltip>เปิดใช้งาน</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #item="props">
            <AdminGridCard
              :title="props.row.fullName"
              :subtitle="props.row.username"
              :badge-text="props.row.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ'"
              :badge-color="props.row.status === 'active' ? 'green-2' : 'red-2'"
              :badge-text-color="props.row.status === 'active' ? 'green-9' : 'red-9'"
              :rows="[
                { label: 'สิทธิ์การใช้งาน', value: getRoleLabel(props.row.role.id) },
                { label: 'เข้าสู่ระบบล่าสุด', value: formatDate(props.row.lastLogin) },
              ]"
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
                  v-if="props.row.status === 'active'"
                  unelevated
                  no-caps
                  icon="pause_circle"
                  label="พักสถานะ"
                  class="is-warning"
                  @click="toggleStatus(props.row)"
                />
                <q-btn
                  v-if="props.row.status === 'inactive'"
                  unelevated
                  no-caps
                  icon="play_circle"
                  label="เปิดใช้งาน"
                  class="is-approve"
                  @click="toggleStatus(props.row)"
                />
              </template>
            </AdminGridCard>
          </template>
        </q-table>
      </q-card>
    </div>

    <q-dialog v-model="showDialog" persistent>
      <q-card class="admin-dialog dialog-lg">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon name="manage_accounts" />
            </div>
            แก้ไขข้อมูลบัญชีผู้ใช้งาน
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <q-form greedy @submit.prevent="saveUser">
          <div class="dialog-body">
            <div class="form-grid">
              <q-input
                v-model="form.username"
                outlined
                dense
                class="span-6"
                label="ชื่อผู้ใช้งาน (Username) *"
                disable
              >
                <template #prepend><q-icon name="person" /></template>
              </q-input>
              <q-input
                v-if="isEditMember && form.memberCode"
                v-model="form.memberCode"
                outlined
                dense
                class="span-6"
                label="รหัสสมาชิก (Member Code)"
                disable
              >
                <template #prepend><q-icon name="badge" /></template>
              </q-input>
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
                :disable="isEditCommittee"
              >
                <template #prepend><q-icon name="admin_panel_settings" /></template>
              </q-select>
              <q-select
                v-model="form.prefix"
                outlined
                dense
                clearable
                class="span-3"
                label="คำนำหน้า"
                :options="prefixOptions"
              />
              <q-input
                v-model="form.firstName"
                outlined
                dense
                class="span-4"
                label="ชื่อ *"
                :rules="[(v) => !!v || 'กรุณากรอกชื่อ']"
              />
              <q-input
                v-model="form.lastName"
                outlined
                dense
                class="span-5"
                label="นามสกุล *"
                :rules="[(v) => !!v || 'กรุณากรอกนามสกุล']"
              />
              <q-input v-model="form.phone" outlined dense class="span-6" label="เบอร์โทรศัพท์ *">
                <template #prepend><q-icon name="call" /></template>
              </q-input>
              <q-input
                v-model="form.password"
                outlined
                dense
                class="span-12"
                :type="showPassword ? 'text' : 'password'"
                label="ตั้งรหัสผ่านใหม่ (ไม่บังคับ อย่างน้อย 8 ตัวอักษร)"
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
            </div>
          </div>

          <div class="dialog-footer">
            <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
            <q-btn
              unelevated
              no-caps
              type="submit"
              color="positive"
              icon="save"
              label="บันทึกการแก้ไข"
              :loading="store.loading"
            />
          </div>
        </q-form>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';
import { useUserManagementStore, type SystemUser } from 'src/stores/userManagementStore';
import { useAdminMasterDataStore } from 'src/stores/adminMasterDataStore';
import {
  MidFilterBar,
  midOptionLabel,
  midNotify,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const $q = useQuasar();
const store = useUserManagementStore();
const masterStore = useAdminMasterDataStore();
const search = ref('');

// Paged and filtered on the server; the cards count every account.
const pagination = useRememberedPagination('admin-users', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
});

async function loadUsers() {
  try {
    const data = await store.fetchUsersPage({
      page: pagination.value.page,
      pageSize: pagination.value.rowsPerPage,
      search: search.value.trim() || undefined,
      roleId: roleFilter.value ?? undefined,
      status: statusFilter.value ?? undefined,
    });
    pagination.value.rowsNumber = data.total;
  } catch {
    midNotify({ type: 'error', message: 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ' });
  }
}

function onTableRequest(props: { pagination: { page: number; rowsPerPage: number } }) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  void loadUsers();
}

onMounted(() => {
  void loadUsers();
  void masterStore.fetchRoles();
});

const roleFilter = ref<number | null>(null);
const statusFilter = ref<string | null>(null);

const statusOptions = [
  { label: 'เปิดใช้งาน', value: 'active' },
  { label: 'ระงับการใช้งาน', value: 'inactive' }
];

// A new filter or search changes what the pages hold - back to page 1.
watch([search, roleFilter, statusFilter], () => {
  pagination.value.page = 1;
  void loadUsers();
});

const summaryCards = computed(() => {
  const { total, active, inactive: suspended } = store.summary;

  return [
    { label: 'ผู้ใช้งานทั้งหมด', value: total, icon: 'people', iconClass: 'icon-blue' },
    { label: 'สถานะใช้งาน', value: active, icon: 'how_to_reg', iconClass: 'icon-green' },
    { label: 'พักสถานะ', value: suspended, icon: 'pause_circle', iconClass: 'icon-red' },
  ];
});

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const columns = [
  { name: 'username', label: 'ชื่อผู้ใช้', field: 'username', align: 'left' as const, sortable: true },
  { name: 'fullName', label: 'ชื่อ-นามสกุล', field: 'fullName', align: 'left' as const, sortable: true },
  { name: 'role', label: 'สิทธิ์การใช้งาน', field: (row: SystemUser) => getRoleLabel(row.role.id), align: 'left' as const, sortable: true },
  { name: 'lastLogin', label: 'เข้าสู่ระบบล่าสุด', field: (row: SystemUser) => formatDate(row.lastLogin), align: 'left' as const },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'left' as const },
  { name: 'actions', label: 'จัดการ', field: 'actions', align: 'right' as const },
];

const roleNameMap: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  committee: 'กรรมการ',
  municipality: 'เจ้าหน้าที่เทศบาล',
  buyer: 'ผู้รับซื้อ',
  member: 'สมาชิก',
};


const getRoleLabel = (roleId: number) => {
  const role = masterStore.roles.find(r => r.id === roleId);
  if (role) {
    return roleNameMap[role.roleName] || role.roleName;
  }
  return `Role ${roleId}`;
};


const roleFilterOptions = computed(() => {
  const options = masterStore.roles.map(r => ({
    label: `${roleNameMap[r.roleName] || r.roleName} (${r.roleName})`,
    value: r.id,
  }));
  return [{ label: 'ทั้งหมด', value: null }, ...options];
});

const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (roleFilter.value) {
    items.push({
      key: 'role',
      label: 'สิทธิ์การใช้งาน',
      value: midOptionLabel(roleFilterOptions.value, roleFilter.value),
    });
  }
  if (statusFilter.value) {
    items.push({ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, statusFilter.value) });
  }
  return items;
});

function clearFilter(key: string) {
  if (key === 'role') roleFilter.value = null;
  if (key === 'status') statusFilter.value = null;
}

function clearAllFilters() {
  roleFilter.value = null;
  statusFilter.value = null;
}

const isEditMember = computed(() => {
  const role = masterStore.roles.find(r => r.id === form.value.roleId);
  return role?.roleName === 'member';
});

const isEditCommittee = computed(() => {
  const role = masterStore.roles.find(r => r.id === form.value.roleId);
  return role?.roleName === 'committee';
});

const formRoleOptions = computed(() => {
  const currentRole = masterStore.roles.find(r => r.id === form.value.roleId);
  if (currentRole && (currentRole.roleName === 'committee' || currentRole.roleName === 'member')) {
    return [{
      label: `${roleNameMap[currentRole.roleName] || currentRole.roleName} (${currentRole.roleName})`,
      value: currentRole.id
    }];
  }
  return masterStore.roles
    .filter(r => !['committee', 'member'].includes(r.roleName))
    .map(r => ({
      label: `${roleNameMap[r.roleName] || r.roleName} (${r.roleName})`,
      value: r.id,
    }));
});

const showDialog = ref(false);
const showPassword = ref(false);
const prefixOptions = ['นาย', 'นาง', 'นางสาว'];
const form = ref({
  id: 0,
  username: '',
  prefix: null as string | null,
  firstName: '',
  lastName: '',
  phone: '',
  roleId: 2,
  password: '',
  memberCode: ''
});

const openEditDialog = (user: SystemUser) => {
  let prefix: string | null = null;
  let firstName = user.fullName;
  let lastName = '';
  const parts = user.fullName.split(' ');
  if (parts.length >= 3 && prefixOptions.includes(parts[0] || '')) {
    prefix = parts[0] || null;
    firstName = parts[1] || '';
    lastName = parts.slice(2).join(' ');
  } else if (parts.length >= 2) {
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }

  form.value = {
    id: user.id,
    username: user.username,
    prefix,
    firstName,
    lastName,
    phone: user.phone || '',
    roleId: user.role.id,
    password: '',
    memberCode: user.member?.memberCode || ''
  };
  showDialog.value = true;
};

const saveUser = async () => {
  try {
    const combinedFullName = `${form.value.prefix ?? ''} ${form.value.firstName} ${form.value.lastName}`.trim();
    const payload: { fullName?: string; phone?: string; roleId?: number; password?: string } = {
      fullName: combinedFullName,
      phone: form.value.phone,
      roleId: form.value.roleId
    };
    if (form.value.password) {
      payload.password = form.value.password;
    }
    await store.updateUser(form.value.id, payload);
    showDialog.value = false;
    midNotify({
      type: 'success',
      message: 'อัปเดตข้อมูลผู้ใช้งานแล้ว'
    });
  } catch (e: unknown) {
    const data = (e as Record<string, Record<string, Record<string, string>>>)?.response?.data;
    const msg = data?.error || data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    midNotify({
      type: 'error',
      message: msg
    });
  }
};


const toggleStatus = async (user: SystemUser) => {
  try {
    const updated = await store.toggleStatus(user.id);
    // The row is already patched in place; the cards need the new counts.
    void loadUsers();
    midNotify({
      type: updated.status === 'active' ? 'success' : 'warning',
      message: updated.status === 'active' ? `เปิดใช้งานบัญชี ${user.username} แล้ว` : `ระงับบัญชี ${user.username} ชั่วคราว`
    });
  } catch (e: unknown) {
    const msg = (e as Record<string, Record<string, Record<string, string>>>)?.response?.data?.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ';
    midNotify({
      type: 'error',
      message: msg
    });
  }
};


</script>

<style lang="scss" scoped>
@use './theme' as *;
</style>
