<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="event_available" />
          </div>
          <div class="hero-copy">
            <h1>รอบรับซื้อขยะ</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เพิ่มรอบรับซื้อ"
            class="hero-add-btn"
            @click="openAdd"
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
                <span>รอบ</span>
              </template>
            </div>
          </div>
        </article>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="ตารางรอบรับซื้อ"
          :caption="`ทั้งหมด ${(store.summary?.total ?? 0).toLocaleString()} รอบ${search.trim() ? ' · พบ ' + store.pageTotal.toLocaleString() + ' รอบ' : ''}`"
        >
          <template #filters>
            <div class="filter-row">
              <MidFilterBar
                v-model:search="search"
                search-label="ค้นหา (วันที่ / ผู้รับซื้อ / จุดนัดหมาย)"
                :search-debounce="300"
                title="กรองรอบรับซื้อ"
                :active="activeFilters"
                @clear="clearFilter"
                @clear-all="clearAllFilters"
              >
                <q-select
                  v-model="statusFilter"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="สถานะ"
                  :options="statusOptions"
                  @update:model-value="restart"
                />
                <q-select
                  v-model="scopeFilter"
                  dense
                  outlined
                  emit-value
                  map-options
                  label="ช่วงเวลา"
                  :options="scopeOptions"
                  @update:model-value="restart"
                />
                <template #actions>
                  <q-select
                    v-model="selectedVillageAreaId"
                    dense
                    outlined
                    clearable
                    emit-value
                    map-options
                    class="filter-select"
                    label="เลือกหมู่บ้าน"
                    :options="villageOptions"
                  />
                </template>
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
          :rows="store.items"
          :columns="columns"
          :loading="store.loading"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #body-cell-date="props">
            <q-td :props="props">
              <div class="round-date">{{ formatThaiDate(props.row.roundDate) }}</div>
              <div class="round-time">
                <q-icon name="schedule" size="14px" />
                {{ props.row.startTime }} - {{ props.row.endTime }} น.
              </div>
            </q-td>
          </template>

          <template #body-cell-village="props">
            <q-td :props="props">
              <q-badge v-if="props.row.villageArea" class="moo-badge">
                หมู่ {{ props.row.villageArea.moo ?? '-' }} {{ props.row.villageArea.villageName }}
              </q-badge>
              <q-badge v-else color="blue-2" text-color="blue-9" rounded class="q-px-sm q-py-xs">
                รอบกลางของเทศบาล
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-requests="props">
            <q-td :props="props" align="center">
              {{ (props.row._count?.saleRequests ?? 0).toLocaleString() }}
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props" align="center">
              <q-badge
                :color="statusMeta(props.row.status).color"
                :text-color="statusMeta(props.row.status).textColor"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ statusMeta(props.row.status).label }}
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" align="right">
              <div class="action-btns" style="justify-content: flex-end">
                <template v-if="canManage(props.row)">
                  <q-btn
                    v-if="props.row.status === 'planned'"
                    flat
                    dense
                    round
                    size="sm"
                    icon="edit"
                    color="primary"
                    @click="openEdit(props.row)"
                  >
                    <q-tooltip>แก้ไขรอบ</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="props.row.status === 'planned'"
                    flat
                    dense
                    round
                    size="sm"
                    icon="task_alt"
                    color="positive"
                    @click="askAction(props.row, 'complete')"
                  >
                    <q-tooltip>ปิดรอบ (เสร็จสิ้น)</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="props.row.status !== 'completed' && props.row.status !== 'cancelled'"
                    flat
                    dense
                    round
                    size="sm"
                    icon="cancel"
                    color="red-7"
                    @click="askAction(props.row, 'cancel')"
                  >
                    <q-tooltip>ยกเลิกรอบ</q-tooltip>
                  </q-btn>
                </template>
                <span v-else class="text-grey-6 text-caption">จัดการโดยเทศบาล</span>
              </div>
            </q-td>
          </template>

          <template #item="props">
            <AdminGridCard
              :title="formatThaiDate(props.row.roundDate)"
              :subtitle="`${props.row.startTime} - ${props.row.endTime} น.`"
              :badge-text="statusMeta(props.row.status).label"
              :badge-color="statusMeta(props.row.status).color"
              :badge-text-color="statusMeta(props.row.status).textColor"
              :rows="[
                { label: 'ผู้รับซื้อ', value: props.row.buyer?.buyerName ?? '-' },
                { label: 'จุดนัดหมาย / หมายเหตุ', value: props.row.locationNote || '-' },
                {
                  label: 'คำขอขายขยะ',
                  value: `${(props.row._count?.saleRequests ?? 0).toLocaleString()} รายการ`,
                },
              ]"
            >
              <template #rows>
                <div>
                  <dt>หมู่บ้าน</dt>
                  <dd>
                    <q-badge v-if="props.row.villageArea" class="moo-badge">
                      หมู่ {{ props.row.villageArea.moo ?? '-' }} {{ props.row.villageArea.villageName }}
                    </q-badge>
                    <q-badge v-else color="blue-2" text-color="blue-9" rounded class="q-px-sm q-py-xs">
                      รอบกลางของเทศบาล
                    </q-badge>
                  </dd>
                </div>
              </template>
              <template v-if="props.row.status === 'planned'" #actions>
                <q-btn
                  unelevated
                  no-caps
                  icon="edit"
                  label="แก้ไขรอบ"
                  class="is-edit"
                  @click="openEdit(props.row)"
                />
                <q-btn
                  unelevated
                  no-caps
                  icon="task_alt"
                  label="ปิดรอบ"
                  class="is-approve"
                  @click="askAction(props.row, 'complete')"
                />
                <q-btn
                  unelevated
                  no-caps
                  icon="cancel"
                  label="ยกเลิกรอบ"
                  class="is-cancel"
                  @click="askAction(props.row, 'cancel')"
                />
              </template>
            </AdminGridCard>
          </template>

          <template #no-data>
            <div class="empty-state" v-if="!store.loading">
              <q-icon name="event_busy" size="34px" />
              <div>ไม่พบข้อมูลรอบรับซื้อตามเงื่อนไขที่เลือก</div>
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Add / edit round -->
    <q-dialog v-model="showDialog" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEdit ? 'edit_calendar' : 'event_note'" />
            </div>
            {{ isEdit ? 'แก้ไขรอบรับซื้อ' : 'เพิ่มรอบรับซื้อ' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <q-form ref="formRef" greedy @submit.prevent="save">
          <div class="dialog-body">
            <div class="form-grid">
              <MidDateField
                v-model="form.roundDate"
                class="span-6"
                label="วันที่รับซื้อ *"
                required
                buddhist-year
              />
              <q-select
                v-model="form.buyerId"
                outlined
                dense
                emit-value
                map-options
                class="span-6"
                label="ผู้รับซื้อ *"
                :options="buyerOptions"
                :rules="[(v) => !!v || 'กรุณาเลือกผู้รับซื้อ']"
              >
                <template #prepend><q-icon name="local_shipping" /></template>
              </q-select>
              <MidTimeField
                v-model="form.startTime"
                class="span-6"
                label="เวลาเริ่ม *"
                required
                picker="digital"
              />
              <MidTimeField
                v-model="form.endTime"
                class="span-6"
                label="เวลาสิ้นสุด *"
                required
                picker="digital"
                :after="form.startTime"
                after-message="ต้องหลังเวลาเริ่ม"
              />
              <q-input
                v-model.trim="form.locationNote"
                outlined
                dense
                class="span-12"
                label="จุดนัดหมาย / หมายเหตุ"
                placeholder="เช่น ศาลาประชาคมหมู่บ้าน"
              />
            </div>

            <q-banner rounded class="hint-banner q-mt-md">
              <template #avatar><q-icon name="campaign" color="green-8" /></template>
              การเพิ่มรอบรับซื้อโดยแอดมินจะเป็น "รอบส่วนกลาง" ของเทศบาล
            </q-banner>
          </div>

          <div class="dialog-footer">
            <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
            <q-btn
              unelevated
              no-caps
              type="submit"
              color="positive"
              icon="save"
              :label="isEdit ? 'บันทึกการแก้ไข' : 'เปิดรอบรับซื้อ'"
              :loading="store.saving"
            />
          </div>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- Cancel / complete confirm -->
    <q-dialog v-model="showActionDialog">
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon" :class="actionKind === 'cancel' ? 'danger-icon' : ''">
              <q-icon :name="actionKind === 'cancel' ? 'cancel' : 'task_alt'" />
            </div>
            {{ actionKind === 'cancel' ? 'ยกเลิกรอบรับซื้อ' : 'ปิดรอบรับซื้อ' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>
        <div class="dialog-body">
          <template v-if="actionTarget">
            {{ actionKind === 'cancel' ? 'ต้องการยกเลิกรอบวันที่' : 'ยืนยันปิดรอบวันที่' }}
            <b>{{ formatThaiDate(actionTarget.roundDate) }}</b>
            ({{ actionTarget.startTime }} - {{ actionTarget.endTime }} น.) หรือไม่?
            <div v-if="actionKind === 'cancel'" class="text-caption text-grey-7 q-mt-sm">
              สมาชิกจะไม่สามารถแจ้งขายขยะในรอบนี้ได้อีก
              คำร้องที่ส่งไว้แล้ว {{ actionTarget._count?.saleRequests ?? 0 }} รายการจะยังอยู่ในระบบ
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn
            unelevated
            no-caps
            :color="actionKind === 'cancel' ? 'negative' : 'positive'"
            :icon="actionKind === 'cancel' ? 'cancel' : 'task_alt'"
            :label="actionKind === 'cancel' ? 'ยกเลิกรอบ' : 'ปิดรอบ'"
            :loading="actionBusy"
            @click="confirmAction"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QForm, type QTableColumn } from 'quasar';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';
import { useCommitteeRoundStore, type CommitteeRound } from 'src/stores/committeeRoundStore';
import { useVillageAreaStore } from 'src/stores/villageAreaStore';
import { apiErrorMessage } from 'src/utils/apiError';
import {
  MidDateField,
  MidFilterBar,
  MidTimeField,
  midOptionLabel,
  midNotify,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';
import { formatThaiDate } from '../municipality/format';

const $q = useQuasar();
const store = useCommitteeRoundStore();
const villageAreaStore = useVillageAreaStore();

const selectedVillageAreaId = ref<number | null>(null);

const villageOptions = computed(() => {
  return [
    { label: 'รวมทุกหมู่บ้าน', value: null },
    ...villageAreaStore.items.map(v => ({
      label: `หมู่ ${v.moo} ${v.villageName}`,
      value: v.id
    }))
  ];
});

const statusFilter = ref<string | null>(null);
const scopeFilter = ref<'upcoming' | 'all'>('all');
// Searched and paged on the server; the summary cards keep counting the whole
// filtered set. Newest first until another sort is picked.
const search = ref('');
const pagination = useRememberedPagination('admin-rounds', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
  sortBy: 'date' as string | null,
  descending: true,
});

const showDialog = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const formRef = ref<QForm | null>(null);

const showActionDialog = ref(false);
const actionKind = ref<'cancel' | 'complete'>('cancel');
const actionTarget = ref<CommitteeRound | null>(null);
const actionBusy = ref(false);

const statusOptions = [
  { label: 'เปิดรับ', value: 'planned' },
  { label: 'เสร็จสิ้น', value: 'completed' },
  { label: 'ยกเลิก', value: 'cancelled' },
];

const scopeOptions = [
  { label: 'ทั้งหมด (รวมย้อนหลัง)', value: 'all' },
  { label: 'ตั้งแต่วันนี้เป็นต้นไป', value: 'upcoming' },
];

// ช่วงเวลา defaults to 'all', so only a move away from that counts as a
// filter - clearing it goes back to all.
const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (statusFilter.value) {
    items.push({ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, statusFilter.value) });
  }
  if (scopeFilter.value !== 'all') {
    items.push({ key: 'scope', label: 'ช่วงเวลา', value: midOptionLabel(scopeOptions, scopeFilter.value) });
  }
  return items;
});

function clearFilter(key: string) {
  if (key === 'status') statusFilter.value = null;
  if (key === 'scope') scopeFilter.value = 'all';
  restart();
}

function clearAllFilters() {
  statusFilter.value = null;
  scopeFilter.value = 'all';
  selectedVillageAreaId.value = null;
  restart();
}

function emptyForm() {
  return {
    roundDate: '',
    startTime: '09:00',
    endTime: '12:00',
    buyerId: null as number | null,
    locationNote: '',
  };
}
const form = reactive(emptyForm());

const buyerOptions = computed(() =>
  store.buyers.map((buyer) => ({ label: buyer.buyerName, value: buyer.id })),
);

const summaryCards = computed(() => [
  {
    label: 'รอบทั้งหมด',
    value: store.summary?.total ?? 0,
    icon: 'event',
    iconClass: 'icon-blue',
  },
  {
    label: 'เปิดรับอยู่',
    value: store.summary?.planned ?? 0,
    icon: 'event_available',
    iconClass: 'icon-amber',
  },
  {
    label: 'เสร็จสิ้นแล้ว',
    value: store.summary?.completed ?? 0,
    icon: 'task_alt',
    iconClass: 'icon-green',
  },
  {
    label: 'ยกเลิกแล้ว',
    value: store.summary?.cancelled ?? 0,
    icon: 'cancel',
    iconClass: 'icon-red',
  },
]);

function statusMeta(status: CommitteeRound['status']) {
  if (status === 'planned') return { label: 'เปิดรับ', color: 'green-2', textColor: 'green-9' };
  if (status === 'completed') return { label: 'เสร็จสิ้น', color: 'blue-2', textColor: 'blue-9' };
  return { label: 'ยกเลิก', color: 'red-2', textColor: 'red-9' };
}

// Admin can manage all rounds
function canManage(round: CommitteeRound) {
  return round !== undefined;
}

const columns: QTableColumn<CommitteeRound>[] = [
  { name: 'date', label: 'วันที่ / เวลา', field: 'roundDate', align: 'left', sortable: true },
  { name: 'buyer', label: 'ผู้รับซื้อ', field: (row) => row.buyer?.buyerName ?? '-', align: 'left' },
  {
    name: 'locationNote',
    label: 'จุดนัดหมาย',
    field: (row) => row.locationNote || '-',
    align: 'left',
  },
  { name: 'village', label: 'หมู่บ้าน', field: (row) => row.villageArea?.villageName ?? '', align: 'left' },
  { name: 'requests', label: 'คำร้อง', field: (row) => row._count?.saleRequests ?? 0, align: 'center' },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'center' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

function notifyError(error: unknown, fallback: string) {
  midNotify({ type: 'error', message: apiErrorMessage(error, fallback) });
}

async function reload() {
  const filters = {
    ...(statusFilter.value ? { status: statusFilter.value } : {}),
    scope: scopeFilter.value,
    ...(selectedVillageAreaId.value ? { villageAreaId: selectedVillageAreaId.value } : {}),
  };
  const { page, rowsPerPage, sortBy, descending } = pagination.value;
  try {
    const [data] = await Promise.all([
      store.fetchRoundsPage({
        ...filters,
        page,
        pageSize: rowsPerPage,
        search: search.value.trim() || undefined,
        // Only the date column sorts; unsorted = oldest first.
        descending: sortBy ? descending : undefined,
      }),
      store.fetchSummary(filters),
    ]);
    pagination.value.rowsNumber = data.total;
  } catch (error) {
    notifyError(error, 'โหลดรอบรับซื้อไม่สำเร็จ');
  }
}

// A new filter or search changes what the pages hold - back to page 1.
function restart() {
  pagination.value.page = 1;
  void reload();
}

function onTableRequest(props: {
  pagination: { page: number; rowsPerPage: number; sortBy: string | null; descending: boolean };
}) {
  Object.assign(pagination.value, props.pagination);
  void reload();
}

onMounted(() => {
  void villageAreaStore.fetchActive();
  void store.fetchBuyers().catch(() => {
    midNotify({ type: 'error', message: 'โหลดรายชื่อผู้รับซื้อไม่สำเร็จ' });
  });
  void reload();
});

watch([selectedVillageAreaId, search], restart);

function openAdd() {
  isEdit.value = false;
  editingId.value = null;
  Object.assign(form, emptyForm());
  showDialog.value = true;
}

function openEdit(round: CommitteeRound) {
  isEdit.value = true;
  editingId.value = round.id;
  form.roundDate = round.roundDate.slice(0, 10);
  form.startTime = round.startTime;
  form.endTime = round.endTime;
  form.buyerId = round.buyerId;
  form.locationNote = round.locationNote ?? '';
  showDialog.value = true;
}

async function save() {
  const valid = await formRef.value?.validate();
  if (!valid || !form.buyerId) return;

  const payload = {
    roundDate: form.roundDate,
    startTime: form.startTime,
    endTime: form.endTime,
    buyerId: form.buyerId,
    locationNote: form.locationNote || undefined,
  };

  try {
    if (isEdit.value && editingId.value !== null) {
      await store.updateRound(editingId.value, payload);
    } else {
      await store.createRound(payload);
    }
    showDialog.value = false;
    await reload();
    midNotify({
      type: 'success',
      message: isEdit.value ? 'บันทึกการแก้ไขรอบแล้ว' : 'เปิดรอบรับซื้อแล้ว แจ้งเตือนสมาชิกในหมู่บ้านเรียบร้อย',
    });
  } catch (error) {
    notifyError(error, 'บันทึกรอบรับซื้อไม่สำเร็จ');
  }
}

function askAction(round: CommitteeRound, kind: 'cancel' | 'complete') {
  actionTarget.value = round;
  actionKind.value = kind;
  showActionDialog.value = true;
}

async function confirmAction() {
  if (!actionTarget.value) return;

  actionBusy.value = true;
  try {
    if (actionKind.value === 'cancel') {
      await store.cancelRound(actionTarget.value.id);
    } else {
      await store.completeRound(actionTarget.value.id);
    }
    showActionDialog.value = false;
    await reload();
    midNotify({
      type: 'success',
      message: actionKind.value === 'cancel' ? 'ยกเลิกรอบแล้ว' : 'ปิดรอบแล้ว',
    });
  } catch (error) {
    notifyError(error, 'ดำเนินการไม่สำเร็จ');
  } finally {
    actionBusy.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

// Same search row as the committee's round list
.filter-row {
  border-bottom: 1px solid #eaf1eb;
  background: #fdfefd;
}

.filter-select {
  width: 220px;
}

.round-date {
  color: #0e2d1e;
  font-weight: 700;
}

.round-time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7c72;
  font-size: 12.5px;
}

@media (max-width: 599px) {
  .filter-select {
    width: 100%;
  }
}
</style>
