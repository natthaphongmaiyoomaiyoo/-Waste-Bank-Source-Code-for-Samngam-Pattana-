<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>
        <div class="hero-row">
          <div class="hero-icon"><q-icon name="storefront" /></div>
          <div class="hero-copy">
            <h1>จัดการผู้รับซื้อ</h1>
          </div>
          <q-btn unelevated no-caps icon="add_business" label="เพิ่มผู้รับซื้อ" class="hero-add-btn" @click="openAdd" />
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายชื่อผู้รับซื้อ"
          caption="ผู้รับซื้อที่ใช้กำหนดรอบรับซื้อและราคาตามร้าน"
          v-model:search="search"
          search-placeholder="ค้นหาร้าน ผู้ติดต่อ เบอร์โทร"
        />

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :grid="$q.screen.lt.sm"
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
            <AdminGridCard
              :title="props.row.buyerName"
              :badge-text="props.row.status === 'active' ? 'ใช้งาน' : 'ระงับ'"
              :badge-color="props.row.status === 'active' ? 'green-2' : 'grey-3'"
              :badge-text-color="props.row.status === 'active' ? 'green-9' : 'grey-8'"
              :rows="[
                { label: 'ผู้ติดต่อ', value: props.row.contactName },
                { label: 'เบอร์โทร', value: props.row.phone },
                { label: 'ที่อยู่', value: props.row.address },
              ]"
            >
              <template #actions>
                <q-btn unelevated no-caps icon="edit" label="แก้ไข" class="is-edit" @click="openEdit(props.row)" />
                <q-btn
                  unelevated
                  no-caps
                  icon="delete"
                  label="ระงับการใช้งาน"
                  class="is-cancel"
                  @click="deleteBuyer(props.row)"
                />
              </template>
            </AdminGridCard>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="props.row.status === 'active' ? 'green-2' : 'grey-3'"
                :text-color="props.row.status === 'active' ? 'green-9' : 'grey-8'"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ props.row.status === 'active' ? 'ใช้งาน' : 'ระงับ' }}
              </q-badge>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" align="right">
              <div class="action-btns" style="justify-content: flex-end">
                <q-btn flat dense round icon="edit" color="primary" size="sm" @click="openEdit(props.row)">
                  <q-tooltip>แก้ไข</q-tooltip>
                </q-btn>
                <q-btn flat dense round icon="delete" color="red-7" size="sm" @click="deleteBuyer(props.row)">
                  <q-tooltip>ระงับการใช้งาน</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>

    <q-dialog v-model="showDialog" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEdit ? 'edit' : 'add_business'" />
            </div>
            {{ isEdit ? 'แก้ไขผู้รับซื้อ' : 'เพิ่มผู้รับซื้อ' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <q-input
              v-model="form.buyerName"
              outlined
              dense
              class="span-6"
              label="ชื่อร้าน/ผู้รับซื้อ *"
            >
              <template #prepend><q-icon name="storefront" /></template>
            </q-input>
            <q-input v-model="form.contactName" outlined dense class="span-6" label="ผู้ติดต่อ">
              <template #prepend><q-icon name="person" /></template>
            </q-input>
            <q-input v-model="form.phone" outlined dense class="span-6" label="เบอร์โทร">
              <template #prepend><q-icon name="call" /></template>
            </q-input>
            <q-select
              v-model="form.status"
              outlined
              dense
              emit-value
              map-options
              class="span-6"
              label="สถานะ"
              :options="[
                { label: 'ใช้งาน', value: 'active' },
                { label: 'ระงับ', value: 'inactive' },
              ]"
            />
            <q-input v-model="form.address" outlined dense autogrow class="span-12" label="ที่อยู่">
              <template #prepend><q-icon name="place" /></template>
            </q-input>
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
            @click="saveBuyer"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import { debounce, useQuasar, type QTableColumn } from 'quasar';
import { useAdminMasterDataStore, type BuyerMaster } from 'src/stores/adminMasterDataStore';
import {
  MidTablePagination,
  midConfirm,
  midNotify,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const store = useAdminMasterDataStore();
const $q = useQuasar();

const rows = computed(() => store.buyers?.items ?? []);
const search = ref('');
const showDialog = ref(false);
const isEdit = ref(false);
const saving = ref(false);

const columns: QTableColumn<BuyerMaster>[] = [
  { name: 'buyerName', label: 'ชื่อผู้รับซื้อ', field: 'buyerName', align: 'left', sortable: true },
  { name: 'contactName', label: 'ผู้ติดต่อ', field: (row) => row.contactName ?? '-', align: 'left' },
  { name: 'phone', label: 'เบอร์โทร', field: (row) => row.phone ?? '-', align: 'left' },
  { name: 'address', label: 'ที่อยู่', field: (row) => row.address ?? '-', align: 'left' },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'center' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'right' },
];

const form = ref<Partial<BuyerMaster> & { buyerName: string }>({
  buyerName: '',
  status: 'active',
});

function emptyForm() {
  return {
    buyerName: '',
    contactName: '',
    phone: '',
    address: '',
    status: 'active',
  };
}

function openAdd() {
  isEdit.value = false;
  form.value = emptyForm();
  showDialog.value = true;
}

function openEdit(row: BuyerMaster) {
  isEdit.value = true;
  form.value = { ...row };
  showDialog.value = true;
}

// Paged, searched and sorted on the server - the table never holds more than
// the page on screen.
const pagination = useRememberedPagination('admin-buyers', {
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
  sortBy: null as string | null,
  descending: false,
});

async function loadRows() {
  const { page, rowsPerPage, sortBy, descending } = pagination.value;
  try {
    await store.fetchBuyers({
      page,
      pageSize: rowsPerPage,
      ...(search.value?.trim() ? { search: search.value.trim() } : {}),
      ...(sortBy ? { sortBy, descending } : {}),
    });
  } catch {
    midNotify({ type: 'error', message: 'โหลดข้อมูลผู้รับซื้อไม่สำเร็จ' });
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
  () => store.buyers?.total,
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

async function saveBuyer() {
  if (!form.value.buyerName.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุชื่อผู้รับซื้อ' });
    return;
  }

  saving.value = true;
  try {
    await store.saveBuyer(form.value);
    showDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกผู้รับซื้อแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกผู้รับซื้อไม่สำเร็จ' });
  } finally {
    saving.value = false;
  }
}

// The delete button suspends the buyer (status inactive) - nothing is removed.
async function deleteBuyer(buyer: BuyerMaster) {
  const confirmed = await midConfirm({
    title: 'ยืนยันการระงับผู้รับซื้อ',
    message: 'ต้องการระงับผู้รับซื้อรายนี้ใช่หรือไม่?',
    item: {
      name: buyer.buyerName,
      details: [
        buyer.contactName ? `ผู้ติดต่อ ${buyer.contactName}` : null,
        buyer.phone ? `โทร ${buyer.phone}` : null,
      ],
    },
    tone: 'danger',
    confirmLabel: 'ระงับ',
  });
  if (!confirmed) return;
  try {
    await store.deleteBuyer(buyer.id);
    midNotify({ type: 'success', message: 'ระงับผู้รับซื้อแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ระงับผู้รับซื้อไม่สำเร็จ' });
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;
</style>
