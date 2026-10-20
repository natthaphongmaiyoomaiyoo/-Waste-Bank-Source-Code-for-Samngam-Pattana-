<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="local_shipping" />
          </div>
          <div class="hero-copy">
            <h1>จัดการประเภทขยะ</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เพิ่มประเภทขยะ"
            class="hero-add-btn"
            @click="openAdd"
          />
        </div>
      </section>

      <!-- Buyer proposals waiting on a decision. Members do not see these types
           until they are approved here. -->
      <q-card
        v-if="wasteStore.proposalsLoading || wasteStore.proposals.length"
        flat
        class="panel-card panel-card--flush q-mt-lg"
      >
        <AdminPanelHeader
          title="คำขอเพิ่มประเภทขยะจากผู้รับซื้อ"
          caption="อนุมัติแล้วสมาชิกจึงจะเห็นประเภทขยะนี้"
        >
          <template #actions v-if="wasteStore.proposals.length">
            <q-badge color="amber-8">{{ wasteStore.proposals.length }}</q-badge>
          </template>
        </AdminPanelHeader>

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :grid="true"
          :rows="wasteStore.proposals"
          :columns="proposalColumns"
          :loading="wasteStore.proposalsLoading"
          v-model:pagination="proposalPagination"
          :rows-per-page-options="proposalRowsOptions"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <div class="q-pa-sm col-12 col-sm-6 col-md-4">
              <q-card class="proposal-card flat bordered" style="border-radius: 12px; height: 100%; display: flex; flex-direction: column;">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center no-wrap justify-between">
                    <div class="text-subtitle1 text-weight-bold ellipsis" style="max-width: 180px;">
                      {{ props.row.name }}
                    </div>
                    <q-badge color="amber-1" text-color="amber-9">คำขอใหม่</q-badge>
                  </div>
                </q-card-section>
                <q-separator />
                <q-card-section class="q-py-sm col-grow text-caption text-grey-8">
                  <div>เสนอโดย: <span class="text-weight-medium">{{ props.row.proposerName || '-' }}</span></div>
                  <div v-if="props.row.price !== undefined" class="q-mt-xs">
                    ราคาที่เสนอ: <span class="text-weight-bold text-positive">{{ props.row.price.toFixed(2) }}</span> บาท / {{ props.row.unit || 'กก.' }}
                  </div>
                </q-card-section>
                <q-separator />
                <q-card-actions align="right" class="q-px-md q-py-xs bg-grey-1">
                  <q-btn unelevated dense no-caps size="sm" color="positive" icon="check" label="อนุมัติ" :loading="reviewingId === props.row.id" @click="openApprove(props.row)" />
                  <q-btn outline dense no-caps size="sm" color="red-7" icon="close" label="ไม่อนุมัติ" :disable="reviewingId === props.row.id" @click="openReject(props.row)" />
                </q-card-actions>
              </q-card>
            </div>
          </template>

          <template #body-cell-price="props">
            <q-td :props="props">
              <span class="text-weight-bold">{{ props.row.price.toFixed(2) }}</span>
            </q-td>
          </template>

          <template #body-cell-unit="props">
            <q-td :props="props">
              <q-badge color="green-1" text-color="green-9">{{ props.row.unit || 'kg' }}</q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props">
              <div class="action-btns" style="justify-content: center">
                <q-btn
                  unelevated
                  dense
                  no-caps
                  size="sm"
                  color="positive"
                  icon="check"
                  label="อนุมัติ"
                  :loading="reviewingId === props.row.id"
                  @click="openApprove(props.row)"
                />
                <q-btn
                  outline
                  dense
                  no-caps
                  size="sm"
                  color="red-7"
                  icon="close"
                  label="ไม่อนุมัติ"
                  :disable="reviewingId === props.row.id"
                  @click="openReject(props.row)"
                />
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state" v-if="!wasteStore.loading">
              <q-icon name="inbox" size="32px" />
              ไม่มีคำขอที่รออนุมัติ
            </div>
          </template>
        </q-table>
      </q-card>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายการประเภทขยะ"
          :caption="`ทั้งหมด ${categories.length} รายการ`"
          v-model:search="search"
          search-placeholder="ค้นหาประเภทขยะ"
        />

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :grid="true"
          :rows="categories"
          :columns="columns"
          :loading="wasteStore.loading"
          v-model:pagination="categoryPagination"
          :rows-per-page-options="categoryRowsOptions"
          :filter="search"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <div class="q-pa-sm col-12 col-sm-6 col-md-4 col-lg-3">
              <q-card class="waste-type-card flat bordered" style="border-radius: 12px; height: 100%; display: flex; flex-direction: column;">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center no-wrap justify-between">
                    <div class="row items-center no-wrap">
                      <q-avatar size="38px" color="green-1" text-color="positive" icon="recycling" class="q-mr-sm" />
                      <div class="text-subtitle1 text-weight-bold ellipsis" style="max-width: 150px;">
                        {{ props.row.name }}
                      </div>
                    </div>
                    <q-badge color="green-1" text-color="green-9" class="q-py-xs q-px-sm text-caption">
                      {{ props.row.unit || 'กก.' }}
                    </q-badge>
                  </div>
                </q-card-section>
                <q-separator />
                <q-card-section class="q-py-md col-grow">
                  <div class="text-caption text-grey-6">ราคารับซื้อกลาง</div>
                  <div class="row items-baseline q-mt-xs">
                    <span class="text-h5 text-weight-bolder text-positive">
                      {{ props.row.price !== undefined ? props.row.price.toFixed(2) : '0.00' }}
                    </span>
                    <span class="text-body2 text-grey-7 q-ml-xs">บาท / {{ props.row.unit || 'กก.' }}</span>
                  </div>
                </q-card-section>
                <q-separator />
                <q-card-actions align="right" class="q-px-md q-py-xs bg-grey-1">
                  <q-btn flat dense round size="sm" icon="edit" color="primary" @click="openEdit(props.row)">
                    <q-tooltip>แก้ไขราคา/ข้อมูล</q-tooltip>
                  </q-btn>
                  <q-btn flat dense round size="sm" icon="delete" color="red-7" @click="deleteCategory(props.row)">
                    <q-tooltip>ลบประเภทขยะ</q-tooltip>
                  </q-btn>
                </q-card-actions>
              </q-card>
            </div>
          </template>

          <template #body-cell-price="props">
            <q-td :props="props">
              <span class="text-weight-bold text-positive">{{ props.row.price.toFixed(2) }}</span>
            </q-td>
          </template>

          <template #body-cell-unit="props">
            <q-td :props="props">
              <q-badge color="green-1" text-color="green-9">{{ props.row.unit || 'kg' }}</q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props">
              <div class="action-btns" style="justify-content: center">
                <q-btn flat dense round size="sm" icon="edit" color="primary" @click="openEdit(props.row)">
                  <q-tooltip>แก้ไข</q-tooltip>
                </q-btn>
                <q-btn flat dense round size="sm" icon="delete" color="red-7" @click="deleteCategory(props.row)">
                  <q-tooltip>ลบ</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state" v-if="!wasteStore.loading">
              <q-icon name="inbox" size="32px" />
              ยังไม่มีข้อมูลประเภทขยะ
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <q-dialog v-model="showDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEdit ? 'edit' : 'add'" />
            </div>
            {{ isEdit ? 'แก้ไขประเภทขยะ' : 'เพิ่มประเภทขยะ' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <q-input
              v-model="form.name"
              outlined
              dense
              class="span-12"
              label="ชื่อประเภทขยะ *"
              placeholder="ระบุชื่อประเภทขยะ"
            />
            <q-select
              v-model="form.unit"
              outlined
              dense
              emit-value
              map-options
              class="span-6"
              label="หน่วย"
              :options="unitOptions"
            />
            <q-input
              v-model.number="form.price"
              outlined
              dense
              type="number"
              class="span-6"
              label="ราคารับซื้อ (บาท / หน่วย)"
              placeholder="0.00"
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
            @click="saveCategory"
          />
        </div>
      </q-card>
    </q-dialog>

    <!-- Approving publishes the type; the admin may correct the buyer's
         suggested price first. -->
    <q-dialog v-model="showApproveDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon name="check_circle" />
            </div>
            อนุมัติประเภทขยะ
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <q-banner rounded class="hint-banner q-mb-md">
            <template #avatar><q-icon name="storefront" color="green-8" /></template>
            เสนอโดย {{ reviewTarget?.proposerName || '-' }} แก้ไขชื่อหรือราคาได้ก่อนอนุมัติ
          </q-banner>

          <div class="form-grid">
            <q-input
              v-model="reviewForm.name"
              outlined
              dense
              class="span-12"
              label="ชื่อประเภทขยะ *"
            />
            <q-select
              v-model="reviewForm.unit"
              outlined
              dense
              emit-value
              map-options
              class="span-6"
              label="หน่วย"
              :options="unitOptions"
            />
            <q-input
              v-model.number="reviewForm.price"
              outlined
              dense
              type="number"
              class="span-6"
              label="ราคารับซื้อ (บาท / หน่วย)"
            />
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn
            unelevated
            no-caps
            label="อนุมัติ"
            color="positive"
            icon="check"
            :loading="reviewingId !== null"
            @click="confirmApprove"
          />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showRejectDialog" persistent>
      <q-card class="admin-dialog dialog-sm">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon danger-icon">
              <q-icon name="cancel" />
            </div>
            ไม่อนุมัติประเภทขยะ
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="dialog-message q-mb-md">
            ไม่อนุมัติ <b>"{{ reviewTarget?.name }}"</b> ที่เสนอโดย
            {{ reviewTarget?.proposerName || '-' }}
          </div>

          <q-input
            v-model="rejectReason"
            outlined
            dense
            type="textarea"
            rows="3"
            label="เหตุผล (ผู้รับซื้อจะเห็นข้อความนี้) *"
            placeholder="ระบุเหตุผลที่ไม่อนุมัติ"
          />
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn
            unelevated
            no-caps
            label="ไม่อนุมัติ"
            color="negative"
            icon="close"
            :loading="reviewingId !== null"
            @click="confirmReject"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import { ref, computed, onMounted } from 'vue';
import { useWasteTypesStore, type WasteTypeProposal } from 'stores/wasteTypeStore';
import type { WasteTypes } from 'stores/models';
import type { QTableColumn } from 'quasar';
import {
  MidTablePagination,
  midConfirm,
  midNotify,
  useRememberedPagination,
  midRowsPerPageOptions,
} from 'components/MID';

const proposalPagination = useRememberedPagination('admin-waste-proposals', { rowsPerPage: 6 });
const categoryPagination = useRememberedPagination('admin-waste-categories', { rowsPerPage: 12 });
// 5/10/20/50 plus each grid's own default.
const proposalRowsOptions = midRowsPerPageOptions(6);
const categoryRowsOptions = midRowsPerPageOptions(12);

const wasteStore = useWasteTypesStore();

const categories = computed(() => wasteStore.wasteTypes);
const showDialog = ref(false);
const search = ref('');
const isEdit = ref(false);
const saving = ref(false);

const columns: QTableColumn<WasteTypes>[] = [
  { name: 'name', label: 'ประเภทขยะ', field: 'name', align: 'left', style: 'width: 40%' },
  { name: 'unit', label: 'หน่วย', field: 'unit', align: 'center', style: 'width: 20%; min-width: 100px;' },
  { name: 'price', label: 'ราคา (บาท / หน่วย)', field: 'price', align: 'center', style: 'width: 20%' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'center', style: 'width: 20%' },
];

const proposalColumns: QTableColumn<WasteTypeProposal>[] = [
  { name: 'name', label: 'ประเภทขยะ', field: 'name', align: 'left', style: 'width: 30%' },
  { name: 'unit', label: 'หน่วย', field: 'unit', align: 'center', style: 'width: 15%' },
  { name: 'price', label: 'ราคาที่เสนอ (บาท / หน่วย)', field: 'price', align: 'center', style: 'width: 20%' },
  { name: 'proposerName', label: 'เสนอโดย', field: 'proposerName', align: 'left', style: 'width: 20%' },
  { name: 'actions', label: 'จัดการ', field: 'id', align: 'center', style: 'width: 15%' },
];

const unitOptions = [
  { label: 'กิโลกรัม (kg)', value: 'kg' },
  { label: 'ชิ้น', value: 'piece' },
  { label: 'ถุง', value: 'bag' },
];

const form = ref<WasteTypes>({
  id: 0,
  name: '',
  price: 0,
  unit: 'kg',
});

function openAdd() {
  isEdit.value = false;
  form.value = { id: 0, name: '', price: 0, unit: 'kg' };
  showDialog.value = true;
}

// function fillMockData() {
//   form.value.name = 'ขวดพลาสติกใส PET';
//   form.value.price = 12.5;
//   form.value.unit = 'kg';
// }

function openEdit(row: WasteTypes) {
  isEdit.value = true;
  form.value = { ...row };
  showDialog.value = true;
}

onMounted(() => {
  void wasteStore.fetchWasteTypes().catch(() => {
    midNotify({ type: 'error', message: wasteStore.error ?? 'ไม่สามารถโหลดประเภทขยะได้' });
  });
  void wasteStore.fetchProposals('pending').catch(() => {
    midNotify({ type: 'error', message: 'ไม่สามารถโหลดคำขอเพิ่มประเภทขยะได้' });
  });
});

// --- Buyer proposal review ---

const showApproveDialog = ref(false);
const showRejectDialog = ref(false);
const reviewTarget = ref<WasteTypeProposal | null>(null);
const reviewingId = ref<number | null>(null);
const reviewForm = ref({ name: '', price: 0, unit: 'kg' });
const rejectReason = ref('');

function openApprove(row: WasteTypeProposal) {
  reviewTarget.value = row;
  reviewForm.value = { name: row.name, price: row.price, unit: row.unit || 'kg' };
  showApproveDialog.value = true;
}

function openReject(row: WasteTypeProposal) {
  reviewTarget.value = row;
  rejectReason.value = '';
  showRejectDialog.value = true;
}

async function confirmApprove() {
  const target = reviewTarget.value;
  if (!target) return;

  if (!reviewForm.value.name.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุชื่อประเภทขยะ' });
    return;
  }

  reviewingId.value = target.id;
  try {
    await wasteStore.approveProposal(target.id, {
      name: reviewForm.value.name.trim(),
      price: Number(reviewForm.value.price),
      unit: reviewForm.value.unit || 'kg',
    });
    showApproveDialog.value = false;
    midNotify({ type: 'success', message: 'อนุมัติประเภทขยะแล้ว สมาชิกเห็นได้ทันที' });
  } catch {
    midNotify({ type: 'error', message: 'อนุมัติไม่สำเร็จ' });
  } finally {
    reviewingId.value = null;
  }
}

async function confirmReject() {
  const target = reviewTarget.value;
  if (!target) return;

  if (!rejectReason.value.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' });
    return;
  }

  reviewingId.value = target.id;
  try {
    await wasteStore.rejectProposal(target.id, rejectReason.value.trim());
    showRejectDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกผลไม่อนุมัติแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกไม่สำเร็จ' });
  } finally {
    reviewingId.value = null;
  }
}

async function saveCategory() {
  const newName = form.value.name.trim();
  if (!newName) {
    midNotify({ type: 'warning', message: 'กรุณาระบุชื่อประเภทขยะ' });
    return;
  }

  const isDuplicate = wasteStore.wasteTypes.some(
    (w) => w.name === newName && w.id !== form.value.id
  );
  if (isDuplicate) {
    midNotify({ type: 'warning', message: 'มีประเภทขยะนี้ในระบบแล้ว' });
    return;
  }

  saving.value = true;
  try {
    if (isEdit.value) {
      await wasteStore.updateWasteType(
        form.value.id,
        form.value.name.trim(),
        Number(form.value.price),
        form.value.unit || 'kg',
      );
    } else {
      await wasteStore.addWasteType(form.value.name.trim(), Number(form.value.price), form.value.unit || 'kg');
    }

    showDialog.value = false;
    midNotify({ type: 'success', message: 'บันทึกประเภทขยะแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'บันทึกประเภทขยะไม่สำเร็จ' });
  } finally {
    saving.value = false;
  }
}

async function deleteCategory(wasteType: WasteTypes) {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: 'ต้องการลบประเภทขยะนี้ใช่หรือไม่?',
    item: {
      name: wasteType.name,
      details: [`ราคา ${wasteType.price.toFixed(2)} บาท / ${wasteType.unit || 'กก.'}`],
    },
    tone: 'danger',
    confirmLabel: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await wasteStore.deleteWasteType(wasteType.id);
    midNotify({ type: 'success', message: 'ลบประเภทขยะแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ลบประเภทขยะไม่สำเร็จ' });
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

.waste-type-card,
.proposal-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  }
}
</style>
