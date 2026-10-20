<template>
  <MidDialog
    :model-value="modelValue"
    title="รายละเอียดการขาย"
    :caption="caption"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="loading" class="sale-state">
      <q-spinner-dots size="28px" color="green-8" />
      กำลังโหลดรายละเอียด...
    </div>
    <div v-else-if="error" class="sale-state">
      <q-icon name="error_outline" size="24px" color="orange-9" />
      {{ error }}
    </div>

    <template v-else-if="sale">
      <ul class="sale-lines">
        <li v-for="line in sale.details" :key="line.id" class="sale-line">
          <div class="sale-line-main">
            <div class="sale-line-name">{{ line.wasteType.wasteName }}</div>
            <div class="sale-line-calc">
              {{ line.quantity.toLocaleString() }} {{ unitLabel(line.wasteType.unit) }} ×
              {{ line.unitPrice.toLocaleString() }} บาท/{{ unitLabel(line.wasteType.unit) }}
            </div>
          </div>
          <div class="sale-line-amount">{{ line.subtotal.toLocaleString() }} บาท</div>
        </li>
      </ul>

      <dl class="sale-totals">
        <div class="is-total">
          <dt>รวมทั้งหมด</dt>
          <dd>{{ sale.totalAmount.toLocaleString() }} บาท</dd>
        </div>
        <div>
          <dt>เข้าเงินสะสม</dt>
          <dd class="is-savings">{{ keptInSavings.toLocaleString() }} บาท</dd>
        </div>
        <div>
          <dt>เงินสดกลับบ้าน</dt>
          <dd>{{ cashReceived.toLocaleString() }} บาท</dd>
        </div>
        <div v-if="sale.receipt">
          <dt>ใบเสร็จ</dt>
          <dd>{{ sale.receipt.receiptNo }}</dd>
        </div>
      </dl>

      <q-btn
        unelevated
        no-caps
        class="bill-toggle full-width"
        :icon="showBills ? 'expand_less' : 'receipt_long'"
        :label="
          sale.documents.length
            ? `${showBills ? 'ซ่อนบิล' : 'ดูบิล'} (${sale.documents.length})`
            : 'ไม่มีบิลแนบไว้'
        "
        :disable="!sale.documents.length"
        @click="showBills = !showBills"
      />

      <!-- The committee's photos/slips; tap one to open it full size. -->
      <div v-if="showBills" class="bill-grid">
        <a
          v-for="document in sale.documents"
          :key="document.id"
          class="bill-item"
          :href="document.fileUrl"
          target="_blank"
          rel="noopener"
        >
          <img
            v-if="document.mimeType.startsWith('image/')"
            :src="document.fileUrl"
            :alt="document.originalName"
            loading="lazy"
          />
          <div v-else class="bill-file"><q-icon name="picture_as_pdf" size="30px" /></div>
          <span class="bill-name">{{ document.originalName }}</span>
        </a>
      </div>
    </template>
  </MidDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from 'src/boot/axios';
import { apiErrorMessage } from 'src/utils/apiError';
import { MidDialog, isoToThaiShortDate } from 'components/MID';

// GET /history/sales/:id - one of the signed-in member's own sales.
interface SaleDetail {
  id: number;
  saleDate: string;
  totalAmount: number;
  netAmount: number;
  details: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    wasteType: { wasteName: string; unit: string };
  }>;
  receipt: { receiptNo: string; paidAmount: number } | null;
  documents: Array<{ id: number; originalName: string; mimeType: string; fileUrl: string }>;
}

const props = defineProps<{
  modelValue: boolean;
  saleId: number | null;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const sale = ref<SaleDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const showBills = ref(false);

const caption = computed(() => {
  if (!sale.value) return undefined;
  const time = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(sale.value.saleDate));
  return `${isoToThaiShortDate(localIsoDate(sale.value.saleDate))} · ${time} น.`;
});

const cashReceived = computed(() => sale.value?.receipt?.paidAmount ?? sale.value?.netAmount ?? 0);
// Everything not paid out in cash stayed in savings (the automatic top-up plus
// whatever the member chose to keep).
const keptInSavings = computed(() =>
  sale.value ? Math.round((sale.value.totalAmount - cashReceived.value) * 100) / 100 : 0,
);

function localIsoDate(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function unitLabel(unit: string): string {
  return unit === 'kg' ? 'กก.' : unit;
}

// Fetch fresh on every open: bill links are signed and expire after a while.
watch(
  () => [props.modelValue, props.saleId] as const,
  async ([open, saleId]) => {
    if (!open || saleId === null) return;
    showBills.value = false;
    sale.value = null;
    error.value = null;
    loading.value = true;
    try {
      const { data } = await api.get<SaleDetail>(`/history/sales/${saleId}`);
      if (props.saleId === saleId) sale.value = data;
    } catch (err) {
      error.value = apiErrorMessage(err, 'โหลดรายละเอียดการขายไม่สำเร็จ');
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.sale-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: #6f7f76;
  font-weight: 700;
}

/* A plain list: one line per waste type, separated by hairlines. */
.sale-lines {
  margin: 0;
  padding: 0 4px;
  list-style: none;
}

.sale-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.sale-line + .sale-line {
  border-top: 1px solid #edf2ee;
}

.sale-line-main {
  min-width: 0;
  flex: 1;
}

.sale-line-name {
  color: #17452e;
  font-size: 15px;
  font-weight: 900;
}

.sale-line-calc {
  margin-top: 2px;
  color: #6f7f76;
  font-size: 13px;
  font-weight: 700;
}

.sale-line-amount {
  flex-shrink: 0;
  color: #17452e;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
}

.sale-totals {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding: 14px 4px 0;
  border-top: 1px dashed #d8e6db;
}

.sale-totals > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.sale-totals dt {
  color: #6f7f76;
  font-size: 14px;
  font-weight: 700;
}

.sale-totals dd {
  margin: 0;
  color: #17452e;
  font-size: 14px;
  font-weight: 900;
  text-align: right;
}

.sale-totals .is-total dt,
.sale-totals .is-total dd {
  color: #06492d;
  font-size: 17px;
  font-weight: 950;
}

.sale-totals dd.is-savings {
  color: #087f49;
}

.bill-toggle {
  min-height: 44px;
  margin-top: 18px;
  color: #087f49;
  background: #e6f5ea;
  border-radius: 12px;
  font-weight: 900;
}

.bill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.bill-item {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 12px;
  text-decoration: none;
}

.bill-item img,
.bill-file {
  display: block;
  width: 100%;
  height: 110px;
  object-fit: cover;
}

.bill-file {
  display: grid;
  place-items: center;
  color: #c0392b;
  background: #fdf3f2;
}

.bill-name {
  display: block;
  overflow: hidden;
  padding: 6px 8px;
  color: #2c3b33;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
