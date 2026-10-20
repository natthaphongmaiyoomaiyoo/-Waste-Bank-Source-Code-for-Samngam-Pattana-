<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>
        <div class="hero-row">
          <div class="hero-icon"><q-icon name="apartment" /></div>
          <div class="hero-copy">
            <h1>จัดการหมู่บ้าน/พื้นที่</h1>
          </div>
          <q-btn unelevated no-caps icon="add" label="เพิ่มพื้นที่" class="hero-add-btn" @click="openAdd" />
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายชื่อหมู่บ้าน/พื้นที่"
          :caption="`ทั้งหมด ${(store.villageAreas?.total ?? 0).toLocaleString()} รายการ`"
          v-model:search="search"
          search-placeholder="ค้นหาหมู่บ้าน หมู่ ตำบล"
        />

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :grid="true"
          v-model:pagination="pagination"
          :rows="rows"
          :columns="columns"
          :loading="store.loading"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <div class="q-pa-sm col-12 col-sm-6 col-md-4">
              <q-card class="village-card flat bordered" style="border-radius: 12px; height: 100%; display: flex; flex-direction: column;">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center no-wrap justify-between">
                    <div class="row items-center no-wrap">
                      <q-avatar size="38px" color="teal-1" text-color="teal-8" icon="holiday_village" class="q-mr-sm" />
                      <div>
                        <div class="text-subtitle1 text-weight-bold ellipsis" style="max-width: 160px;">
                          {{ props.row.villageName }}
                        </div>
                        <div class="text-caption text-grey-6" v-if="props.row.moo">
                          หมู่ที่ {{ props.row.moo }}
                        </div>
                      </div>
                    </div>
                    <q-badge
                      :color="props.row.status === 'active' ? 'positive' : 'grey-5'"
                      class="q-py-xs q-px-sm"
                    >
                      {{ props.row.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ' }}
                    </q-badge>
                  </div>
                </q-card-section>

                <q-separator />

                <q-card-section class="q-py-sm col-grow text-body2 text-grey-8">
                  <div class="row items-center q-mb-xs">
                    <q-icon name="place" size="18px" color="grey-6" class="q-mr-xs" />
                    <span class="ellipsis" style="max-width: 220px;">{{ addressText(props.row) }}</span>
                  </div>
                  <div class="row items-center q-mt-sm">
                    <q-toggle
                      :model-value="props.row.status === 'active'"
                      color="positive"
                      dense
                      size="sm"
                      label="สถานะการใช้งาน"
                      class="text-caption"
                      @update:model-value="(val) => void toggleStatus(props.row, val === true)"
                    />
                  </div>
                </q-card-section>

                <q-separator />

                <q-card-actions align="right" class="q-px-md q-py-xs bg-grey-1">
                  <q-btn flat dense round icon="edit" color="primary" size="sm" @click="openEdit(props.row)">
                    <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                  </q-btn>
                  <q-btn flat dense round icon="delete" color="red-7" size="sm" @click="deleteArea(props.row)">
                    <q-tooltip>ระงับ/ลบพื้นที่</q-tooltip>
                  </q-btn>
                </q-card-actions>
              </q-card>
            </div>
          </template>

          <template #body-cell-address="props">
            <q-td :props="props">{{ addressText(props.row) }}</q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props" align="center">
              <q-toggle
                :model-value="props.row.status === 'active'"
                color="positive"
                dense
                @update:model-value="(val) => void toggleStatus(props.row, val === true)"
              >
                <q-tooltip>
                  {{ props.row.status === 'active' ? 'เปิดใช้งานอยู่ - กดเพื่อปิด' : 'ปิดใช้งานอยู่ - กดเพื่อเปิด' }}
                </q-tooltip>
              </q-toggle>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" align="right">
              <div class="action-btns" style="justify-content: flex-end">
                <q-btn flat dense round icon="edit" color="primary" size="sm" @click="openEdit(props.row)">
                  <q-tooltip>แก้ไข</q-tooltip>
                </q-btn>
                <q-btn flat dense round icon="delete" color="red-7" size="sm" @click="deleteArea(props.row)">
                  <q-tooltip>ระงับการใช้งาน</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>

    <q-dialog v-model="showDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon"><q-icon name="apartment" /></div>
            {{ isEdit ? 'แก้ไขพื้นที่' : 'เพิ่มพื้นที่ใหม่' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <q-input
              v-model="form.villageName"
              outlined
              dense
              class="span-8"
              label="ชื่อหมู่บ้าน/พื้นที่ *"
            />
            <q-input v-model="form.moo" outlined dense class="span-4" label="หมู่ที่" />
            <q-input
              v-model="form.subdistrict"
              outlined
              dense
              class="span-6"
              label="ตำบล"
              @update:model-value="onSubdistrictChange"
            />
            <q-input v-model="form.district" outlined dense class="span-6" label="อำเภอ" />
            <q-input v-model="form.province" outlined dense class="span-6" label="จังหวัด" />
            <q-input
              v-model="form.postcode"
              outlined
              dense
              class="span-6"
              label="รหัสไปรษณีย์"
              @update:model-value="onPostcodeChange"
            />
            <q-select
              v-model="form.status"
              outlined
              dense
              emit-value
              map-options
              class="span-12"
              label="สถานะ"
              :options="[
                { label: 'ใช้งาน', value: 'active' },
                { label: 'ระงับ', value: 'inactive' },
              ]"
            />
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn
            unelevated
            no-caps
            label="บันทึกข้อมูล"
            color="positive"
            icon="save"
            :loading="saving"
            @click="saveArea"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import { debounce, type QTableColumn } from 'quasar';
import { searchAddress, searchByZipcode } from 'thai-address-search';
import {
  useAdminMasterDataStore,
  type VillageAreaMaster,
} from 'src/stores/adminMasterDataStore';
import {
  MidTablePagination,
  midConfirm,
  midNotify,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const store = useAdminMasterDataStore();

const rows = computed(() => store.villageAreas?.items ?? []);
const search = ref('');
const showDialog = ref(false);
const isEdit = ref(false);
const saving = ref(false);

function onSubdistrictChange(val: string | number | null) {
  if (!val || typeof val !== 'string' || val.length < 2) return;
  const matches = searchAddress(val);
  const exact = matches.find(m => m.subdistrict === val);
  if (exact) {
    if (!form.value.district) form.value.district = exact.district;
    if (!form.value.province) form.value.province = exact.province;
    if (!form.value.postcode) form.value.postcode = exact.zipcode;
  }
}

function onPostcodeChange(val: string | number | null) {
  if (!val || typeof val !== 'string' || val.length !== 5) return;
  const matches = searchByZipcode(val);
  if (matches && matches.length > 0) {
    const first = matches[0];
    if (first) {
      if (!form.value.subdistrict) form.value.subdistrict = first.subdistrict;
      if (!form.value.district) form.value.district = first.district;
      if (!form.value.province) form.value.province = first.province;
    }
  }
}

const columns: QTableColumn<VillageAreaMaster>[] = [
  { name: 'villageName', label: 'ชื่อพื้นที่', field: 'villageName', align: 'left', sortable: true },
  { name: 'moo', label: 'หมู่ที่', field: (row) => row.moo ?? '-', align: 'left', sortable: true },
  { name: 'address', label: 'ที่ตั้ง', field: () => '', align: 'left' },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'center' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

const form = ref<Partial<VillageAreaMaster> & { villageName: string }>({
  villageName: '',
  status: 'active',
});

function addressText(row: VillageAreaMaster) {
  return [row.subdistrict, row.district, row.province, row.postcode].filter(Boolean).join(' ') || '-';
}

function emptyForm() {
  return {
    villageName: '',
    moo: '',
    subdistrict: 'สามง่ามท่าโบสถ์',
    district: 'หันคา',
    province: 'ชัยนาท',
    postcode: '17130',
    status: 'active',
  };
}

function openAdd() {
  isEdit.value = false;
  form.value = emptyForm();
  showDialog.value = true;
}

// function fillMockData() {
//   form.value.villageName = 'หมู่บ้านทดสอบ';
//   form.value.moo = '99';
// }

function openEdit(row: VillageAreaMaster) {
  isEdit.value = true;
  form.value = { ...row };
  showDialog.value = true;
}

// Paged, searched and sorted on the server - the table never holds more than
// the page on screen.
const pagination = useRememberedPagination('admin-villages', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
  sortBy: null as string | null,
  descending: false,
});

async function loadRows() {
  const { page, rowsPerPage, sortBy, descending } = pagination.value;
  try {
    await store.fetchVillageAreas({
      page,
      pageSize: rowsPerPage,
      ...(search.value?.trim() ? { search: search.value.trim() } : {}),
      ...(sortBy ? { sortBy, descending } : {}),
    });
  } catch {
    midNotify({ type: 'error', message: 'โหลดข้อมูลพื้นที่ไม่สำเร็จ' });
  }
}

function onTableRequest(props: {
  pagination: { page: number; rowsPerPage: number; sortBy: string | null; descending: boolean };
}) {
  Object.assign(pagination.value, props.pagination);
  void loadRows();
}

// The total follows the store, which also reloads after a save or delete.
watch(
  () => store.villageAreas?.total,
  (total) => {
    pagination.value.rowsNumber = total ?? 0;
  },
  { immediate: true },
);

// A new search changes what the pages hold - back to page 1.
watch(
  search,
  debounce(() => {
    pagination.value.page = 1;
    void loadRows();
  }, 300),
);

onMounted(() => {
  void loadRows();
});

async function saveArea() {
  if (!form.value.villageName.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุชื่อพื้นที่' });
    return;
  }

  saving.value = true;
  try {
    await store.saveVillageArea(form.value);
    showDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกพื้นที่แล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกพื้นที่ไม่สำเร็จ' });
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: VillageAreaMaster, isActive: boolean) {
  try {
    const updated = { ...row, status: isActive ? 'active' : 'inactive' };
    await store.saveVillageArea(updated);
    midNotify({ type: 'success', message: isActive ? 'เปิดใช้งานพื้นที่แล้ว' : 'ปิดการใช้งานพื้นที่แล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'เปลี่ยนสถานะไม่สำเร็จ' });
  }
}

// The delete button suspends the area (status inactive) - nothing is removed.
async function deleteArea(area: VillageAreaMaster) {
  const address = addressText(area);
  const confirmed = await midConfirm({
    title: 'ยืนยันการระงับพื้นที่',
    message: 'ต้องการระงับพื้นที่นี้ใช่หรือไม่?',
    item: {
      name: area.villageName,
      details: [area.moo ? `หมู่ที่ ${area.moo}` : null, address === '-' ? null : address],
    },
    tone: 'danger',
    confirmLabel: 'ระงับ',
  });
  if (!confirmed) return;
  try {
    await store.deleteVillageArea(area.id);
    midNotify({ type: 'success', message: 'ระงับพื้นที่แล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ระงับพื้นที่ไม่สำเร็จ' });
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

.village-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  }
}
</style>
