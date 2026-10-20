<template>
  <q-page class="muni-page">
    <!-- mid-accent-purple (components/MID/mid-theme.scss) keeps this flow's
         fields and pickers purple instead of the app's brand green. -->
    <div class="muni-shell detail-shell mid-accent-purple">
      <section class="muni-hero muni-hero--purple">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="volunteer_activism" />
          </div>
          <div class="hero-copy">
            <h1>แจ้งสมาชิกเสียชีวิต</h1>
            <p v-if="member">{{ memberFullName(member) }}</p>
          </div>
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="กลับไปหน้าจัดการสมาชิก"
            class="hero-link-btn"
            :to="route.path.startsWith('/admin') ? '/admin/members' : '/committee/members'"
          />
        </div>
      </section>

      <div v-if="detail.loading" class="loading-wrap">
        <q-spinner-dots size="36px" color="green-8" />
      </div>

      <q-banner v-else-if="detail.error" dense rounded class="error-banner">
        <template #avatar><q-icon name="error_outline" color="negative" /></template>
        {{ detail.error }}
      </q-banner>

      <template v-else-if="member">
        <q-card flat class="panel-card q-mt-lg">
          <q-banner v-if="!canManage" rounded class="bg-grey-3 text-grey-9">
            สมาชิกรายนี้อยู่ในสถานะ{{ memberStatusLabel(member.status) }}แล้ว ไม่สามารถแจ้งเสียชีวิตซ้ำได้
          </q-banner>

          <!-- แจ้งไปแล้ว รอเทศบาลอนุมัติ: สมาชิกยังใช้งานอยู่ จึงต้องบอกที่หน้านี้เอง -->
          <q-banner v-else-if="pendingReport" rounded class="pending-banner">
            <template #avatar><q-icon name="hourglass_top" /></template>
            <div class="pending-title">แจ้งเสียชีวิตแล้ว รอเจ้าหน้าที่เทศบาลอนุมัติ</div>
            <div class="pending-text">
              แจ้งเมื่อ {{ formatThaiDate(pendingReport.eventDate) }} · วันที่เสียชีวิต
              {{ formatThaiDate(pendingReport.deathDate) }} ระหว่างนี้สมาชิกยังอยู่ในสถานะใช้งาน
              และยังไม่มีการหักเงินสะสมจนกว่าเทศบาลจะอนุมัติ
            </div>
          </q-banner>

          <template v-else>
            <dl class="detail-list q-mt-md">
              <div><dt>ชื่อ-นามสกุล</dt><dd>{{ memberFullName(member) }}</dd></div>
              <div><dt>เลขประจำตัวประชาชน</dt><dd>{{ member.citizenId }}</dd></div>
              <div><dt>ที่อยู่</dt><dd>{{ formatMemberAddress(member) }}</dd></div>
            </dl>

            <div class="form-grid q-mt-md">
              <!-- buddhist-year: ปฏิทินแสดงปี พ.ศ. · no-future: วันเสียชีวิตเป็นวัน
                   ในอนาคตไม่ได้ (เลือกไม่ได้ และพิมพ์เองก็ไม่ผ่าน validation) -->
              <MidDateField
                v-model="form.deathDate"
                class="span-6"
                label="วันที่เสียชีวิต *"
                required
                accent="purple"
                buddhist-year
                no-future
              />
              <q-input
                v-model="form.causeOfDeath"
                outlined
                dense
                label="สาเหตุการเสียชีวิต *"
                class="span-6"
                :rules="[required]"
              />
            </div>

            <q-file
              v-model="form.file"
              outlined
              dense
              clearable
              class="q-mt-sm"
              label="แนบใบมรณะบัตร (PDF/รูปภาพ) *"
              accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
            >
              <template #prepend>
                <q-icon name="upload_file" />
              </template>
            </q-file>

            <q-input
              v-model="form.note"
              outlined
              dense
              autogrow
              class="q-mt-md"
              label="เหตุผล / หมายเหตุ (ไม่บังคับ)"
            />

            <div class="detail-actions">
              <q-space />
              <q-btn flat no-caps label="ยกเลิก" :to="route.path.startsWith('/admin') ? '/admin/members' : '/committee/members'" />
              <q-btn
                unelevated
                no-caps
                color="deep-purple-7"
                icon="volunteer_activism"
                label="แจ้งเสียชีวิต"
                :loading="busy"
                :disable="submitDisabled"
                @click="confirmOpen = true"
              />
            </div>
          </template>
        </q-card>
      </template>
    </div>

    <!-- 1. ทวนข้อมูลก่อนส่ง: เรื่องจะไปรอเทศบาลอนุมัติ ยังไม่มีอะไรเปลี่ยนจนกว่าจะอนุมัติ -->
    <q-dialog v-model="confirmOpen">
      <q-card v-if="member" class="confirm-card">
        <div class="confirm-head">
          <div class="confirm-icon"><q-icon name="volunteer_activism" /></div>
          <div>
            <div class="confirm-title">ยืนยันการแจ้งเสียชีวิต</div>
          </div>
        </div>

        <q-separator />

        <div class="confirm-body">
          <dl class="confirm-rows">
            <div>
              <dt>สมาชิก</dt>
              <dd>{{ memberFullName(member) }} (รหัส {{ member.memberCode }})</dd>
            </div>
            <div>
              <dt>วันที่เสียชีวิต</dt>
              <dd>{{ formatThaiDate(form.deathDate) }}</dd>
            </div>
            <div>
              <dt>สาเหตุ</dt>
              <dd>{{ form.causeOfDeath.trim() }}</dd>
            </div>
            <div>
              <dt>ใบมรณะบัตร</dt>
              <dd>{{ form.file?.name ?? '-' }}</dd>
            </div>
            <div v-if="form.note.trim()">
              <dt>หมายเหตุ</dt>
              <dd>{{ form.note.trim() }}</dd>
            </div>
          </dl>

          <!-- ไม่ผ่านเงื่อนไขฌาปนกิจ: แจ้งได้ แต่ถ้าเทศบาลอนุมัติ จะไม่เรียกเก็บเงินจากใคร
               ทายาทได้เฉพาะเงินสะสมของสมาชิกเอง - บอกให้กรรมการรู้ไว้ก่อนว่าขาดข้อไหน
               (เทศบาลตรวจเงื่อนไขอีกครั้งตอนอนุมัติ) -->
          <div v-if="missesConditions" class="own-only-box">
            <div class="own-only-title">
              <q-icon name="error_outline" size="18px" />
              สมาชิกยังไม่ผ่านเงื่อนไขฌาปนกิจ
            </div>
            <ul class="own-only-list">
              <li v-for="reason in unmetConditions" :key="reason">{{ reason }}</li>
            </ul>
            <div class="own-only-payout">
              <span>รับเฉพาะเงินสะสมของสมาชิกเอง</span>
              <b>{{ ownSavings.toLocaleString() }} บาท</b>
            </div>
          </div>

          <q-banner dense rounded class="confirm-banner">
            <template #avatar><q-icon name="info_outline" /></template>
            เมื่อยืนยัน ระบบจะส่งเรื่องให้เจ้าหน้าที่เทศบาลอนุมัติ
          </q-banner>
        </div>

        <q-separator />

        <div class="confirm-actions">
          <q-btn flat no-caps label="ยกเลิก" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="deep-purple-7"
            icon="send"
            label="แจ้งเสียชีวิต"
            :loading="busy"
            @click="submit"
          />
        </div>
      </q-card>
    </q-dialog>

    <!-- 2. ส่งเรื่องแล้ว: ที่เหลือเป็นงานของเทศบาล -->
    <q-dialog v-model="resultOpen" persistent>
      <q-card v-if="result" class="result-card">
        <div class="result-head">
          <div class="result-icon"><q-icon name="task_alt" /></div>
          <div>
            <div class="confirm-title">ส่งเรื่องแจ้งเสียชีวิตแล้ว</div>
            <div class="confirm-sub">รอเจ้าหน้าที่เทศบาลอนุมัติ</div>
          </div>
        </div>

        <q-separator />

        <div class="result-body">
          <ol class="next-steps">
            <li>เจ้าหน้าที่เทศบาลตรวจใบมรณะบัตรและข้อมูลที่แจ้ง</li>
            <li>
              เมื่ออนุมัติ สถานะสมาชิกจะเปลี่ยนเป็น "เสียชีวิต"
              <template v-if="result.eligibility.isEligible">
                และหักเงินสะสมคนละ {{ FUND_MINIMUM_BAHT.toLocaleString() }} บาท
                จากสมาชิกใช้งานทุกคนเพื่อมอบให้ทายาท
              </template>
              <template v-else>
                และทายาทจะได้รับเฉพาะเงินสะสมของสมาชิกเอง เพราะยังไม่ผ่านเงื่อนไขฌาปนกิจ
              </template>
            </li>
          </ol>
        </div>

        <q-separator />

        <div class="confirm-actions">
          <q-btn
            unelevated
            no-caps
            color="deep-purple-7"
            label="เสร็จสิ้น"
            icon-right="arrow_forward"
            @click="closeResult"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiErrorMessage } from 'src/utils/apiError';
import { required } from 'src/utils/validators';
import {
  useCommitteeStore,
  type CommitteeMemberDetail,
  type DeathReportResult,
} from 'src/stores/committeeStore';
import { MidDateField, midNotify } from 'components/MID';
import {
  FUND_MINIMUM_BAHT,
  formatThaiDate,
  memberFullName,
  memberStatusLabel,
} from '../municipality/format';

const store = useCommitteeStore();
const route = useRoute();
const router = useRouter();

const memberId = Number(route.params.id);

const detail = computed(() => store.memberDetail);
const member = computed<CommitteeMemberDetail | null>(() => detail.value.data);

const canManage = computed(() => !!member.value && member.value.status !== 'resigned' && member.value.status !== 'deceased');

// Already reported and waiting for the municipality - no second report.
const pendingReport = computed(() => member.value?.funeralCases?.[0] ?? null);

const form = reactive({
  deathDate: '',
  causeOfDeath: '',
  note: '',
  file: null as File | null,
});

const busy = ref(false);
const confirmOpen = ref(false);
const resultOpen = ref(false);
const result = ref<DeathReportResult | null>(null);

const submitDisabled = computed(() => !form.deathDate || !form.causeOfDeath.trim() || !form.file);

// Same rule the backend gates on (eligibilityService), shown here as a heads-up
// only: the municipality evaluates it again when approving. Null = not an
// active member yet (an applicant): never approved, so never eligible either.
// Such a death can still be approved, but nobody is charged - the heirs get
// only the member's own savings.
const missesConditions = computed(() => member.value?.benefitEligibility?.eligible !== true);

const unmetConditions = computed(
  () =>
    member.value?.benefitEligibility?.reason ?? [
      'ยังไม่ได้รับอนุมัติเป็นสมาชิก จึงยังไม่เริ่มนับอายุสมาชิก',
    ],
);

const ownSavings = computed(() => Math.max(member.value?.fundBalance?.totalContribution ?? 0, 0));

function formatMemberAddress(m: CommitteeMemberDetail): string {
  const household = m.household;
  if (!household) return '-';
  const parts = [
    household.houseNo ? `บ้านเลขที่ ${household.houseNo}` : '',
    household.moo ? `หมู่ ${household.moo}` : '',
    household.subdistrict ? `ต.${household.subdistrict}` : '',
    household.district ? `อ.${household.district}` : '',
    household.province ? `จ.${household.province}` : '',
    household.postcode ?? '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : '-';
}

// The report is already sent when this runs - the dialog only confirms it, so
// leaving the page is what closes the flow.
function closeResult() {
  resultOpen.value = false;
  void router.push(route.path.startsWith('/admin') ? '/admin/members' : '/committee/members');
}

async function submit() {
  if (!member.value || submitDisabled.value) return;

  busy.value = true;
  try {
    const note = form.note.trim() || undefined;
    result.value = await store.reportMemberDeath(
      memberId,
      {
        deathDate: form.deathDate,
        causeOfDeath: form.causeOfDeath.trim(),
        ...(note ? { note } : {}),
      },
      form.file as File,
    );
    confirmOpen.value = false;
    resultOpen.value = true;
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ดำเนินการไม่สำเร็จ') });
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void store.fetchMemberDetail(memberId);
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.detail-shell {
  width: min(1180px, 100%);
}

.muni-hero--purple {
  background: linear-gradient(135deg, #3c0f70 0%, #6a2fc9 100%);
  box-shadow: 0 10px 30px rgba(60, 15, 112, 0.2);
}

.hero-link-btn {
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  padding: 4px 18px;
  font-weight: 800;
  transition: background 0.2s ease;
}

.hero-link-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

// On phones the button takes its own full-width row (hero-row wraps) instead of
// squeezing the title into a one-word-per-line column - same as CommitteeAddMemberPage.
@media (max-width: 599px) {
  .hero-link-btn {
    width: 100%;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px 14px;
}

.span-6 {
  grid-column: span 6;
}

// Field/picker purple comes from the shared `mid-accent-purple` scope in
// components/MID/mid-theme.scss - don't re-declare those colours here.

.detail-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 28px;
  margin: 0;
  padding: 18px 20px;
  background: #f8f7fb;
  border: 1px solid #ece9f5;
  border-radius: 14px;
}

.detail-list div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-list dt {
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 700;
}

.detail-list dd {
  margin: 0;
  color: #1c2b23;
  font-size: 15px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0 0;
}

@media (max-width: 720px) {
  .detail-list {
    grid-template-columns: 1fr;
  }

  .span-6 {
    grid-column: span 12;
  }
}

// --- Dialogs: ยืนยันก่อนหัก และผลลัพธ์รายหมู่บ้าน ------------------------------

.confirm-card,
.result-card {
  width: min(520px, calc(100vw - 32px));
  border-radius: 18px;
}

.confirm-head,
.result-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 22px 16px;
}

.confirm-icon,
.result-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  min-width: 46px;
  color: #5b21b6;
  background: #f1eaff;
  border-radius: 14px;
  font-size: 24px;
}

.result-icon {
  color: #0d7a44;
  background: #e9f7ee;
}

.confirm-title {
  color: #10241a;
  font-size: 17px;
  font-weight: 900;
}

.confirm-sub {
  margin-top: 3px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 700;
}

.confirm-body,
.result-body {
  padding: 16px 22px;
}

.confirm-rows {
  display: grid;
  gap: 8px;
  margin: 0;
}

.confirm-rows div {
  display: flex;
  gap: 10px;
}

.confirm-rows dt {
  min-width: 118px;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 800;
}

.confirm-rows dd {
  margin: 0;
  color: #1c2b23;
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

// ข้อมูลว่าจะเกิดอะไรต่อ (ยังไม่มีอะไรเปลี่ยนจนกว่าเทศบาลอนุมัติ) - โทนม่วงของ flow นี้
.confirm-banner {
  margin-top: 14px;
  color: #4c1d95;
  background: #f5f0ff;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
}

// แจ้งไปแล้ว รอเทศบาลอนุมัติ
.pending-banner {
  color: #8a5a12;
  background: #fff4e5;
  border: 1px solid #f6dfb8;
}

.pending-title {
  font-size: 14.5px;
  font-weight: 800;
}

.pending-text {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

// ไม่ผ่านเงื่อนไขฌาปนกิจ: เงื่อนไขที่ขาด + ยอดที่ทายาทจะได้รับ (โทนแดงอ่อน
// แยกจากแบนเนอร์เตือนสีส้มด้านล่าง)
.own-only-box {
  margin-top: 14px;
  padding: 12px 14px;
  background: #fff5f5;
  border: 1px solid #f6d3d3;
  border-radius: 12px;
}

.own-only-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b42318;
  font-size: 13.5px;
  font-weight: 800;
}

.own-only-list {
  margin: 8px 0 0;
  padding-left: 22px;
  color: #5c2b26;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.6;
}

.own-only-payout {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #f0c8c8;
  color: #43514a;
  font-size: 13px;
  font-weight: 700;

  b {
    color: #0b4f36;
    font-size: 16px;
    font-weight: 900;
    white-space: nowrap;
  }
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
}

// ส่งเรื่องแล้ว: ขั้นต่อไปที่เทศบาลจะทำ
.next-steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  color: #33473d;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}
</style>
