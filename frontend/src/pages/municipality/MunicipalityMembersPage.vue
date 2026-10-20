<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="group" />
          </div>
          <div class="hero-copy">
            <h1>ติดตามสมาชิก</h1>
          </div>
        </div>
      </section>

      <q-banner v-if="summary.error" rounded class="bg-red-1 text-red-9 error-banner">
        {{ summary.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadSummary" />
        </template>
      </q-banner>

      <section v-else class="summary-grid">
        <article v-for="card in summaryCards" :key="card.label" class="summary-card">
          <div :class="['summary-icon', card.iconClass]">
            <q-icon :name="card.icon" />
          </div>
          <div class="summary-content">
            <div class="summary-label">{{ card.label }}</div>
            <div class="summary-value">
              <q-skeleton v-if="summary.loading && !summary.data" type="text" width="70px" />
              <template v-else>
                {{ card.value }}
                <span>{{ card.unit }}</span>
              </template>
            </div>
          </div>
        </article>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">รายชื่อสมาชิก</div>
          </div>
        </div>

        <div class="filter-row">
          <MidFilterBar
            v-model:search="search"
            search-label="ค้นหา (ชื่อ / เลขบัตร / เบอร์โทร / รหัสสมาชิก)"
            title="กรองรายชื่อสมาชิก"
            :active="activeFilters"
            @update:search="applyFilters"
            @clear="clearFilter"
            @clear-all="clearAllFilters"
          >
            <q-select
              v-model="status"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="สถานะ"
              :options="statusOptions"
              @update:model-value="applyFilters"
            />
            <q-select
              v-model="moo"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="หมู่ที่"
              :options="mooOptions"
              :loading="summary.loading && mooOptions.length === 0"
              @update:model-value="applyFilters"
            />
          </MidFilterBar>
        </div>

        <q-banner v-if="members.error" rounded class="bg-red-1 text-red-9 q-ma-md">
          {{ members.error }}
          <template #action>
            <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadMembers" />
          </template>
        </q-banner>

        <!-- Phone: grid mode swaps the rows for one card per member (the #item
             slot) and keeps the table's own pagination and loading bar. -->
        <q-table
          v-else
          flat
          row-key="id"
          class="muni-table member-table"
          card-container-class="member-cards"
          :grid="isPhone"
          :rows="members.data?.items ?? []"
          :columns="columns"
          :loading="members.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          binary-state-sort
          @request="onTableRequest"
          @row-click="(_evt, row) => openDetail(row as MuniMember)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <button type="button" class="member-card" @click="openDetail(props.row as MuniMember)">
              <div class="member-card-head">
                <!-- Profile photo, same as the committee member card; the code
                     moves to the line under the name. -->
                <q-avatar size="46px" class="member-card-avatar">
                  <img
                    v-if="props.row.avatarUrl && !brokenAvatars.has(props.row.id)"
                    :src="props.row.avatarUrl"
                    :alt="memberFullName(props.row as MuniMember)"
                    @error="markAvatarBroken(props.row.id)"
                  />
                  <span v-else>{{ props.row.firstName.charAt(0) }}</span>
                </q-avatar>
                <div class="member-card-main">
                  <div class="member-card-name">{{ memberFullName(props.row as MuniMember) }}</div>
                  <div class="member-card-meta">
                    รหัส {{ props.row.memberCode }}<template v-if="props.row.household">
                      · {{ memberAddressLabel(props.row as MuniMember) }}</template>
                  </div>
                </div>
                <div class="status-cell status-cell--card">
                  <q-badge
                    :color="memberStatusColor(props.row.status).color"
                    :text-color="memberStatusColor(props.row.status).textColor"
                    class="q-px-sm q-py-xs"
                    rounded
                  >
                    {{ memberStatusLabel(props.row.status) }}
                  </q-badge>
                  <q-badge
                    v-if="showsFundShortfall(props.row as MuniMember)"
                    color="red-1"
                    text-color="red-9"
                    class="q-px-sm q-py-xs"
                    rounded
                  >
                    เงินสะสมไม่ครบ
                  </q-badge>
                </div>
              </div>

              <div class="member-card-grid">
                <div class="member-field">
                  <span class="member-field-label">เงินสะสม</span>
                  <span
                    :class="[
                      'member-field-value',
                      isFundBelowMinimum(props.row as MuniMember) ? 'is-short' : 'is-money',
                    ]"
                  >
                    {{ formatBaht(props.row.fundBalance?.totalContribution) }} บาท
                  </span>
                </div>
                <div class="member-field">
                  <span class="member-field-label">เบอร์โทร</span>
                  <span class="member-field-value">{{ props.row.phone || '-' }}</span>
                </div>
                <div class="member-field">
                  <span class="member-field-label">เลขบัตรประชาชน</span>
                  <span class="member-field-value">{{ props.row.citizenId }}</span>
                </div>
                <div class="member-field">
                  <span class="member-field-label">วันที่สมัคร</span>
                  <span class="member-field-value">{{ formatThaiDate(props.row.applyDate) }}</span>
                </div>
              </div>
            </button>
          </template>
          <template #body-cell-name="props">
            <q-td :props="props">
              <div class="name-cell">
                <q-avatar size="38px" class="row-avatar">
                  <img
                    v-if="props.row.avatarUrl && !brokenAvatars.has(props.row.id)"
                    :src="props.row.avatarUrl"
                    :alt="memberFullName(props.row as MuniMember)"
                    @error="markAvatarBroken(props.row.id)"
                  />
                  <span v-else>{{ props.row.firstName.charAt(0) }}</span>
                </q-avatar>
                <span class="name-text">{{ memberFullName(props.row as MuniMember) }}</span>
              </div>
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <div class="status-cell">
                <q-badge
                  :color="memberStatusColor(props.row.status).color"
                  :text-color="memberStatusColor(props.row.status).textColor"
                  class="q-px-sm q-py-xs"
                  rounded
                >
                  {{ memberStatusLabel(props.row.status) }}
                </q-badge>
                <!-- Fund shortfall rides alongside the membership status: a
                     member can be "ใช้งาน" and still owe the 50-baht minimum (not shown
                     once they have resigned or died). -->
                <q-badge
                  v-if="showsFundShortfall(props.row as MuniMember)"
                  color="red-1"
                  text-color="red-9"
                  class="q-px-sm q-py-xs"
                  rounded
                >
                  เงินสะสมไม่ครบ
                  <q-tooltip>
                    เงินสะสม {{ formatBaht(props.row.fundBalance?.totalContribution) }} บาท
                    จากขั้นต่ำ {{ FUND_MINIMUM_BAHT }} บาท
                  </q-tooltip>
                </q-badge>
              </div>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                dense
                round
                icon="visibility"
                color="positive"
                @click.stop="openDetail(props.row as MuniMember)"
              >
                <q-tooltip>ดูรายละเอียด</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="person_search" size="32px" />
              ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่เลือก
            </div>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableProps } from 'quasar';
import {
  MidFilterBar,
  midOptionLabel,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';
import { useMunicipalityStore, type MuniMember } from 'src/stores/municipalityStore';
import {
  FUND_BELOW_MINIMUM_FILTER,
  FUND_MINIMUM_BAHT,
  FUND_STATUS_BELOW_MINIMUM,
  MEMBER_LIST_STATUS_OPTIONS,
  formatBaht,
  formatThaiDate,
  isFundBelowMinimum,
  showsFundShortfall,
  memberFullName,
  memberStatusColor,
  memberStatusLabel,
} from './format';

const router = useRouter();
const store = useMunicipalityStore();

// Same 720px breakpoint as the page's phone CSS - the member table turns into
// cards below it.
const $q = useQuasar();
const isPhone = computed(() => $q.screen.width <= 720);

const summary = computed(() => store.membersSummary);
const members = computed(() => store.members);

const search = ref('');
const status = ref<string | null>(null);
// null once cleared - q-select's clearable hands back null, not ''.
const moo = ref<string | null>(null);
let filterTimer: number | undefined;

const statusOptions = MEMBER_LIST_STATUS_OPTIONS;

// The "เงินสะสมยังไม่ครบ" entry in that same select is not a member.status, so it
// travels to the backend as its own `fundStatus` query param instead.
const fundFilterSelected = computed(() => status.value === FUND_BELOW_MINIMUM_FILTER);

// Every หมู่ that actually has members (members summary), so a village with
// households but no village_area master-data row can still be picked.
const mooOptions = computed(() =>
  (summary.value.data?.moos ?? []).map((value) => ({ value, label: `หมู่ ${value}` })),
);

const activeFilters = computed<MidActiveFilter[]>(() => {
  const items: MidActiveFilter[] = [];
  if (status.value) {
    items.push({ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, status.value) });
  }
  if (moo.value) {
    items.push({ key: 'moo', label: 'หมู่ที่', value: `หมู่ ${moo.value}` });
  }
  return items;
});

function clearFilter(key: string) {
  if (key === 'status') status.value = null;
  if (key === 'moo') moo.value = null;
  applyFilters();
}

function clearAllFilters() {
  status.value = null;
  moo.value = null;
  applyFilters();
}

const pagination = useRememberedPagination('municipality-members', {
  page: 1,
  rowsPerPage: 20,
  rowsNumber: 0,
});

// An avatarUrl can outlive the file it points at (upload deleted, storage not
// served) - fall back to the initial instead of a broken image.
const brokenAvatars = reactive(new Set<number>());

function markAvatarBroken(memberId: number) {
  brokenAvatars.add(memberId);
}

// Shared by the table's address column and the phone card.
function memberAddressLabel(row: MuniMember): string {
  return row.household ? `หมู่ ${row.household.moo ?? '-'} ${row.household.subdistrict ?? ''}`.trim() : '-';
}

const columns: QTableProps['columns'] = [
  { name: 'memberCode', align: 'left', label: 'รหัสสมาชิก', field: 'memberCode', sortable: false },
  {
    name: 'name',
    align: 'left',
    label: 'ชื่อ-นามสกุล',
    field: (row: MuniMember) => memberFullName(row),
  },
  { name: 'citizenId', align: 'left', label: 'เลขบัตรประชาชน', field: 'citizenId' },
  { name: 'phone', align: 'left', label: 'เบอร์โทร', field: 'phone' },
  {
    name: 'address',
    align: 'left',
    label: 'ที่อยู่ (หมู่ที่)',
    field: (row: MuniMember) => memberAddressLabel(row),
  },
  {
    name: 'fund',
    align: 'right',
    label: 'เงินสะสม (บาท)',
    field: (row: MuniMember) => formatBaht(row.fundBalance?.totalContribution),
  },
  {
    name: 'applyDate',
    align: 'left',
    label: 'วันที่สมัคร',
    field: (row: MuniMember) => formatThaiDate(row.applyDate),
  },
  { name: 'status', align: 'center', label: 'สถานะ', field: 'status' },
  { name: 'actions', align: 'center', label: '', field: () => '' },
];

const summaryCards = computed(() => {
  const data = summary.value.data;
  return [
    {
      label: 'สมาชิกทั้งหมด',
      value: data?.total.toLocaleString() ?? '-',
      unit: 'คน',
      icon: 'people',
      iconClass: 'icon-blue',
    },
    {
      label: 'สถานะใช้งาน',
      value: (data?.byStatus['active'] ?? 0).toLocaleString(),
      unit: 'คน',
      icon: 'how_to_reg',
      iconClass: 'icon-green',
    },
    {
      label: 'สมัครใหม่เดือนนี้',
      value: data?.newThisMonth.toLocaleString() ?? '-',
      unit: 'คน',
      icon: 'person_add',
      iconClass: 'icon-amber',
    },
    {
      label: 'ครัวเรือนที่เข้าร่วม',
      value: data?.householdCount.toLocaleString() ?? '-',
      unit: 'ครัวเรือน',
      icon: 'home',
      iconClass: 'icon-green',
    },
  ];
});

function loadSummary() {
  void store.fetchMembersSummary();
}

async function loadMembers() {
  const applied = await store.fetchMembers({
    page: pagination.value.page,
    pageSize: pagination.value.rowsPerPage,
    search: search.value.trim() || undefined,
    status: fundFilterSelected.value ? undefined : (status.value ?? undefined),
    fundStatus: fundFilterSelected.value ? FUND_STATUS_BELOW_MINIMUM : undefined,
    moo: moo.value ?? undefined,
  });
  if (applied) {
    pagination.value.rowsNumber = members.value.data?.total ?? 0;
  }
}

function runFilterRequest() {
  pagination.value.page = 1;
  void loadMembers();
}

function applyFilters() {
  if (filterTimer) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    filterTimer = undefined;
    runFilterRequest();
  }, 250);
}

function onTableRequest(props: { pagination: { page: number; rowsPerPage: number } }) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  void loadMembers();
}

function openDetail(row: MuniMember) {
  void router.push(`/municipality/members/${row.id}`);
}

onMounted(() => {
  loadSummary();
  void loadMembers();
});

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 18px 28px;
}

// two badges stack instead of stretching the status column
.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.member-table :deep(tbody tr) {
  cursor: pointer;
}

// --- Member cards (phone, q-table grid mode) ---

// The container is rendered inside QTable, hence :deep.
.member-table :deep(.member-cards) {
  display: grid;
  gap: 10px;
  padding: 4px 16px 12px;
}

.member-card {
  display: block;
  width: 100%;
  padding: 14px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:hover,
  &:focus-visible {
    border-color: #bcd9c6;
    box-shadow: 0 6px 16px rgba(23, 46, 34, 0.08);
  }
}

.member-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

// Avatar look copied from CommitteeMembersPage (.member-card-avatar / .row-avatar).
.member-card-avatar,
.row-avatar {
  flex-shrink: 0;
  color: #0d7a44;
  background: #eaf6ec;
  border: 1px solid #dcefe1;
  font-weight: 800;
}

.member-card-avatar {
  font-size: 19px;
}

.row-avatar {
  font-size: 16px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name-text {
  font-weight: 600;
  white-space: nowrap;
}

.member-card-main {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.member-card-name {
  color: #16352a;
  font-size: 14.5px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.member-card-meta {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.status-cell--card {
  align-items: flex-end;
}

.member-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4ede6;
}

.member-field {
  min-width: 0;
}

.member-field-label {
  display: block;
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
}

.member-field-value {
  display: block;
  margin-top: 1px;
  color: #2c3b33;
  font-size: 13.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  // Numbers (ID, phone, baht) break only if they truly cannot fit - never
  // mid-number just because the column could be squeezed narrower.
  overflow-wrap: break-word;

  &.is-money {
    color: #0d7a44;
    font-weight: 800;
  }

  &.is-short {
    color: #c05252;
    font-weight: 800;
  }
}

@media (max-width: 720px) {
  .filter-row {
    padding: 16px;
  }

  // Phone: the four summary cards stay two to a row (the shared theme stacks
  // them one per row). A half-width card cannot hold the icon beside the
  // figure on a phone with large text, so the icon sits on top and the label
  // and figure get the card's full width - same as the operations page.
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .summary-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-height: 0;
    padding: 12px 14px;
    border-radius: 14px;
  }

  .summary-icon {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 10px;
    font-size: 19px;
  }

  .summary-content {
    width: 100%;
  }

  .summary-label {
    font-size: 12px;
    line-height: 1.3;
  }

  // A figure never splits mid-number; only the unit may wrap as a whole word.
  .summary-value {
    margin-top: 2px;
    font-size: 20px;
    overflow-wrap: normal;
  }

  .summary-value span {
    font-size: 11.5px;
  }
}
</style>
