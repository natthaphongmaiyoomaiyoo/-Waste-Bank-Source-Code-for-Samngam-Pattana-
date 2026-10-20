<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="groups" />
          </div>
          <div class="hero-copy">
            <h1>กรรมการหมู่บ้าน</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="person_add"
            label="เพิ่มกรรมการ"
            class="hero-add-btn"
            to="/admin/committees/new"
          />
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
              <q-skeleton v-if="!store.summary" type="text" width="60px" />
              <template v-else>
                {{ card.value }}
                <span>{{ card.unit }}</span>
              </template>
            </div>
          </div>
        </article>
      </section>

      <q-banner v-if="villagesWithoutCommittee > 0" rounded class="notice-banner q-mt-md">
        <template #avatar><q-icon name="info" color="amber-9" /></template>
        ยังมี {{ villagesWithoutCommittee }} หมู่บ้านที่ยังไม่มีกรรมการรับผิดชอบ
        <template #action>
          <q-btn flat no-caps color="amber-9" label="เพิ่มกรรมการ" to="/admin/committees/new" />
        </template>
      </q-banner>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายชื่อกรรมการหมู่บ้าน"
          :caption="`ทั้งหมด ${filteredRows.length.toLocaleString()} รายการ`"
        >
          <template #filters>
            <div class="filter-row">
              <MidFilterBar
                v-model:search="search"
                search-label="ค้นหาชื่อผู้ใช้ / ชื่อ-นามสกุล / เบอร์โทร"
                title="กรองกรรมการหมู่บ้าน"
                :active="activeFilters"
                @clear="clearFilter"
                @clear-all="clearAllFilters"
              >
                <q-select
                  v-model="villageFilter"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="หมู่บ้าน"
                  :loading="villageAreaStore.loading"
                  :options="villageOptions"
                />
                <q-select
                  v-model="statusFilter"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="สถานะ"
                  :options="statusOptions"
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
          :rows="filteredRows"
          :columns="columns"
          :loading="store.loading"
          v-model:pagination="committeePagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <AdminGridCard
              :title="props.row.fullName"
              :subtitle="props.row.username"
              :badge-text="props.row.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ'"
              :badge-color="props.row.status === 'active' ? 'green-2' : 'red-2'"
              :badge-text-color="props.row.status === 'active' ? 'green-9' : 'red-9'"
              :rows="[
                { label: 'เบอร์โทร', value: props.row.phone || '-' },
                { label: 'เข้าสู่ระบบล่าสุด', value: formatDate(props.row.lastLogin) },
              ]"
            >
              <template #rows>
                <div>
                  <dt>หมู่บ้านที่รับผิดชอบ</dt>
                  <dd>
                    <q-badge v-if="props.row.villageArea" class="moo-badge">
                      หมู่ {{ props.row.villageArea.moo ?? '-' }} {{ props.row.villageArea.villageName }}
                    </q-badge>
                    <q-badge v-else color="red-2" text-color="red-9" rounded class="q-px-sm q-py-xs">
                      ยังไม่ผูกหมู่บ้าน
                    </q-badge>
                  </dd>
                </div>
              </template>
              <template #actions>
                <q-btn
                  unelevated
                  no-caps
                  icon="edit"
                  label="แก้ไข"
                  class="is-edit"
                  :to="`/admin/committees/${props.row.id}/edit`"
                />
                <q-btn
                  v-if="props.row.status === 'active'"
                  unelevated
                  no-caps
                  icon="pause_circle"
                  label="ระงับการใช้งาน"
                  class="is-warning"
                  @click="toggleStatus(props.row)"
                />
                <q-btn
                  v-else
                  unelevated
                  no-caps
                  icon="play_circle"
                  label="เปิดใช้งาน"
                  class="is-approve"
                  @click="toggleStatus(props.row)"
                />
                <q-btn
                  unelevated
                  no-caps
                  icon="delete"
                  label="ลบกรรมการ"
                  class="is-cancel"
                  @click="askDelete(props.row)"
                />
              </template>
            </AdminGridCard>
          </template>

          <template #body-cell-village="props">
            <q-td :props="props">
              <div v-if="props.row.villageArea" class="village-cell">
                <q-badge class="moo-badge">หมู่ {{ props.row.villageArea.moo ?? '-' }}</q-badge>
                <div class="village-text">
                  <div class="village-name">{{ props.row.villageArea.villageName }}</div>
                  <div class="village-sub">{{ villageSubtitle(props.row.villageArea) }}</div>
                </div>
              </div>
              <q-badge v-else color="red-2" text-color="red-9" rounded class="q-px-sm q-py-xs">
                ยังไม่ผูกหมู่บ้าน
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props" align="center">
              <q-badge
                :color="props.row.status === 'active' ? 'green-2' : 'red-2'"
                :text-color="props.row.status === 'active' ? 'green-9' : 'red-9'"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ props.row.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ' }}
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" align="right">
              <div class="action-btns" style="justify-content: flex-end">
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="edit"
                  color="primary"
                  :to="`/admin/committees/${props.row.id}/edit`"
                >
                  <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="props.row.status === 'active'"
                  flat
                  dense
                  round
                  size="sm"
                  icon="pause_circle"
                  color="amber-9"
                  @click="toggleStatus(props.row)"
                >
                  <q-tooltip>ระงับการใช้งาน</q-tooltip>
                </q-btn>
                <q-btn
                  v-else
                  flat
                  dense
                  round
                  size="sm"
                  icon="play_circle"
                  color="positive"
                  @click="toggleStatus(props.row)"
                >
                  <q-tooltip>เปิดใช้งาน</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="delete"
                  color="red-7"
                  @click="askDelete(props.row)"
                >
                  <q-tooltip>ลบกรรมการ</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="empty-state">
              <q-icon name="groups" size="34px" />
              <div>ยังไม่มีกรรมการหมู่บ้านในระบบ</div>
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Delete confirm -->
    <q-dialog v-model="showDeleteDialog">
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon danger-icon"><q-icon name="delete" /></div>
            ลบกรรมการหมู่บ้าน
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>
        <div class="dialog-body">
          ต้องการลบบัญชีกรรมการนี้ออกจากระบบหรือไม่?
          <!-- Who is being removed, set apart on its own. -->
          <div v-if="deleteTarget" class="delete-target">
            <div class="delete-target-name">{{ deleteTarget.fullName }}</div>
            <div class="delete-target-detail">ชื่อผู้ใช้ {{ deleteTarget.username }}</div>
            <div v-if="deleteTarget.villageArea" class="delete-target-detail">
              {{ deleteTarget.villageArea.villageName }}
              <template v-if="deleteTarget.villageArea.moo">
                (หมู่ {{ deleteTarget.villageArea.moo }})
              </template>
              {{ villageSubtitle(deleteTarget.villageArea) }}
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            icon="delete"
            label="ลบกรรมการ"
            :loading="deleting"
            @click="confirmDelete"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import {
  useAdminCommitteeStore,
  type CommitteeAccount,
  type CommitteeVillage,
} from 'src/stores/adminCommitteeStore';
import { useVillageAreaStore } from 'src/stores/villageAreaStore';
import {
  MidFilterBar,
  midOptionLabel,
  midNotify,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';
import { apiErrorMessage } from 'src/utils/apiError';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';

const committeePagination = useRememberedPagination('admin-committees', { rowsPerPage: 10 });

const $q = useQuasar();
const store = useAdminCommitteeStore();
const villageAreaStore = useVillageAreaStore();

const search = ref('');
const villageFilter = ref<number | null>(null);
const statusFilter = ref<string | null>(null);

const showDeleteDialog = ref(false);
const deleting = ref(false);
const deleteTarget = ref<CommitteeAccount | null>(null);

const statusOptions = [
  { label: 'เปิดใช้งาน', value: 'active' },
  { label: 'ระงับการใช้งาน', value: 'inactive' },
];

// Filter options come from the master data the admin maintains first (/village).
const villageOptions = computed(() =>
  villageAreaStore.items.map((village) => ({
    label: `หมู่ ${village.moo ?? '-'} - ${village.villageName}`,
    value: village.id,
  })),
);

const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (villageFilter.value) {
    items.push({ key: 'village', label: 'หมู่บ้าน', value: midOptionLabel(villageOptions.value, villageFilter.value) });
  }
  if (statusFilter.value) {
    items.push({ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, statusFilter.value) });
  }
  return items;
});

function clearFilter(key: string) {
  if (key === 'village') villageFilter.value = null;
  if (key === 'status') statusFilter.value = null;
}

function clearAllFilters() {
  villageFilter.value = null;
  statusFilter.value = null;
}

const villagesWithoutCommittee = computed(() => store.summary?.villagesWithoutCommittee ?? 0);

const summaryCards = computed(() => [
  {
    label: 'กรรมการทั้งหมด',
    value: store.summary?.total ?? 0,
    unit: 'คน',
    icon: 'groups',
    iconClass: 'icon-blue',
  },
  {
    label: 'เปิดใช้งาน',
    value: store.summary?.active ?? 0,
    unit: 'คน',
    icon: 'how_to_reg',
    iconClass: 'icon-green',
  },
  {
    label: 'ระงับการใช้งาน',
    value: store.summary?.suspended ?? 0,
    unit: 'คน',
    icon: 'pause_circle',
    iconClass: 'icon-red',
  },
  {
    label: 'หมู่บ้านที่มีกรรมการ',
    value: `${store.summary?.villagesWithCommittee ?? 0}/${store.summary?.totalVillages ?? 0}`,
    unit: 'หมู่บ้าน',
    icon: 'holiday_village',
    iconClass: 'icon-amber',
  },
]);

function formatDate(value: string | null) {
  if (!value) return 'ยังไม่เคยเข้าใช้งาน';
  return new Date(value).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function villageSubtitle(village: CommitteeVillage) {
  return [village.subdistrict ? `ต.${village.subdistrict}` : null, village.district ? `อ.${village.district}` : null]
    .filter(Boolean)
    .join(' ');
}

const columns: QTableColumn<CommitteeAccount>[] = [
  { name: 'username', label: 'ชื่อผู้ใช้', field: 'username', align: 'left', sortable: true },
  { name: 'fullName', label: 'ชื่อ-นามสกุล', field: 'fullName', align: 'left', sortable: true },
  {
    name: 'village',
    label: 'หมู่บ้านที่รับผิดชอบ',
    field: (row) => row.villageArea?.villageName ?? '',
    align: 'left',
    sortable: true,
  },
  { name: 'phone', label: 'เบอร์โทร', field: (row) => row.phone || '-', align: 'left' },
  {
    name: 'lastLogin',
    label: 'เข้าสู่ระบบล่าสุด',
    field: (row) => formatDate(row.lastLogin),
    align: 'left',
  },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'center' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

// Client-side filtering keeps the table responsive; the list itself is small
// (one committee per village).
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return store.items.filter((row) => {
    if (villageFilter.value && row.villageArea?.id !== villageFilter.value) return false;
    if (statusFilter.value && row.status !== statusFilter.value) return false;
    if (!keyword) return true;
    return [row.username, row.fullName, row.phone ?? '', row.villageArea?.villageName ?? '']
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
});

function notifyError(error: unknown, fallback: string) {
  midNotify({ type: 'error', message: apiErrorMessage(error, fallback) });
}

async function reload() {
  await Promise.all([
    store.fetchCommittees(),
    store.fetchSummary(),
  ]).catch((error) => notifyError(error, 'โหลดข้อมูลกรรมการไม่สำเร็จ'));
}

onMounted(() => {
  void reload();
  void villageAreaStore.fetchActive().catch(() => {
    midNotify({ type: 'error', message: 'โหลดรายชื่อหมู่บ้านไม่สำเร็จ' });
  });
});

async function toggleStatus(row: CommitteeAccount) {
  try {
    const updated = await store.toggleStatus(row.id);
    await reload();
    midNotify({
      type: updated.status === 'active' ? 'success' : 'warning',
      message:
        updated.status === 'active'
          ? `เปิดใช้งานบัญชี ${row.username} แล้ว`
          : `ระงับบัญชี ${row.username} แล้ว`,
    });
  } catch (error) {
    notifyError(error, 'เปลี่ยนสถานะไม่สำเร็จ');
  }
}

function askDelete(row: CommitteeAccount) {
  deleteTarget.value = row;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;

  deleting.value = true;
  try {
    await store.deleteCommittee(deleteTarget.value.id);
    showDeleteDialog.value = false;
    await reload();
    midNotify({ type: 'success', message: 'ลบกรรมการแล้ว' });
  } catch (error) {
    notifyError(error, 'ลบกรรมการไม่สำเร็จ');
  } finally {
    deleting.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

// Delete confirm: the committee member on their own, under the question.
.delete-target {
  display: grid;
  gap: 2px;
  margin-top: 12px;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f8fafc;
}

.delete-target-name {
  color: #111827;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.delete-target-detail {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

.village-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.village-name {
  color: #0e2d1e;
  font-weight: 700;
}

.village-sub {
  color: #6b7c72;
  font-size: 12.5px;
}

.notice-banner {
  background: #fff8e6;
  color: #8a5a00;
  border: 1px solid #f5e0b0;
}
</style>
