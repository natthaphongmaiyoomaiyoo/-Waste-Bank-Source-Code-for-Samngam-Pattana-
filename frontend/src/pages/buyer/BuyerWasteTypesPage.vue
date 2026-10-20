<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero dashboard-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="local_shipping" />
          </div>
          <div class="hero-copy">
            <h1>ประเภทขยะและราคา</h1>
            <p>ดูรายการประเภทขยะที่ใช้อยู่ และเสนอเพิ่มประเภทใหม่พร้อมราคาประมาณ</p>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เสนอเพิ่มประเภทขยะ"
            class="hero-add-btn"
            @click="openPropose"
          />
        </div>
      </section>

      <!-- Existing catalog (approved types everyone already uses) -->
      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">รายการประเภทขยะที่ใช้อยู่</div>
            <div class="panel-caption">ประเภทที่ผ่านการอนุมัติแล้ว สมาชิกมองเห็นและเลือกขายได้</div>
          </div>
        </div>

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :rows="wasteStore.wasteTypes"
          :columns="catalogColumns"
          :loading="wasteStore.loading"
          v-model:pagination="wasteTypePagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
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

          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="inbox" size="32px" />
              ยังไม่มีข้อมูลประเภทขยะ
            </div>
          </template>
        </q-table>
      </q-card>

      <!-- What this buyer has proposed, and how each one ended up -->
      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">ประเภทขยะที่คุณเสนอ</div>
            <div class="panel-caption">
              รายการที่เสนอจะยังไม่แสดงให้สมาชิกเห็น จนกว่าผู้ดูแลระบบจะอนุมัติ
            </div>
          </div>
        </div>

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :rows="wasteStore.proposals"
          :columns="proposalColumns"
          :loading="wasteStore.proposalsLoading"
          v-model:pagination="proposalPagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
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

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-chip
                dense
                square
                :color="statusMeta(props.row.status).color"
                :text-color="statusMeta(props.row.status).textColor"
                :icon="statusMeta(props.row.status).icon"
                class="status-chip"
              >
                {{ statusMeta(props.row.status).label }}
              </q-chip>
              <div v-if="props.row.rejectReason" class="reject-reason">
                เหตุผล: {{ props.row.rejectReason }}
              </div>
            </q-td>
          </template>

          <template #body-cell-proposedAt="props">
            <q-td :props="props">
              {{ formatDate(props.row.proposedAt) }}
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="inbox" size="32px" />
              คุณยังไม่ได้เสนอประเภทขยะใหม่
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
              <q-icon name="add" />
            </div>
            เสนอเพิ่มประเภทขยะ
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <q-banner dense class="propose-note q-mb-md">
            <template #avatar>
              <q-icon name="info" color="amber-8" />
            </template>
            ประเภทขยะที่เสนอจะถูกส่งให้ผู้ดูแลระบบตรวจสอบก่อน เมื่ออนุมัติแล้วสมาชิกจึงจะเห็น
          </q-banner>

          <div class="dialog-section-label">ชื่อประเภทขยะ</div>
          <q-input
            v-model="form.name"
            placeholder="ระบุชื่อประเภทขยะ"
            outlined
            dense
            class="q-mb-md"
          />

          <div class="dialog-section-label">หน่วย</div>
          <q-select
            v-model="form.unit"
            outlined
            dense
            class="q-mb-md"
            emit-value
            map-options
            :options="unitOptions"
          />

          <div class="dialog-section-label">ราคาประมาณ (บาท / หน่วย)</div>
          <q-input v-model.number="form.price" placeholder="0.00" outlined dense type="number" />
        </div>

        <div class="dialog-footer">
          <q-btn outline label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn
            unelevated
            label="ส่งคำขอ"
            color="positive"
            icon="send"
            :loading="saving"
            @click="submitProposal"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useWasteTypesStore, type WasteTypeProposal } from 'stores/wasteTypeStore';
import type { WasteTypes } from 'stores/models';
import type { QTableColumn } from 'quasar';
import { isoToThaiLongDate } from 'components/MID/thaiDate';
import {
  MidTablePagination,
  midNotify,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';

const wasteTypePagination = useRememberedPagination('buyer-waste-types', { rowsPerPage: 10 });
const proposalPagination = useRememberedPagination('buyer-waste-proposals', { rowsPerPage: 10 });

const wasteStore = useWasteTypesStore();

const showDialog = ref(false);
const saving = ref(false);
const form = ref({ name: '', price: 0, unit: 'kg' });

const unitOptions = [
  { label: 'กิโลกรัม (kg)', value: 'kg' },
  { label: 'ชิ้น', value: 'piece' },
  { label: 'ถุง', value: 'bag' },
];

const catalogColumns: QTableColumn<WasteTypes>[] = [
  { name: 'name', label: 'ประเภทขยะ', field: 'name', align: 'left' },
  { name: 'unit', label: 'หน่วย', field: 'unit', align: 'left' },
  { name: 'price', label: 'ราคา (บาท / หน่วย)', field: 'price', align: 'left' },
];

const proposalColumns: QTableColumn<WasteTypeProposal>[] = [
  { name: 'name', label: 'ประเภทขยะ', field: 'name', align: 'left' },
  { name: 'unit', label: 'หน่วย', field: 'unit', align: 'left' },
  { name: 'price', label: 'ราคาประมาณ (บาท / หน่วย)', field: 'price', align: 'left' },
  { name: 'proposedAt', label: 'วันที่เสนอ', field: 'proposedAt', align: 'left' },
  { name: 'status', label: 'สถานะ', field: 'status', align: 'left' },
];

const STATUS_META: Record<string, { label: string; color: string; textColor: string; icon: string }> = {
  pending: { label: 'รออนุมัติ', color: 'amber-1', textColor: 'amber-9', icon: 'hourglass_empty' },
  active: { label: 'อนุมัติแล้ว', color: 'green-1', textColor: 'green-9', icon: 'check_circle' },
  rejected: { label: 'ไม่อนุมัติ', color: 'red-1', textColor: 'red-9', icon: 'cancel' },
  inactive: { label: 'ปิดใช้งาน', color: 'grey-3', textColor: 'grey-8', icon: 'block' },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending!;
}

function formatDate(value: string | null) {
  return value ? isoToThaiLongDate(value) : '-';
}

function openPropose() {
  form.value = { name: '', price: 0, unit: 'kg' };
  showDialog.value = true;
}

onMounted(() => {
  void wasteStore.fetchWasteTypes().catch(() => {
    midNotify({ type: 'error', message: wasteStore.error ?? 'ไม่สามารถโหลดประเภทขยะได้' });
  });
  void wasteStore.fetchOwnProposals().catch(() => {
    midNotify({ type: 'error', message: 'ไม่สามารถโหลดรายการที่เสนอได้' });
  });
});

async function submitProposal() {
  if (!form.value.name.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุชื่อประเภทขยะ' });
    return;
  }
  if (!(Number(form.value.price) > 0)) {
    midNotify({ type: 'warning', message: 'กรุณาระบุราคาประมาณให้มากกว่า 0' });
    return;
  }

  saving.value = true;
  try {
    await wasteStore.proposeWasteType(
      form.value.name.trim(),
      Number(form.value.price),
      form.value.unit || 'kg',
    );
    showDialog.value = false;
    midNotify({
      type: 'success',
      message: 'ส่งคำขอแล้ว รอผู้ดูแลระบบอนุมัติก่อนสมาชิกจึงจะเห็น',
    });
  } catch (error) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'ส่งคำขอไม่สำเร็จ';
    midNotify({ type: 'error', message });
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.dashboard-hero {
  min-height: 148px;
  display: flex;
  align-items: center;
}

.hero-add-btn {
  margin-left: auto;
  background: #ffffff;
  color: #165339;
  font-weight: 600;
  border-radius: 12px;
  padding: 8px 20px;
  box-shadow: 0 4px 12px rgba(22, 83, 57, 0.15);
  transition: all 0.2s ease;
}

.hero-add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(22, 83, 57, 0.2);
}

.status-chip {
  font-weight: 600;
  border-radius: 8px;
}

.reject-reason {
  margin-top: 4px;
  font-size: 12.5px;
  color: #a03434;
}

.propose-note {
  background: #fff8e6;
  border-radius: 12px;
  color: #6b4b00;
  font-size: 13.5px;
}
</style>
