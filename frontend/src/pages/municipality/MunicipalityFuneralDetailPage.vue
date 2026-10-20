<template>
  <q-page class="muni-page">
    <div class="muni-shell funeral-shell">
      <q-btn
        flat
        no-caps
        dense
        icon="arrow_back"
        label="กลับไปรายชื่อผู้เสียชีวิต"
        class="back-btn"
        to="/municipality/funeral"
      />

      <!-- Only before the first load: a reload after recording a payment keeps
           the case on screen (and the list on its page). -->
      <div v-if="slice.loading && !detail" class="loading-wrap">
        <q-spinner color="positive" size="42px" />
      </div>

      <q-banner v-else-if="slice.error" rounded class="error-banner q-mt-md">
        <template #avatar><q-icon name="error_outline" color="negative" /></template>
        {{ slice.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="load" />
        </template>
      </q-banner>

      <template v-else-if="detail">
        <section class="muni-hero">
          <div class="hero-leaf hero-leaf-one"></div>
          <div class="hero-leaf hero-leaf-two"></div>

          <div class="hero-row">
            <div class="hero-icon">
              <q-icon name="volunteer_activism" />
            </div>
            <div class="hero-copy">
              <h1>{{ detail.deceasedMember.fullName }}</h1>
              <p>
                รหัสสมาชิก {{ detail.deceasedMember.memberCode }} · เสียชีวิต
                {{ formatThaiDate(detail.deathDate) }}
              </p>
            </div>
            <span v-if="isPending" class="hero-pending-chip">
              <q-icon name="hourglass_top" size="16px" />
              รอการอนุมัติ
            </span>
            <q-btn
              v-else
              unelevated
              no-caps
              icon="picture_as_pdf"
              label="ออกรายงาน PDF"
              class="pdf-btn"
              @click="downloadPdf"
            />
          </div>
        </section>

        <!-- The two figures this page exists for: how many members paid the
             50-baht contribution, and what the family receives. Nothing to
             show until the report is approved. -->
        <div v-if="!isPending" class="headline-grid q-mt-lg">
          <article class="headline-card">
            <div class="headline-label">สมาชิกที่จ่ายเงินสมทบ</div>
            <div class="headline-value">
              {{ detail.summary.paidInFullCount.toLocaleString('th-TH') }}
              <span>/ {{ detail.summary.chargedMemberCount.toLocaleString('th-TH') }} คน</span>
            </div>
            <div class="headline-note">
              อัตราคนละ {{ formatBaht(detail.summary.requiredAmount) }} บาท
            </div>
          </article>

          <article class="headline-card is-primary">
            <div class="headline-label">ยอดเงินที่ทายาทได้รับ</div>
            <div class="headline-value">
              {{ formatBaht(detail.summary.totalPayout) }}
              <span>บาท</span>
            </div>
            <!-- เงินสมทบจากสมาชิกคนอื่น + เงินสะสมของผู้เสียชีวิตที่ปิดบัญชีเข้ามา -->
            <div class="headline-note">
              เงินสมทบ {{ formatBaht(detail.summary.totalCollected) }} + เงินสะสมของผู้เสียชีวิต
              {{ formatBaht(detail.summary.deceasedOwnSavings) }} บาท
            </div>
          </article>

          <article class="headline-card">
            <div class="headline-label">เงินสมทบที่ยังค้าง</div>
            <div class="headline-value is-warn">
              {{ formatBaht(detail.summary.totalShortfall) }}
              <span>บาท</span>
            </div>
            <div class="headline-note">
              จ่ายบางส่วน {{ detail.summary.partiallyPaidCount }} คน · ยังไม่จ่าย
              {{ detail.summary.unpaidCount }} คน
            </div>
          </article>
        </div>

        <div class="detail-grid q-mt-lg">
          <div class="detail-side">
            <q-card flat class="panel-card">
              <div class="panel-head">
                <div class="panel-title">ข้อมูลผู้เสียชีวิต</div>
              </div>
              <dl class="info-rows">
                <div>
                  <dt>เลขบัตรประชาชน</dt>
                  <dd>{{ detail.deceasedMember.citizenId }}</dd>
                </div>
                <div>
                  <dt>ที่อยู่</dt>
                  <dd>{{ addressText }}</dd>
                </div>
                <div>
                  <dt>วันที่เสียชีวิต</dt>
                  <dd>{{ formatThaiDate(detail.deathDate) }}</dd>
                </div>
                <div>
                  <dt>สาเหตุ</dt>
                  <dd>{{ detail.causeOfDeath }}</dd>
                </div>
                <div>
                  <dt>วันที่กรรมการแจ้ง</dt>
                  <dd>
                    {{ formatThaiDate(detail.eventDate) }}
                    <template v-if="detail.reportedByName"> · {{ detail.reportedByName }}</template>
                  </dd>
                </div>
                <div v-if="detail.reportNote">
                  <dt>หมายเหตุจากกรรมการ</dt>
                  <dd>{{ detail.reportNote }}</dd>
                </div>
                <div v-if="detail.approvedAt">
                  <dt>วันที่อนุมัติ</dt>
                  <dd>
                    {{ formatThaiDate(detail.approvedAt) }}
                    <template v-if="detail.approvedByName"> · {{ detail.approvedByName }}</template>
                  </dd>
                </div>
                <div>
                  <dt>ใบมรณะบัตร</dt>
                  <dd>
                    <a
                      v-if="detail.deathCertificate"
                      :href="detail.deathCertificate.fileUrl"
                      target="_blank"
                      rel="noopener"
                      class="certificate-link"
                    >
                      <q-icon name="description" size="16px" />
                      {{ detail.deathCertificate.originalName }}
                    </a>
                    <template v-else>-</template>
                  </dd>
                </div>
              </dl>
            </q-card>

            <!-- "แต่ละหมู่บ้านจ่ายไปเท่าไรกับการเสียชีวิตครั้งนี้" - ยอดรวมของทุกหมู่
                 เท่ากับยอดที่ทายาทได้รับด้านบนเสมอ เพราะแบ่งจากรายการเดียวกัน -->
            <q-card v-if="!isPending" flat class="panel-card village-card">
              <div class="panel-head">
                <div class="panel-title">เงินสมทบแยกตามหมู่บ้าน</div>
              </div>

              <div v-if="!detail.villageBreakdown.length" class="empty-state">
                <q-icon name="inbox" size="32px" />
                ยังไม่มีรายการเรียกเก็บเงินสมทบ
              </div>

              <ul v-else class="village-rows">
                <li
                  v-for="row in detail.villageBreakdown"
                  :key="row.villageAreaId ?? 'unassigned'"
                  class="village-row"
                >
                  <div class="village-main">
                    <div class="village-name">{{ villageLabel(row) }}</div>
                    <div class="village-meta">
                      จ่ายแล้ว {{ row.paidInFullCount.toLocaleString('th-TH') }} /
                      {{ row.memberCount.toLocaleString('th-TH') }} คน
                    </div>
                  </div>
                  <div class="village-amount">
                    {{ formatBaht(row.totalPaid) }}
                    <em v-if="row.totalShortfall > 0">ค้าง {{ formatBaht(row.totalShortfall) }}</em>
                  </div>
                </li>
              </ul>
            </q-card>
          </div>

          <!-- Pending: what approving would do, worked out by the server right
               now (it checks again when the button is pressed). -->
          <q-card v-if="isPending && detail.approval" flat class="panel-card approval-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">อนุมัติการเสียชีวิต</div>
                <div class="panel-caption">
                  ตรวจใบมรณะบัตรและข้อมูลที่กรรมการแจ้งก่อนอนุมัติ
                </div>
              </div>
            </div>

            <div v-if="detail.approval.ownSavingsOnly" class="outcome-box is-own-only">
              <div class="outcome-title">
                <q-icon name="error_outline" size="18px" />
                สมาชิกยังไม่ผ่านเงื่อนไขฌาปนกิจ
              </div>
              <ul class="outcome-list">
                <li v-for="reason in detail.approval.eligibility.unmetConditions" :key="reason">
                  {{ reason }}
                </li>
              </ul>
              <div class="outcome-line is-total">
                <span>ทายาทได้รับเฉพาะเงินสะสมของสมาชิกเอง</span>
                <b>{{ formatBaht(detail.approval.deceasedOwnSavings) }} บาท</b>
              </div>
              <div class="outcome-note">ไม่เรียกเก็บเงินสมทบจากสมาชิกคนอื่น</div>
            </div>

            <div v-else class="outcome-box">
              <div class="outcome-title">
                <q-icon name="verified" size="18px" />
                ผ่านเงื่อนไขฌาปนกิจครบถ้วน
              </div>
              <div class="outcome-line">
                <span>
                  หักเงินสะสมคนละ {{ formatBaht(detail.approval.amountPerMember) }} บาท จากสมาชิกใช้งาน
                </span>
                <b>{{ detail.approval.payerCount.toLocaleString('th-TH') }} คน</b>
              </div>
              <div class="outcome-line">
                <span>เงินสะสมของผู้เสียชีวิต (ปิดบัญชีให้ทายาท)</span>
                <b>{{ formatBaht(detail.approval.deceasedOwnSavings) }} บาท</b>
              </div>
            </div>

            <div class="approval-warning">
              เมื่ออนุมัติ สถานะสมาชิกจะเปลี่ยนเป็น "เสียชีวิต" ระงับบัญชีเข้าใช้งาน
              และระบบจะหักเงินทันที ย้อนกลับไม่ได้
            </div>

            <div class="approval-actions">
              <MidButton
                icon="task_alt"
                label="อนุมัติการเสียชีวิต"
                :loading="approveBusy"
                @click="approveOpen = true"
              />
            </div>
          </q-card>

          <q-card v-else flat class="panel-card panel-card--flush">
            <div class="panel-head">
              <div>
                <div class="panel-title">
                  รายชื่อสมาชิกที่จ่ายเงินสมทบ ({{ detail.contributions.length }} คน)
                </div>
              </div>
            </div>

            <div v-if="!detail.contributions.length" class="empty-state">
              <q-icon name="inbox" size="32px" />
              ยังไม่มีรายการเรียกเก็บเงินสมทบ
            </div>

            <div v-else class="payer-list">
              <div v-for="row in pagedContributions" :key="row.id" class="payer-row">
                <div class="payer-main">
                  <div class="payer-name">{{ row.fullName }}</div>
                  <div class="payer-meta">
                    รหัส {{ row.memberCode }}
                    <template v-if="row.moo"> · หมู่ {{ row.moo }}</template>
                  </div>
                </div>
                <div class="payer-amount">
                  {{ formatBaht(row.totalPaid) }}
                  <em v-if="row.shortfall > 0">ค้าง {{ formatBaht(row.shortfall) }}</em>
                </div>
                <div class="payer-status">
                  <q-chip dense square class="payer-chip" :class="statusClass(row.status)">
                    {{ CONTRIBUTION_STATUS_LABELS[row.status] }}
                  </q-chip>
                  <MidButton
                    v-if="row.shortfall > 0"
                    size="sm"
                    variant="secondary"
                    icon="payments"
                    label="รับชำระ"
                    class="payer-pay-btn"
                    @click="openPayment(row)"
                  />
                </div>
              </div>
            </div>

            <!-- Every member of the bank is charged for one death, so the list
                 is as long as the membership - read it a page at a time. The PDF
                 still carries all of them. -->
            <div v-if="detail.contributions.length > PAYERS_PER_PAGE" class="payer-pager">
              <span class="payer-range">{{ payerRangeText }}</span>
              <q-pagination
                v-model="payerPage"
                :max="payerTotalPages"
                :max-pages="5"
                boundary-numbers
                direction-links
                flat
                color="grey-7"
                active-color="positive"
              />
            </div>
          </q-card>
        </div>
      </template>
    </div>

    <!-- ============ Late payment: cash a member brings for what they owe ============ -->
    <MidDialog
      v-model="paymentOpen"
      size="sm"
      icon="payments"
      badge="รับชำระยอดค้าง"
      title="รับชำระเงินฌาปนกิจ"
      :caption="paymentCaption"
      :persistent="paymentBusy"
    >
      <q-form ref="paymentFormRef" greedy class="payment-form" @submit.prevent="submitPayment">
        <q-input
          v-model.number="paymentAmount"
          outlined
          dense
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          label="จำนวนเงินที่ได้รับ (บาท) *"
          :rules="paymentRules"
        />
        <q-input
          v-model="paymentNote"
          outlined
          dense
          maxlength="200"
          label="หมายเหตุ (ไม่บังคับ)"
        />
        <div v-if="detail" class="payment-hint">
          เงินนี้ส่งต่อให้ทายาทของ{{ detail.deceasedMember.fullName }}
          ยอดที่ทายาทได้รับจะเพิ่มขึ้นตามจำนวนนี้
        </div>
      </q-form>
      <template #actions>
        <MidButton
          variant="secondary"
          label="ยกเลิก"
          :disable="paymentBusy"
          @click="paymentOpen = false"
        />
        <MidButton
          icon="payments"
          label="บันทึกรับชำระ"
          :loading="paymentBusy"
          @click="submitPayment"
        />
      </template>
    </MidDialog>

    <!-- ============ Approval: the last check before anything moves ============ -->
    <MidDialog
      v-model="approveOpen"
      size="sm"
      icon="task_alt"
      badge="อนุมัติการเสียชีวิต"
      title="ยืนยันการอนุมัติ"
      :caption="detail?.deceasedMember.fullName ?? ''"
      :persistent="approveBusy"
    >
      <div v-if="detail?.approval" class="approve-confirm">
        <template v-if="detail.approval.ownSavingsOnly">
          สมาชิกรายนี้ยังไม่ผ่านเงื่อนไขฌาปนกิจ ทายาทจะได้รับเฉพาะเงินสะสมของสมาชิกเอง
          <b>{{ formatBaht(detail.approval.deceasedOwnSavings) }} บาท</b>
          โดยไม่เรียกเก็บเงินสมทบจากสมาชิกคนอื่น
        </template>
        <template v-else>
          ระบบจะหักเงินสะสมคนละ
          <b>{{ formatBaht(detail.approval.amountPerMember) }} บาท</b>
          จากสมาชิกใช้งาน
          <b>{{ detail.approval.payerCount.toLocaleString('th-TH') }} คน</b>
          ทันที และปิดบัญชีเงินสะสมของผู้เสียชีวิตให้ทายาท
        </template>
        <div class="approve-confirm-note">การอนุมัติย้อนกลับไม่ได้</div>
      </div>
      <template #actions>
        <MidButton
          variant="secondary"
          label="ยกเลิก"
          :disable="approveBusy"
          @click="approveOpen = false"
        />
        <MidButton
          icon="task_alt"
          label="ยืนยันอนุมัติ"
          :loading="approveBusy"
          @click="submitApprove"
        />
      </template>
    </MidDialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { QForm } from 'quasar';
import { useRoute } from 'vue-router';
import {
  useMunicipalityStore,
  type FuneralContributionRow,
  type FuneralVillageContribution,
} from 'src/stores/municipalityStore';
import { CONTRIBUTION_STATUS_LABELS, createFuneralCasePdf } from 'src/pdf/funeralCaseReportPdf';
import { MidButton, MidDialog, midNotify } from 'components/MID';
import { apiErrorMessage } from 'src/utils/apiError';
import { formatBaht, formatThaiDate } from './format';

// สรุปเงินฌาปนกิจของผู้เสียชีวิต 1 ราย: ใครจ่ายเงินสมทบ 50 บาทบ้าง และทายาทได้รับเท่าไร
// พร้อมออกเป็นรายงาน PDF ได้จากหน้านี้

const route = useRoute();
const store = useMunicipalityStore();

const slice = computed(() => store.funeralCase);
const detail = computed(() => slice.value.data);

const addressText = computed(() => {
  const home = detail.value?.deceasedMember.household;
  if (!home) return '-';
  const parts = [
    home.houseNo ? `บ้านเลขที่ ${home.houseNo}` : '',
    home.moo ? `หมู่ ${home.moo}` : '',
    home.subdistrict ? `ต.${home.subdistrict}` : '',
    home.district ? `อ.${home.district}` : '',
    home.province ? `จ.${home.province}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : '-';
});

// The contributor list is paged in the browser: the detail endpoint already
// returns every row (the PDF needs them all), so paging it here costs no extra
// request and keeps the page readable when the whole village is on the list.
const PAYERS_PER_PAGE = 10;
const payerPage = ref(1);

const payerTotalPages = computed(() =>
  Math.max(Math.ceil((detail.value?.contributions.length ?? 0) / PAYERS_PER_PAGE), 1),
);

const pagedContributions = computed(() => {
  const rows = detail.value?.contributions ?? [];
  const start = (payerPage.value - 1) * PAYERS_PER_PAGE;
  return rows.slice(start, start + PAYERS_PER_PAGE);
});

const payerRangeText = computed(() => {
  const total = detail.value?.contributions.length ?? 0;
  if (!total) return '';
  const start = (payerPage.value - 1) * PAYERS_PER_PAGE + 1;
  const end = Math.min(payerPage.value * PAYERS_PER_PAGE, total);
  return `แสดง ${start}-${end} จาก ${total.toLocaleString('th-TH')} คน`;
});

// A different case means a different list - never land on page 5 of a shorter one.
// Keyed on the case id: recording a payment reloads the same case, and that must
// leave the list on the page the payment was made from.
watch(
  () => detail.value?.id,
  () => {
    payerPage.value = 1;
  },
);

// --- Late payment ---------------------------------------------------------------
// A member who was short when this death was charged brings the rest in cash.
// Part of it is fine; more than is owed is refused (here and by the server).
const paymentOpen = ref(false);
const paymentBusy = ref(false);
const paymentRow = ref<FuneralContributionRow | null>(null);
const paymentAmount = ref<number | null>(null);
const paymentNote = ref('');
const paymentFormRef = ref<QForm | null>(null);

const paymentCaption = computed(() => {
  const row = paymentRow.value;
  return row ? `${row.fullName} · ค้าง ${formatBaht(row.shortfall)} บาท` : '';
});

const paymentRules = [
  (v: number | null) => (typeof v === 'number' && v > 0) || 'กรุณากรอกจำนวนเงิน',
  (v: number | null) =>
    v === null ||
    v <= (paymentRow.value?.shortfall ?? 0) ||
    `ยอดค้างมีเพียง ${formatBaht(paymentRow.value?.shortfall ?? 0)} บาท`,
  // Compared with a tolerance: 30.1 * 100 is 3010.0000000000005 in floating point.
  (v: number | null) =>
    v === null || Math.abs(Math.round(v * 100) - v * 100) < 1e-6 || 'ทศนิยมได้ไม่เกิน 2 ตำแหน่ง',
];

function openPayment(row: FuneralContributionRow) {
  paymentRow.value = row;
  paymentAmount.value = row.shortfall;
  paymentNote.value = '';
  paymentOpen.value = true;
}

async function submitPayment() {
  const row = paymentRow.value;
  const caseId = detail.value?.id;
  if (!row || !caseId || paymentBusy.value) return;
  if (!(await paymentFormRef.value?.validate())) return;
  paymentBusy.value = true;
  try {
    await store.recordFuneralPayment(caseId, row.id, {
      amount: paymentAmount.value ?? 0,
      note: paymentNote.value.trim() || undefined,
    });
    midNotify({ type: 'success', message: `บันทึกรับชำระจาก ${row.fullName} แล้ว` });
    paymentOpen.value = false;
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกรับชำระไม่สำเร็จ') });
  } finally {
    paymentBusy.value = false;
  }
}

// หมู่บ้านที่ยังไม่ผูกกับครัวเรือนจะไม่มีทั้งชื่อและหมู่ - รวมเป็นแถวเดียว
function villageLabel(row: FuneralVillageContribution): string {
  const parts = [row.moo ? `หมู่ ${row.moo}` : '', row.villageName ?? ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'ไม่ระบุหมู่บ้าน';
}

function statusClass(status: FuneralContributionRow['status']): string {
  if (status === 'completed') return 'is-paid';
  return status === 'partially_paid' ? 'is-partial' : 'is-unpaid';
}

function downloadPdf() {
  const data = detail.value;
  if (!data) return;
  try {
    createFuneralCasePdf(data, { preparedBy: 'เจ้าหน้าที่เทศบาล' }).download(
      `funeral-case-${data.deceasedMember.memberCode}-${data.deathDate.slice(0, 10)}.pdf`,
    );
  } catch {
    midNotify({ type: 'error', message: 'สร้างไฟล์ PDF ไม่สำเร็จ' });
  }
}

// --- Approval -----------------------------------------------------------------
// A committee report changes nothing until it is approved here: then the member
// is marked deceased and the contributions are charged (or, for a member who
// misses the funeral conditions, only their own savings go to the heirs - the
// request says so explicitly, and the server refuses if that no longer holds).
const isPending = computed(() => detail.value?.status === 'pending');
const approveOpen = ref(false);
const approveBusy = ref(false);

async function submitApprove() {
  const data = detail.value;
  if (!data?.approval || approveBusy.value) return;
  approveBusy.value = true;
  try {
    const result = await store.approveFuneralCase(data.id, data.approval.ownSavingsOnly);
    approveOpen.value = false;
    const payout = formatBaht(result.deduction.totalPayout);
    midNotify({
      type: 'success',
      title: 'อนุมัติแล้ว',
      message: result.ownSavingsOnly
        ? `ทายาทได้รับเงินสะสมของสมาชิก ${payout} บาท`
        : `หักเงินจากสมาชิก ${result.deduction.paidMemberCount}/${result.deduction.memberCount} คน ทายาทได้รับ ${payout} บาท`,
    });
  } catch (error) {
    approveOpen.value = false;
    midNotify({ type: 'error', message: apiErrorMessage(error, 'อนุมัติไม่สำเร็จ') });
    // The server may have seen the member differently (conditions changed, or
    // someone approved it meanwhile) - show the case as it is now.
    load();
  } finally {
    approveBusy.value = false;
  }
}

function load() {
  void store.fetchFuneralCase(Number(route.params.id));
}

onMounted(load);
</script>

<style lang="scss" scoped>
@use './theme' as *;

.funeral-shell {
  width: min(1180px, 100%);
}

.back-btn {
  margin-bottom: 12px;
  color: #33584a;
  font-weight: 700;
}

.pdf-btn {
  margin-left: auto;
  color: #075c38;
  background: #ffffff;
  border-radius: 12px;
  font-weight: 700;
}

.headline-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.headline-card {
  padding: 18px 20px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(23, 46, 34, 0.04);

  // The money the family receives is the number people come here for.
  &.is-primary {
    background: linear-gradient(135deg, #f1fbf4, #ffffff);
    border-color: #bfe6cd;
  }
}

.headline-label {
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 700;
}

.headline-value {
  margin-top: 6px;
  color: #0b4f36;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.15;

  span {
    margin-left: 4px;
    color: #8a958e;
    font-size: 13px;
    font-weight: 700;
  }

  &.is-warn {
    color: #b91c1c;
  }
}

.headline-note {
  margin-top: 6px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

// ซ้ายของ detail-grid ซ้อนสองการ์ด (ข้อมูลผู้เสียชีวิต + เงินสมทบรายหมู่)
// ต่อกันในคอลัมน์เดียว ส่วนรายชื่อผู้จ่ายยังกินคอลัมน์ขวาเต็มความสูงเหมือนเดิม
.detail-side {
  display: grid;
  gap: 18px;
  align-content: start;
}

.info-rows {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
}

.village-rows {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.village-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f7faf8;
  border: 1px solid #eef3ef;
  border-radius: 12px;
}

.village-main {
  flex: 1;
  min-width: 0;
}

.village-name {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 800;
}

.village-meta {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.village-amount {
  color: #0d7a44;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  text-align: right;

  em {
    display: block;
    margin-top: 2px;
    color: #b91c1c;
    font-size: 11.5px;
    font-style: normal;
    font-weight: 700;
  }
}

.info-rows div {
  display: flex;
  gap: 10px;
}

.info-rows dt {
  min-width: 128px;
  color: #8a958e;
  font-size: 13px;
  font-weight: 700;
}

.info-rows dd {
  margin: 0;
  color: #1c2b23;
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.payer-list {
  display: grid;
  gap: 8px;
  padding: 12px 18px 18px;
}

.payer-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: #ffffff;
  border: 1px solid #eef3ef;
  border-radius: 12px;
}

.payer-main {
  flex: 1;
  min-width: 0;
}

.payer-name {
  color: #16352a;
  font-size: 13.5px;
  font-weight: 800;
}

.payer-meta {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.payer-amount {
  color: #0d7a44;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  text-align: right;

  em {
    display: block;
    margin-top: 2px;
    color: #b91c1c;
    font-size: 11.5px;
    font-style: normal;
    font-weight: 700;
  }
}

.payer-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 4px 14px;
}

.payer-range {
  color: #8a958e;
  font-size: 12.5px;
  font-weight: 600;
}

.payer-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.payer-chip {
  min-width: 86px;
  justify-content: center;
  font-size: 11.5px;
  font-weight: 700;

  &.is-paid {
    color: #0d7a44;
    background: #e9f7ee;
  }

  &.is-partial {
    color: #8a5a12;
    background: #fff4e5;
  }

  &.is-unpaid {
    color: #c62828;
    background: #fdecea;
  }
}

.payment-form {
  display: grid;
  gap: 4px;
}

.payment-hint {
  color: #5c7769;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

// --- Pending report: waiting for this officer's approval -------------------------

.hero-pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  color: #8a5a12;
  background: #fff4e5;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.certificate-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #0d7a44;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.approval-card {
  display: grid;
  gap: 14px;
  align-content: start;
}

// Eligible: green, what will be charged. Misses a condition: red, which ones,
// and that only the member's own savings go to the heirs.
.outcome-box {
  padding: 12px 14px;
  background: #f1fbf4;
  border: 1px solid #bfe6cd;
  border-radius: 12px;

  &.is-own-only {
    background: #fff5f5;
    border-color: #f6d3d3;

    .outcome-title {
      color: #b42318;
    }
  }
}

.outcome-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0d7a44;
  font-size: 13.5px;
  font-weight: 800;
}

.outcome-list {
  margin: 8px 0 0;
  padding-left: 22px;
  color: #5c2b26;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.6;
}

.outcome-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: #43514a;
  font-size: 13px;
  font-weight: 600;

  b {
    color: #16352a;
    font-weight: 800;
    white-space: nowrap;
  }

  &.is-total {
    padding-top: 10px;
    border-top: 1px dashed #f0c8c8;

    b {
      color: #0b4f36;
      font-size: 16px;
      font-weight: 900;
    }
  }
}

.outcome-note {
  margin-top: 4px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.approval-warning {
  color: #8a5a12;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
}

.approval-actions {
  display: flex;
  justify-content: flex-end;
}

.approve-confirm {
  color: #33473d;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.7;

  b {
    color: #0b4f36;
    font-weight: 800;
  }
}

.approve-confirm-note {
  margin-top: 8px;
  color: #b45309;
  font-size: 12.5px;
  font-weight: 700;
}

@media (max-width: 1023px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .headline-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .muni-hero {
    padding: 18px;
  }

  .hero-row {
    gap: 12px;
  }

  .hero-icon {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 13px;
    font-size: 23px;
  }

  .hero-copy {
    flex: 1 1 150px;
  }

  .hero-copy h1 {
    font-size: 18.5px;
    line-height: 1.3;
  }

  .pdf-btn {
    width: 100%;
    margin-left: 0;
  }

  .payer-list {
    padding: 10px 12px 14px;
  }

  // Phone: the status chip (and the รับชำระ button) drop under the
  // name/amount line.
  .payer-row {
    flex-wrap: wrap;
  }

  .payer-status {
    flex: 1 1 100%;
  }

  .payer-chip {
    flex: 1 1 auto;
  }
}
</style>
