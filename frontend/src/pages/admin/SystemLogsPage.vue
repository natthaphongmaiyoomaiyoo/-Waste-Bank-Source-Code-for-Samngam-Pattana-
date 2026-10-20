<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="security" />
          </div>
          <div class="hero-copy">
            <h1>บันทึกกิจกรรมระบบ</h1>
          </div>
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader title="บันทึกการใช้งานระบบ">
          <template #filters>
            <div class="filter-row">
              <MidFilterBar
                v-model:search="search"
                search-label="ค้นหาชื่อผู้ใช้ หรือรายละเอียด"
                :search-debounce="300"
                title="กรองบันทึกระบบ"
                :active="activeFilters"
                @clear="actionFilter = 'all'"
                @clear-all="actionFilter = 'all'"
              >
                <q-select
                  v-model="actionFilter"
                  dense
                  outlined
                  emit-value
                  map-options
                  label="ประเภทกิจกรรม"
                  :options="actionOptions"
                />
              </MidFilterBar>
            </div>
          </template>
        </AdminPanelHeader>

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :grid="$q.screen.lt.sm"
          v-model:pagination="pagination"
          :rows="store.logs"
          :columns="columns"
          :loading="store.loading"
          :rows-per-page-options="logRowsOptions"
          @request="onTableRequest"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <AdminGridCard
              :title="props.row.action"
              :subtitle="props.row.createdAt"
              :rows="[
                {
                  label: 'ผู้ใช้งาน',
                  value: `${props.row.user?.username || '-'} (${props.row.user?.role?.roleName || 'System'})`,
                },
                { label: 'โมดูล', value: props.row.module },
              ]"
            >
              <template #avatar>
                <div class="log-icon">
                  <q-icon
                    :name="getActionIcon(props.row.actionType)"
                    :color="getActionColor(props.row.actionType)"
                  />
                </div>
              </template>
            </AdminGridCard>
          </template>

          <template #body-cell-action="props">
            <q-td :props="props">
              <div class="row items-center">
                <q-icon :name="getActionIcon(props.row.actionType)" :color="getActionColor(props.row.actionType)" size="sm" class="q-mr-sm" />
                <span class="text-weight-medium">{{ props.row.action }}</span>
              </div>
            </q-td>
          </template>

          <template #body-cell-user="props">
            <q-td :props="props">
              <div class="text-weight-bold">{{ props.row.user?.username || '-' }}</div>
              <div class="text-caption text-grey-6">{{ props.row.user?.role?.roleName || 'System' }}</div>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useSystemLogStore } from 'src/stores/systemLogStore';
import type { SystemLog } from 'src/stores/systemLogStore';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';
import {
  MidFilterBar,
  midOptionLabel,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  midRowsPerPageOptions,
} from 'components/MID';

// 5/10/20/50 plus this table's own default of 15.
const logRowsOptions = midRowsPerPageOptions(15);

const store = useSystemLogStore();
const search = ref('');
const actionFilter = ref('all');

const actionOptions = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'เพิ่มข้อมูล', value: 'create' },
  { value: 'update', label: 'แก้ไขข้อมูล' },
  { value: 'delete', label: 'ลบข้อมูล' },
  { value: 'status_change', label: 'เปลี่ยนสถานะ' },
  { value: 'transaction', label: 'ธุรกรรม/การเงิน' },
  { value: 'system', label: 'ระบบ' },
  { value: 'login', label: 'เข้าสู่ระบบ' },
];

// 'ทั้งหมด' is the page's starting point, so only another type counts as a filter.
const activeFilters = computed<MidActiveFilter[]>(() =>
  actionFilter.value !== 'all'
    ? [{ key: 'action', label: 'ประเภทกิจกรรม', value: midOptionLabel(actionOptions, actionFilter.value) }]
    : [],
);

// Newest first until the timestamp column is sorted the other way.
const pagination = useRememberedPagination('admin-system-logs', {
  page: 1,
  rowsPerPage: 15,
  rowsNumber: 0,
  sortBy: 'timestamp' as string | null,
  descending: true,
});

async function loadLogs() {
  const { page, rowsPerPage, sortBy, descending } = pagination.value;
  try {
    const data = await store.fetchLogsPage({
      page,
      pageSize: rowsPerPage,
      search: search.value?.trim() || undefined,
      actionType: actionFilter.value !== 'all' ? actionFilter.value : undefined,
      descending: sortBy ? descending : undefined,
    });
    pagination.value.rowsNumber = data.total;
  } catch {
    // store.error holds the message; the table just stays as it was.
  }
}

function onTableRequest(props: {
  pagination: { page: number; rowsPerPage: number; sortBy: string | null; descending: boolean };
}) {
  Object.assign(pagination.value, props.pagination);
  void loadLogs();
}

// A new filter or search changes what the pages hold - back to page 1.
watch([search, actionFilter], () => {
  pagination.value.page = 1;
  void loadLogs();
});

onMounted(() => {
  void loadLogs();
});

const columns = [
  { name: 'timestamp', label: 'วัน-เวลา', field: 'createdAt', align: 'left' as const, sortable: true },
  { name: 'user', label: 'ผู้ใช้งาน', field: (row: SystemLog) => row.user?.username || '-', align: 'left' as const },
  { name: 'module', label: 'โมดูล', field: 'module', align: 'left' as const },
  { name: 'action', label: 'กิจกรรม', field: 'action', align: 'left' as const },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'left' as const },
];

const getActionIcon = (type: string) => {
  const t = type.toLowerCase();
  switch (t) {
    case 'login':
      return 'login';
    case 'create':
      return 'add_circle';
    case 'update':
      return 'edit_document';
    case 'delete':
      return 'delete_forever';
    case 'status_change':
      return 'swap_horiz';
    case 'transaction':
      return 'payments';
    case 'system':
      return 'settings';
    default:
      return 'info';
  }
};

const getActionColor = (type: string) => {
  const t = type.toLowerCase();
  switch (t) {
    case 'login':
      return 'blue-7';
    case 'create':
      return 'green-7';
    case 'update':
      return 'orange-8';
    case 'delete':
      return 'negative';
    case 'status_change':
      return 'purple-7';
    case 'transaction':
      return 'positive';
    case 'system':
      return 'grey-8';
    default:
      return 'grey-7';
  }
};

</script>

<style lang="scss" scoped>
@use './theme' as *;

.log-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  background: #f3f7f4;
  border-radius: 12px;
  font-size: 20px;
}
</style>
