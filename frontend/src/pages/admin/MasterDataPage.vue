<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero dashboard-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>
        <div class="hero-row">
          <div class="hero-icon"><q-icon name="tune" /></div>
          <div class="hero-copy">
            <h1>ข้อมูลพื้นฐานระบบ</h1>
          </div>
        </div>
      </section>

      <div class="master-tabs q-mt-lg">
        <q-tabs v-model="activeTab" dense align="left" indicator-color="positive" active-color="positive">
          <q-tab name="price" icon="price_change" label="ประวัติราคา" />
          <q-tab name="fund" icon="account_balance" label="บัญชีกองทุน" />
          <q-tab name="settings" icon="settings" label="ตั้งค่าระบบ" />
          <q-tab name="roles" icon="verified_user" label="บทบาท" />
        </q-tabs>
      </div>

      <q-tab-panels v-model="activeTab" animated class="transparent-panels">
        <q-tab-panel name="price" class="q-pa-none">
          <q-card flat class="panel-card panel-card--flush q-mt-md">
            <div class="panel-head">
              <div>
                <div class="panel-title">ประวัติราคาขยะ</div>
                <div class="panel-caption">บันทึกราคาตามช่วงเวลา ราคากลางจะอัปเดตประเภทขยะอัตโนมัติ</div>
              </div>
              <q-btn unelevated no-caps icon="add" label="เพิ่มราคา" color="positive" @click="openPriceDialog" />
            </div>

            <q-table
              flat
              row-key="id"
              class="muni-table"
              v-model:pagination="tablePagination.price"
              :rows="priceRows"
              :columns="priceColumns"
              :loading="store.loading"
              :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
              @request="(request) => onTableRequest('price', request)"
            >
              <template #pagination="scope">
                <MidTablePagination
                  :pagination="scope.pagination"
                  :pages-number="scope.pagesNumber"
                />
              </template>
              <template #body-cell-wasteType="props">
                <q-td :props="props">{{ props.row.wasteType?.wasteName ?? '-' }}</q-td>
              </template>
              <template #body-cell-buyer="props">
                <q-td :props="props">{{ props.row.buyer?.buyerName ?? 'ราคากลาง' }}</q-td>
              </template>
              <template #body-cell-price="props">
                <q-td :props="props">
                  <span class="text-weight-bold text-positive">{{ money(props.row.price) }}</span>
                </q-td>
              </template>
              <template #body-cell-effectiveFrom="props">
                <q-td :props="props">{{ dateText(props.row.effectiveFrom) }}</q-td>
              </template>
              <template #body-cell-effectiveTo="props">
                <q-td :props="props">{{ props.row.effectiveTo ? dateText(props.row.effectiveTo) : 'ปัจจุบัน' }}</q-td>
              </template>
            </q-table>
          </q-card>
        </q-tab-panel>

        <q-tab-panel name="fund" class="q-pa-none">
          <q-card flat class="panel-card panel-card--flush q-mt-md">
            <div class="panel-head">
              <div>
                <div class="panel-title">บัญชีกองทุน</div>
                <div class="panel-caption">บัญชีที่ใช้ติดตามยอดกองทุนของระบบ</div>
              </div>
              <q-btn unelevated no-caps icon="add" label="เพิ่มบัญชี" color="positive" @click="openFundDialog()" />
            </div>

            <q-table
              flat
              row-key="id"
              class="muni-table"
              v-model:pagination="tablePagination.fund"
              :rows="fundRows"
              :columns="fundColumns"
              :loading="store.loading"
              :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
              @request="(request) => onTableRequest('fund', request)"
            >
              <template #pagination="scope">
                <MidTablePagination
                  :pagination="scope.pagination"
                  :pages-number="scope.pagesNumber"
                />
              </template>
              <template #body-cell-balance="props">
                <q-td :props="props">{{ money(props.row.balance) }}</q-td>
              </template>
              <template #body-cell-updatedAt="props">
                <q-td :props="props">{{ dateTimeText(props.row.updatedAt) }}</q-td>
              </template>
              <template #body-cell-actions="props">
                <q-td :props="props" align="right">
                  <q-btn flat dense round icon="edit" color="primary" size="sm" @click="openFundDialog(props.row)">
                    <q-tooltip>แก้ไข</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card>
        </q-tab-panel>

        <q-tab-panel name="settings" class="q-pa-none">
          <q-card flat class="panel-card panel-card--flush q-mt-md">
            <div class="panel-head">
              <div>
                <div class="panel-title">ตั้งค่าระบบ</div>
                <div class="panel-caption">ค่ากลางที่ backend ใช้กำกับเงื่อนไขสำคัญ</div>
              </div>
              <q-btn unelevated no-caps icon="add" label="เพิ่มค่า" color="positive" @click="openSettingDialog()" />
            </div>

            <q-table
              flat
              row-key="id"
              class="muni-table"
              v-model:pagination="tablePagination.settings"
              :rows="settingRows"
              :columns="settingColumns"
              :loading="store.loading"
              :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
              @request="(request) => onTableRequest('settings', request)"
            >
              <template #pagination="scope">
                <MidTablePagination
                  :pagination="scope.pagination"
                  :pages-number="scope.pagesNumber"
                />
              </template>
              <template #body-cell-valueType="props">
                <q-td :props="props"><q-badge color="blue-grey-6">{{ props.row.valueType }}</q-badge></q-td>
              </template>
              <template #body-cell-updatedAt="props">
                <q-td :props="props">{{ dateTimeText(props.row.updatedAt) }}</q-td>
              </template>
              <template #body-cell-actions="props">
                <q-td :props="props" align="right">
                  <div class="action-btns" style="justify-content: flex-end">
                    <q-btn flat dense round icon="edit" color="primary" size="sm" @click="openSettingDialog(props.row)">
                      <q-tooltip>แก้ไข</q-tooltip>
                    </q-btn>
                    <q-btn flat dense round icon="delete" color="red-7" size="sm" @click="deleteSetting(props.row.id)">
                      <q-tooltip>ลบค่า</q-tooltip>
                    </q-btn>
                  </div>
                </q-td>
              </template>
            </q-table>
          </q-card>
        </q-tab-panel>

        <q-tab-panel name="roles" class="q-pa-none">
          <q-card flat class="panel-card panel-card--flush q-mt-md">
            <div class="panel-head">
              <div>
                <div class="panel-title">บทบาทผู้ใช้งาน</div>
                <div class="panel-caption">อ่านจาก backend role guard ปัจจุบัน ยังไม่มี dynamic permission matrix</div>
              </div>
            </div>
            <q-table
              flat
              row-key="id"
              class="muni-table"
              :rows="store.roles"
              :columns="roleColumns"
              :loading="store.loading"
              v-model:pagination="rolePagination"
              :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
            >
              <template #pagination="scope">
                <MidTablePagination
                  :pagination="scope.pagination"
                  :pages-number="scope.pagesNumber"
                />
              </template>
            </q-table>
          </q-card>
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <q-dialog v-model="showPriceDialog" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon"><q-icon name="price_change" /></div>
            เพิ่มประวัติราคา
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>
        <div class="dialog-body">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="dialog-section-label">ประเภทขยะ</div>
              <q-select v-model="priceForm.wasteTypeId" outlined dense emit-value map-options :options="wasteOptions" />
            </div>
            <div class="col-12 col-md-6">
              <div class="dialog-section-label">ผู้รับซื้อ</div>
              <q-select
                v-model="priceForm.buyerId"
                outlined
                dense
                clearable
                emit-value
                map-options
                :options="buyerOptions"
              />
            </div>
            <div class="col-12 col-md-4">
              <div class="dialog-section-label">ราคา</div>
              <q-input v-model.number="priceForm.price" outlined dense type="number" min="0" step="0.01" />
            </div>
            <div class="col-12 col-md-4">
              <div class="dialog-section-label">เริ่มใช้</div>
              <MidDateField v-model="priceForm.effectiveFrom" />
            </div>
            <div class="col-12 col-md-4">
              <div class="dialog-section-label">สิ้นสุด</div>
              <MidDateField v-model="priceForm.effectiveTo" />
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <q-btn outline label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn unelevated label="บันทึกราคา" color="positive" icon="save" :loading="saving" @click="savePrice" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showFundDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon"><q-icon name="account_balance" /></div>
            {{ fundForm.id ? 'แก้ไขบัญชีกองทุน' : 'เพิ่มบัญชีกองทุน' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>
        <div class="dialog-body">
          <div class="dialog-section-label">ชื่อบัญชี</div>
          <q-input v-model="fundForm.accountName" outlined dense class="q-mb-md" />
          <div class="dialog-section-label">ยอดคงเหลือ</div>
          <q-input v-model.number="fundForm.balance" outlined dense type="number" min="0" step="0.01" />
        </div>
        <div class="dialog-footer">
          <q-btn outline label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn unelevated label="บันทึกบัญชี" color="positive" icon="save" :loading="saving" @click="saveFund" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showSettingDialog" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon"><q-icon name="settings" /></div>
            {{ settingForm.id ? 'แก้ไขค่าระบบ' : 'เพิ่มค่าระบบ' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>
        <div class="dialog-body">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-7">
              <div class="dialog-section-label">Key</div>
              <q-input v-model="settingForm.settingKey" outlined dense :disable="Boolean(settingForm.id)" />
            </div>
            <div class="col-12 col-md-5">
              <div class="dialog-section-label">ชนิดค่า</div>
              <q-select v-model="settingForm.valueType" outlined dense emit-value map-options :options="settingTypeOptions" />
            </div>
            <div class="col-12">
              <div class="dialog-section-label">Value</div>
              <q-input v-model="settingForm.settingValue" outlined dense autogrow />
            </div>
            <div class="col-12">
              <div class="dialog-section-label">คำอธิบาย</div>
              <q-input v-model="settingForm.description" outlined dense autogrow />
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <q-btn outline label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn unelevated label="บันทึกค่า" color="positive" icon="save" :loading="saving" @click="saveSetting" />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { QTableColumn } from 'quasar';
import {
  useAdminMasterDataStore,
  type FundAccountMaster,
  type MasterFilters,
  type RoleMaster,
  type SystemSettingMaster,
  type WastePriceHistoryMaster,
} from 'src/stores/adminMasterDataStore';
import { useWasteTypesStore } from 'src/stores/wasteTypeStore';
import {
  MidDateField,
  MidTablePagination,
  midNotify,
  useRememberedPagination,
  savedRowsPerPage,
  rememberRowsPerPage,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const rolePagination = useRememberedPagination('admin-master-data-roles', { rowsPerPage: 10 });

const store = useAdminMasterDataStore();
const wasteStore = useWasteTypesStore();

const activeTab = ref<'price' | 'fund' | 'settings' | 'roles'>('price');
const saving = ref(false);
const showPriceDialog = ref(false);
const showFundDialog = ref(false);
const showSettingDialog = ref(false);

const today = new Date().toISOString().slice(0, 10);
const priceRows = computed(() => store.priceHistory?.items ?? []);
const fundRows = computed(() => store.fundAccounts?.items ?? []);
const settingRows = computed(() => store.settings?.items ?? []);

// The three history-style tables are paged and sorted on the server.
type PagedTab = 'price' | 'fund' | 'settings';
interface TablePagination {
  page: number;
  rowsPerPage: number;
  rowsNumber: number;
  sortBy: string | null;
  descending: boolean;
}
function firstPage(): TablePagination {
  return { page: 1, rowsPerPage: 10, rowsNumber: 0, sortBy: null, descending: false };
}
// Each tab's table remembers its own rows per page.
function rememberedFirstPage(tab: PagedTab): TablePagination {
  return { ...firstPage(), rowsPerPage: savedRowsPerPage(`admin-master-data-${tab}`, 10) };
}
const tablePagination = ref<Record<PagedTab, TablePagination>>({
  price: rememberedFirstPage('price'),
  fund: rememberedFirstPage('fund'),
  settings: rememberedFirstPage('settings'),
});
for (const tab of ['price', 'fund', 'settings'] as const) {
  rememberRowsPerPage(`admin-master-data-${tab}`, () => tablePagination.value[tab].rowsPerPage);
}

function pagedQuery(tab: PagedTab): MasterFilters {
  const { page, rowsPerPage, sortBy, descending } = tablePagination.value[tab];
  return { page, pageSize: rowsPerPage, ...(sortBy ? { sortBy, descending } : {}) };
}

// Totals follow the store, which also reloads after a save or delete.
watch(
  () => [store.priceHistory?.total, store.fundAccounts?.total, store.settings?.total],
  ([price, fund, settings]) => {
    tablePagination.value.price.rowsNumber = price ?? 0;
    tablePagination.value.fund.rowsNumber = fund ?? 0;
    tablePagination.value.settings.rowsNumber = settings ?? 0;
  },
  { immediate: true },
);

function onTableRequest(
  tab: PagedTab,
  request: {
    pagination: { page: number; rowsPerPage: number; sortBy: string | null; descending: boolean };
  },
) {
  Object.assign(tablePagination.value[tab], request.pagination);
  void loadTab(tab);
}
const wasteOptions = computed(() =>
  wasteStore.wasteTypes.map((item) => ({ label: `${item.name} (${item.unit ?? 'kg'})`, value: Number(item.id) })),
);
const buyerOptions = computed(() =>
  (store.buyers?.items ?? [])
    .filter((item) => item.status === 'active')
    .map((item) => ({ label: item.buyerName, value: item.id })),
);

const priceForm = ref({ wasteTypeId: 0, buyerId: null as number | null, price: 0, effectiveFrom: today, effectiveTo: '' });
const fundForm = ref<Partial<FundAccountMaster> & { accountName: string; balance: number }>({ accountName: '', balance: 0 });
const settingForm = ref<Partial<SystemSettingMaster> & { settingKey: string; settingValue: string; valueType: string }>({
  settingKey: '',
  settingValue: '',
  valueType: 'string',
});

const priceColumns: QTableColumn<WastePriceHistoryMaster>[] = [
  { name: 'wasteType', label: 'ประเภทขยะ', field: () => '', align: 'left', sortable: true },
  { name: 'buyer', label: 'ผู้รับซื้อ', field: () => '', align: 'left' },
  { name: 'price', label: 'ราคา', field: 'price', align: 'right', sortable: true },
  { name: 'effectiveFrom', label: 'เริ่มใช้', field: 'effectiveFrom', align: 'left', sortable: true },
  { name: 'effectiveTo', label: 'สิ้นสุด', field: 'effectiveTo', align: 'left' },
];

const fundColumns: QTableColumn<FundAccountMaster>[] = [
  { name: 'accountName', label: 'ชื่อบัญชี', field: 'accountName', align: 'left', sortable: true },
  { name: 'balance', label: 'ยอดคงเหลือ', field: 'balance', align: 'right', sortable: true },
  { name: 'updatedAt', label: 'อัปเดตล่าสุด', field: 'updatedAt', align: 'left' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

const settingColumns: QTableColumn<SystemSettingMaster>[] = [
  { name: 'settingKey', label: 'Key', field: 'settingKey', align: 'left', sortable: true },
  { name: 'settingValue', label: 'Value', field: 'settingValue', align: 'left' },
  { name: 'valueType', label: 'ชนิด', field: 'valueType', align: 'left' },
  { name: 'description', label: 'คำอธิบาย', field: (row) => row.description ?? '-', align: 'left' },
  { name: 'updatedAt', label: 'อัปเดตล่าสุด', field: 'updatedAt', align: 'left' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

const roleColumns: QTableColumn<RoleMaster>[] = [
  { name: 'roleName', label: 'บทบาท', field: 'roleName', align: 'left', sortable: true },
  { name: 'description', label: 'คำอธิบาย', field: (row) => row.description ?? '-', align: 'left' },
];

const settingTypeOptions = [
  { label: 'ข้อความ', value: 'string' },
  { label: 'ตัวเลข', value: 'number' },
  { label: 'ใช่/ไม่ใช่', value: 'boolean' },
  { label: 'JSON', value: 'json' },
];

function money(value: number) {
  return Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateText(value: string) {
  return new Date(value).toLocaleDateString('th-TH');
}

function dateTimeText(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function notifyLoadError() {
  midNotify({ type: 'error', message: 'โหลดข้อมูลพื้นฐานไม่สำเร็จ' });
}

async function loadTab(tab = activeTab.value) {
  try {
    if (tab === 'price') {
      await Promise.all([
        store.fetchPriceHistory(pagedQuery('price')),
        // Options for the price form's buyer select, not a table.
        store.fetchBuyers({ page: 1, pageSize: 100 }),
        wasteStore.fetchWasteTypes(),
      ]);
    } else if (tab === 'fund') {
      await store.fetchFundAccounts(pagedQuery('fund'));
    } else if (tab === 'settings') {
      await store.fetchSettings(pagedQuery('settings'));
    } else {
      await store.fetchRoles();
    }
  } catch {
    notifyLoadError();
  }
}

function openPriceDialog() {
  priceForm.value = {
    wasteTypeId: wasteOptions.value[0]?.value ?? 0,
    buyerId: null,
    price: 0,
    effectiveFrom: today,
    effectiveTo: '',
  };
  showPriceDialog.value = true;
}

function openFundDialog(row?: FundAccountMaster) {
  fundForm.value = row ? { ...row } : { accountName: '', balance: 0 };
  showFundDialog.value = true;
}

function openSettingDialog(row?: SystemSettingMaster) {
  settingForm.value = row
    ? { ...row }
    : { settingKey: '', settingValue: '', valueType: 'string', description: '' };
  showSettingDialog.value = true;
}

async function savePrice() {
  if (!priceForm.value.wasteTypeId || Number(priceForm.value.price) < 0 || !priceForm.value.effectiveFrom) {
    midNotify({ type: 'warning', message: 'กรุณาระบุประเภทขยะ ราคา และวันที่เริ่มใช้' });
    return;
  }

  saving.value = true;
  try {
    const payload: {
      wasteTypeId: number;
      buyerId?: number;
      price: number;
      effectiveFrom: string;
      effectiveTo?: string;
    } = {
      wasteTypeId: priceForm.value.wasteTypeId,
      price: Number(priceForm.value.price),
      effectiveFrom: priceForm.value.effectiveFrom,
    };
    if (priceForm.value.buyerId) payload.buyerId = priceForm.value.buyerId;
    if (priceForm.value.effectiveTo) payload.effectiveTo = priceForm.value.effectiveTo;

    await store.createPriceHistory(payload);
    await wasteStore.fetchWasteTypes();
    showPriceDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกราคาแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกราคาไม่สำเร็จ' });
  } finally {
    saving.value = false;
  }
}

async function saveFund() {
  if (!fundForm.value.accountName.trim() || Number(fundForm.value.balance) < 0) {
    midNotify({ type: 'warning', message: 'กรุณาระบุชื่อบัญชีและยอดคงเหลือให้ถูกต้อง' });
    return;
  }

  saving.value = true;
  try {
    await store.saveFundAccount({
      ...fundForm.value,
      balance: Number(fundForm.value.balance),
    });
    showFundDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกบัญชีกองทุนแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกบัญชีกองทุนไม่สำเร็จ' });
  } finally {
    saving.value = false;
  }
}

async function saveSetting() {
  if (!settingForm.value.settingKey.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุ key ของค่าระบบ' });
    return;
  }

  saving.value = true;
  try {
    await store.saveSetting(settingForm.value);
    showSettingDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกค่าระบบแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกค่าระบบไม่สำเร็จ' });
  } finally {
    saving.value = false;
  }
}

async function deleteSetting(id: number) {
  try {
    await store.deleteSetting(id);
    midNotify({ type: 'success', message: 'ลบค่าระบบแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ลบค่าระบบไม่สำเร็จ' });
  }
}

watch(activeTab, (tab) => {
  void loadTab(tab);
});

onMounted(() => {
  void loadTab();
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.dashboard-hero {
  min-height: 148px;
}

.master-tabs {
  background: #ffffff;
  border: 1px solid #e4ece7;
  border-radius: 8px;
  overflow-x: auto;
}

.transparent-panels {
  background: transparent;
}
</style>
