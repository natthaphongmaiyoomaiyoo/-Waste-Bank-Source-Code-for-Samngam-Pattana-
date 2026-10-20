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
            <h1>จัดการรอบรับซื้อ</h1>
            <p v-if="villageLabel">{{ villageLabel }}</p>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เพิ่มรอบรับซื้อ"
            class="hero-add-btn"
            :disable="!hasVillage"
            @click="openAdd"
          />
        </div>
      </section>

      <q-banner v-if="!hasVillage" rounded class="bg-amber-1 text-amber-9 error-banner">
        <template #avatar><q-icon name="warning" /></template>
        บัญชีนี้ยังไม่ได้ถูกกำหนดหมู่บ้านที่รับผิดชอบ กรุณาติดต่อผู้ดูแลระบบก่อนเปิดรอบรับซื้อ
      </q-banner>

      <section v-else class="summary-grid">
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
        <div class="panel-head">
          <div>
            <div class="panel-title">ตารางรอบรับซื้อ</div>
            <div class="panel-caption">
              ทั้งหมด {{ (store.summary?.total ?? 0).toLocaleString() }} รอบ
              <template v-if="search.trim()">
                · พบ {{ store.pageTotal.toLocaleString() }} รอบ</template
              >
            </div>
          </div>
        </div>

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
          </MidFilterBar>
        </div>

        <q-table
          flat
          row-key="id"
          class="muni-table round-table"
          v-model:pagination="pagination"
          :rows="store.items"
          :columns="columns"
          :grid="isPhone"
          :loading="store.loading"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
          @row-click="(_evt, row) => openManage(row as CommitteeRound)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <!-- Phone: one card per round - seven columns don't fit a phone width. -->
          <template #item="props">
            <div class="round-card-wrap col-12">
              <article class="round-card" @click="openManage(props.row as CommitteeRound)">
                <div class="round-card-head">
                  <div class="round-card-title">
                    <div class="round-date">{{ formatThaiDate(props.row.roundDate) }}</div>
                    <div class="round-time">
                      <q-icon name="schedule" size="14px" />
                      {{ props.row.startTime }} - {{ props.row.endTime }} น.
                    </div>
                  </div>
                  <q-badge
                    :color="statusMeta(props.row).color"
                    :text-color="statusMeta(props.row).textColor"
                    class="q-px-sm q-py-xs"
                    rounded
                  >
                    {{ statusMeta(props.row).label }}
                  </q-badge>
                </div>

                <dl class="round-card-rows">
                  <div>
                    <dt>ผู้รับซื้อ</dt>
                    <dd>{{ props.row.buyer?.buyerName ?? '-' }}</dd>
                  </div>
                  <div>
                    <dt>จุดนัดหมาย / หมายเหตุ</dt>
                    <dd>{{ props.row.locationNote || '-' }}</dd>
                  </div>
                  <div>
                    <dt>คำขอขายขยะ</dt>
                    <dd>{{ (props.row._count?.saleRequests ?? 0).toLocaleString() }} รายการ</dd>
                  </div>
                </dl>
              </article>
            </div>
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
                :color="statusMeta(props.row).color"
                :text-color="statusMeta(props.row).textColor"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ statusMeta(props.row).label }}
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
                    @click.stop="openEdit(props.row)"
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
                    @click.stop="askAction(props.row, 'complete')"
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
                    @click.stop="askAction(props.row, 'cancel')"
                  >
                    <q-tooltip>ยกเลิกรอบ</q-tooltip>
                  </q-btn>
                </template>
                <span v-else class="text-grey-6 text-caption">จัดการโดยเทศบาล</span>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="empty-state">
              <q-icon name="event_busy" size="34px" />
              <div>ยังไม่มีรอบรับซื้อในช่วงที่เลือก</div>
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Manage one round: opened by tapping a card or a table row -->
    <q-dialog v-model="showManageDialog">
      <q-card v-if="manageTarget" class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon name="event_available" />
            </div>
            จัดการรอบรับซื้อ
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="manage-head">
            <div>
              <div class="manage-date">{{ formatThaiDate(manageTarget.roundDate) }}</div>
              <div class="round-time">
                <q-icon name="schedule" size="14px" />
                {{ manageTarget.startTime }} - {{ manageTarget.endTime }} น.
              </div>
            </div>
            <q-badge
              :color="statusMeta(manageTarget).color"
              :text-color="statusMeta(manageTarget).textColor"
              class="q-px-sm q-py-xs"
              rounded
            >
              {{ statusMeta(manageTarget).label }}
            </q-badge>
          </div>

          <dl class="round-card-rows">
            <div>
              <dt>ผู้รับซื้อ</dt>
              <dd>{{ manageTarget.buyer?.buyerName ?? '-' }}</dd>
            </div>
            <div>
              <dt>จุดนัดหมาย / หมายเหตุ</dt>
              <dd>{{ manageTarget.locationNote || '-' }}</dd>
            </div>
            <div>
              <dt>คำขอขายขยะ</dt>
              <dd>{{ (manageTarget._count?.saleRequests ?? 0).toLocaleString() }} รายการ</dd>
            </div>
          </dl>

          <div v-if="!manageLockedNote" class="manage-actions">
            <q-btn
              outline
              no-caps
              icon="edit"
              label="แก้ไขรอบ"
              color="primary"
              @click="runManageAction('edit')"
            />
            <q-btn
              unelevated
              no-caps
              icon="task_alt"
              label="ปิดรอบ (เสร็จสิ้น)"
              color="positive"
              @click="runManageAction('complete')"
            />
            <q-btn
              outline
              no-caps
              icon="cancel"
              label="ยกเลิกรอบ"
              color="negative"
              @click="runManageAction('cancel')"
            />
          </div>
          <div v-else class="manage-note">
            <q-icon name="info" size="18px" />
            {{ manageLockedNote }}
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ปิด" color="grey-7" v-close-popup />
        </div>
      </q-card>
    </q-dialog>

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
                :options="selectableRoundDate"
                :rules="[notPastRule]"
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
              รอบนี้จะเปิดให้เฉพาะสมาชิก{{
                villageLabel ? ` ${villageLabel}` : 'ในหมู่บ้านที่รับผิดชอบ'
              }}
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
              สมาชิกจะไม่สามารถแจ้งขายขยะในรอบนี้ได้อีก คำร้องที่ส่งไว้แล้ว
              {{ actionTarget._count?.saleRequests ?? 0 }} รายการจะยังอยู่ในระบบ
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

    <!-- Round added / edited: a summary of what was saved -->
    <MidSuccessDialog
      v-if="savedRound"
      v-model="savedOpen"
      :title="savedWasEdit ? 'แก้ไขรอบรับซื้อสำเร็จ' : 'เพิ่มรอบรับซื้อสำเร็จ'"
      :rows="savedRows"
      secondary-label="ปิด"
      :primary-label="savedWasEdit ? 'แก้ไขอีกครั้ง' : 'เพิ่มรอบอีก'"
      @primary="onSavedPrimary"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QForm, type QTableColumn } from 'quasar';
import { useCommitteeRoundStore, type CommitteeRound } from 'src/stores/committeeRoundStore';
import { useAuthStore } from 'src/stores/authStore';
import { apiErrorMessage } from 'src/utils/apiError';
import {
  MidDateField,
  MidFilterBar,
  MidSuccessDialog,
  MidTimeField,
  midOptionLabel,
  thaiDateToIso,
  midNotify,
  type MidActiveFilter,
  type MidSuccessRow,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';
import {
  ROUND_STATE_LABELS,
  formatThaiDate,
  roundDisplayState,
  type RoundDisplayState,
} from '../municipality/format';

const $q = useQuasar();
const store = useCommitteeRoundStore();
const authStore = useAuthStore();

const villageLabel = computed(() => authStore.myVillageLabel);
const hasVillage = computed(() => authStore.myVillage !== null);

const statusFilter = ref<string | null>(null);
const scopeFilter = ref<'upcoming' | 'all'>('all');
// Searched on the server, across every round - the Thai date in short and long
// form ("21 ก.ย.", "กันยายน", "วันจันทร์"), times, buyer and meeting point. The
// summary cards keep counting the whole filtered set.
const search = ref('');

const pagination = useRememberedPagination('committee-rounds', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
  sortBy: null as string | null,
  descending: false,
});
const showDialog = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const formRef = ref<QForm | null>(null);

const isPhone = computed(() => $q.screen.lt.sm);

const showManageDialog = ref(false);
const manageTarget = ref<CommitteeRound | null>(null);

const showActionDialog = ref(false);
const actionKind = ref<'cancel' | 'complete'>('cancel');
const actionTarget = ref<CommitteeRound | null>(null);
const actionBusy = ref(false);

// The round as the server saved it, for the success dialog. Whether it was an
// edit is kept apart from isEdit, which the next openAdd/openEdit overwrites
// while this dialog is still fading out.
const savedOpen = ref(false);
const savedRound = ref<CommitteeRound | null>(null);
const savedWasEdit = ref(false);

const statusOptions = [
  { label: 'เปิดรับ', value: 'planned' },
  { label: 'เสร็จสิ้น', value: 'completed' },
  { label: 'ยกเลิก', value: 'cancelled' },
];

const scopeOptions = [
  { label: 'ตั้งแต่วันนี้เป็นต้นไป', value: 'upcoming' },
  { label: 'ทั้งหมด (รวมย้อนหลัง)', value: 'all' },
];

// ช่วงเวลา defaults to 'all' - past rounds hold the purchase records and proof
// the committee still needs - so only narrowing to upcoming counts as a filter,
// and clearing it goes back to everything (same as AdminRoundsPage).
const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (statusFilter.value) {
    items.push({
      key: 'status',
      label: 'สถานะ',
      value: midOptionLabel(statusOptions, statusFilter.value),
    });
  }
  if (scopeFilter.value !== 'all') {
    items.push({
      key: 'scope',
      label: 'ช่วงเวลา',
      value: midOptionLabel(scopeOptions, scopeFilter.value),
    });
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

// --- No opening a round in the past ---------------------------------------------
// A past-dated round is dead on arrival: members can't book it (sellRequestService
// refuses a round whose date has gone by), so the calendar greys those days out
// and the rule catches a date typed by hand.
//
// One exception: when editing an existing round that is already in the past, its
// own date stays selectable - otherwise fixing its time or buyer would be
// impossible without moving the round.

// Set when the dialog opens on a round already dated in the past.
const editingPastDate = ref('');

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isAllowedRoundDate(iso: string): boolean {
  return iso >= todayIso() || (!!editingPastDate.value && iso === editingPastDate.value);
}

// q-date hands the day over as "YYYY/MM/DD".
function selectableRoundDate(date: string): boolean {
  return isAllowedRoundDate(date.replace(/\//g, '-'));
}

// Runs on the field's display text (วว/ดด/ปปปป, พ.ศ.), so convert first. Format
// errors are already reported by MidDateField's own rule.
function notPastRule(value: string | null): true | string {
  const iso = thaiDateToIso(value ?? '');
  if (!iso) return true;
  return isAllowedRoundDate(iso) || 'เลือกวันที่ผ่านมาแล้วไม่ได้';
}

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

const ROUND_STATE_COLORS: Record<RoundDisplayState, { color: string; textColor: string }> = {
  open: { color: 'green-2', textColor: 'green-9' },
  // Still 'planned' in the database, but its time window has closed.
  ended: { color: 'orange-2', textColor: 'orange-10' },
  completed: { color: 'blue-2', textColor: 'blue-9' },
  cancelled: { color: 'red-2', textColor: 'red-9' },
};

function statusMeta(round: CommitteeRound) {
  const state = roundDisplayState(round);
  return { label: ROUND_STATE_LABELS[state], ...ROUND_STATE_COLORS[state] };
}

// Municipality-wide rounds (no village) belong to the admin - the backend
// refuses to let a committee touch them, so don't offer the buttons either.
function canManage(round: CommitteeRound) {
  return round.villageArea !== null;
}

const columns: QTableColumn<CommitteeRound>[] = [
  { name: 'date', label: 'วันที่ / เวลา', field: 'roundDate', align: 'left', sortable: true },
  {
    name: 'buyer',
    label: 'ผู้รับซื้อ',
    field: (row) => row.buyer?.buyerName ?? '-',
    align: 'left',
  },
  {
    name: 'locationNote',
    label: 'จุดนัดหมาย / หมายเหตุ',
    field: (row) => row.locationNote || '-',
    align: 'left',
  },
  {
    name: 'village',
    label: 'หมู่บ้าน',
    field: (row) => row.villageArea?.villageName ?? '',
    align: 'left',
  },
  {
    name: 'requests',
    label: 'คำร้อง',
    field: (row) => row._count?.saleRequests ?? 0,
    align: 'center',
  },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'center' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

function notifyError(error: unknown, fallback: string) {
  midNotify({ type: 'error', message: apiErrorMessage(error, fallback) });
}

// Reloads the page on screen (after a save or an action).
async function reload() {
  if (!hasVillage.value) return;
  const filters = {
    status: statusFilter.value ?? undefined,
    scope: scopeFilter.value,
    ownVillageOnly: true,
  };
  const { page, rowsPerPage, sortBy, descending } = pagination.value;
  try {
    const [data] = await Promise.all([
      store.fetchRoundsPage({
        ...filters,
        page,
        pageSize: rowsPerPage,
        search: search.value.trim() || undefined,
        // Only the date column sorts; unsorted = newest first.
        descending: sortBy ? descending : true,
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

watch(search, restart);

function onTableRequest(props: {
  pagination: { page: number; rowsPerPage: number; sortBy: string | null; descending: boolean };
}) {
  Object.assign(pagination.value, props.pagination);
  void reload();
}

onMounted(() => {
  void reload();
  if (hasVillage.value) {
    void store.fetchBuyers().catch(() => {
      midNotify({ type: 'error', message: 'โหลดรายชื่อผู้รับซื้อไม่สำเร็จ' });
    });
  }
});

// The session may still be loading on first paint.
watch(hasVillage, (assigned, wasAssigned) => {
  if (assigned && !wasAssigned) {
    void reload();
    void store.fetchBuyers().catch(() => undefined);
  }
});

function openAdd() {
  isEdit.value = false;
  editingId.value = null;
  editingPastDate.value = '';
  Object.assign(form, emptyForm());
  showDialog.value = true;
}

function openEdit(round: CommitteeRound) {
  isEdit.value = true;
  editingId.value = round.id;
  const roundDate = round.roundDate.slice(0, 10);
  editingPastDate.value = roundDate < todayIso() ? roundDate : '';
  form.roundDate = roundDate;
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
    // Sent even when empty: on an edit, '' is what removes an existing note.
    locationNote: form.locationNote,
  };

  try {
    const editId = isEdit.value ? editingId.value : null;
    savedRound.value =
      editId !== null ? await store.updateRound(editId, payload) : await store.createRound(payload);
    savedWasEdit.value = editId !== null;
    showDialog.value = false;
    await reload();
    savedOpen.value = true;
  } catch (error) {
    notifyError(error, 'บันทึกรอบรับซื้อไม่สำเร็จ');
  }
}

const savedRows = computed<MidSuccessRow[]>(() => {
  const round = savedRound.value;
  if (!round) return [];
  const status = statusMeta(round);
  return [
    {
      label: 'วันและเวลา',
      value: `${formatThaiDate(round.roundDate)}\n${round.startTime} - ${round.endTime} น.`,
    },
    { label: 'ผู้รับซื้อ', value: round.buyer?.buyerName ?? '-' },
    { label: 'จุดนัดหมาย / หมายเหตุ', value: round.locationNote || '-' },
    {
      label: 'หมู่บ้าน',
      value: round.villageArea
        ? `หมู่ ${round.villageArea.moo ?? '-'} ${round.villageArea.villageName}`
        : '-',
    },
    {
      label: 'สถานะ',
      value: status.label,
      badge: { color: status.color, textColor: status.textColor },
    },
  ];
});

// "เพิ่มรอบอีก" opens a blank add form; "แก้ไขอีกครั้ง" reopens the round just edited.
function onSavedPrimary() {
  const round = savedRound.value;
  savedOpen.value = false;
  if (savedWasEdit.value && round) openEdit(round);
  else openAdd();
}

function openManage(round: CommitteeRound) {
  manageTarget.value = round;
  showManageDialog.value = true;
}

// Same rules as the table's action buttons: only a planned round of the
// committee's own village can still be edited, closed or cancelled.
const manageLockedNote = computed(() => {
  const round = manageTarget.value;
  if (!round) return '';
  if (!canManage(round)) return 'รอบนี้จัดการโดยเทศบาล';
  if (round.status === 'completed') return 'รอบนี้เสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้';
  if (round.status === 'cancelled') return 'รอบนี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไขได้';
  return '';
});

// Hands off to the existing edit / confirm dialogs.
function runManageAction(kind: 'edit' | 'complete' | 'cancel') {
  const round = manageTarget.value;
  if (!round) return;
  showManageDialog.value = false;
  if (kind === 'edit') openEdit(round);
  else askAction(round, kind);
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
@use '../municipality/theme' as *;

// The theme's `flex: 1` gives the title block a zero basis, so on a phone it shrank
// to one word per line beside the button. A 200px floor keeps it beside the icon
// and makes the button wrap onto its own line instead.
.hero-copy {
  flex: 1 1 200px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 18px 28px;
  border-bottom: 1px solid #eaf1eb;
  background: #fdfefd;
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

.round-table :deep(tbody tr) {
  cursor: pointer;
}

// --- Phone cards ----------------------------------------------------------------

.round-card-wrap {
  padding: 6px 12px;
}

.round-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  cursor: pointer;
}

.round-card-head,
.manage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.round-card-title {
  min-width: 0;
  flex: 1;
}

.round-card-rows {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #e3ece2;
}

.round-card-rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.round-card-rows dt {
  flex-shrink: 0;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 600;
}

.round-card-rows dd {
  margin: 0;
  color: #18231e;
  font-size: 13.5px;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

// --- Manage dialog --------------------------------------------------------------

.manage-date {
  color: #0e2d1e;
  font-size: 16px;
  font-weight: 700;
}

.manage-actions {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

// Pill buttons, the shape most of the committee pages already use.
.manage-actions .q-btn,
.dialog-footer .q-btn {
  padding-inline: 20px;
  border-radius: 999px;
}

.manage-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding: 10px 12px;
  color: #5f6d65;
  background: #f4f7f5;
  border-radius: 10px;
  font-size: 13.5px;
}

.moo-badge {
  background: #e6f5ed;
  color: #0b7a47;
  font-weight: 700;
  border-radius: 8px;
  padding: 4px 10px;
}

.hint-banner {
  background: #f2fbf5;
  color: #14603c;
  border: 1px solid #d8eee1;
  font-size: 13.5px;
}

.danger-icon {
  background: #fdecec;
  color: #c62828;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px 14px;
}

.span-6 {
  grid-column: span 6;
}
.span-12 {
  grid-column: span 12;
}

@media (max-width: 599px) {
  .span-6 {
    grid-column: span 12;
  }

  .hero-add-btn {
    width: 100%;
  }
}
</style>
