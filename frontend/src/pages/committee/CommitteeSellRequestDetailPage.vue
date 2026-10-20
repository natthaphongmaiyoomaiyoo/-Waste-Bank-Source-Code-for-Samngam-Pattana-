<template>
  <q-page class="muni-page">
    <div class="muni-shell detail-shell">
      <q-btn
        flat
        no-caps
        dense
        icon="arrow_back"
        label="กลับไปหน้าคำขอ"
        class="back-btn"
        :to="
          detail ? `/committee/sell-requests/round/${detail.roundId}` : '/committee/sell-requests'
        "
      />

      <div v-if="store.requestDetail.loading" class="loading-wrap">
        <q-spinner-dots size="36px" color="green-8" />
      </div>

      <q-banner v-else-if="store.requestDetail.error" dense rounded class="error-banner">
        <template #avatar><q-icon name="error_outline" color="negative" /></template>
        {{ store.requestDetail.error }}
      </q-banner>

      <template v-else-if="detail">
        <!-- Member + request info -->
        <q-card flat class="panel-card">
          <div class="member-head">
            <div class="member-avatar">{{ detail.member.firstName.charAt(0) }}</div>
            <div class="member-info">
              <div class="member-name">
                {{ detail.member.prefix ?? '' }}{{ detail.member.firstName }}
                {{ detail.member.lastName }}
              </div>
              <div class="member-meta">
                <span v-if="detail.member.household?.moo" class="member-moo">
                  หมู่ {{ detail.member.household.moo }}
                </span>
                <span class="meta-item">
                  <q-icon name="badge" size="14px" /> รหัส {{ detail.member.memberCode }}
                </span>
                <span class="meta-item">
                  <q-icon name="call" size="14px" /> {{ detail.member.phone }}
                </span>
              </div>
            </div>
            <q-badge class="status-chip member-status" :class="statusMeta(detail.status).cls">
              <q-icon :name="statusMeta(detail.status).icon" size="13px" class="q-mr-xs" />
              {{ statusMeta(detail.status).label }}
            </q-badge>
          </div>

          <div class="fact-grid">
            <div class="fact">
              <div class="fact-icon"><q-icon name="schedule" /></div>
              <div class="fact-body">
                <div class="fact-label">แจ้งเมื่อ</div>
                <div class="fact-value">{{ formatDateTime(detail.requestDate) }}</div>
              </div>
            </div>
            <div class="fact">
              <div class="fact-icon"><q-icon name="event" /></div>
              <div class="fact-body">
                <div class="fact-label">รอบรับซื้อ</div>
                <div class="fact-value">
                  {{ formatDate(detail.round.roundDate) }} · {{ detail.round.startTime }}-{{
                    detail.round.endTime
                  }}
                  น.
                </div>
              </div>
            </div>
          </div>

          <!-- Address, coordinates and the way there, together in one place. -->
          <div class="location-box">
            <div class="location-head">
              <div class="fact-label location-label">
                <q-icon name="place" size="16px" /> แหล่งรับขยะ
              </div>
              <q-btn
                v-if="hasGeo"
                unelevated
                dense
                no-caps
                icon="near_me"
                label="นำทาง"
                class="navigate-btn"
                :href="`https://www.google.com/maps/dir/?api=1&destination=${detail.pickupLat},${detail.pickupLng}`"
                target="_blank"
              >
                <q-tooltip>เปิดเส้นทางด้วย Google Maps</q-tooltip>
              </q-btn>
            </div>
            <div class="loc-address">{{ pickupAddressText }}</div>
            <div v-if="hasGeo" class="loc-coords">
              พิกัด {{ detail.pickupLat!.toFixed(5) }}, {{ detail.pickupLng!.toFixed(5) }}
            </div>
            <div v-else class="fact-missing">
              <q-icon name="location_off" size="14px" /> ไม่ได้แชร์พิกัด
            </div>
          </div>

          <div v-if="detail.note" class="note-box">
            <q-icon name="sticky_note_2" size="16px" /> หมายเหตุ: {{ detail.note }}
          </div>

          <div class="action-row" v-if="detail.status === 'requested'">
            <div class="accept-hint">
              <q-icon name="info" size="16px" />
              รับเรื่องก่อน แล้วแบบฟอร์มบันทึกการรับซื้อจะแสดงขึ้นมา
            </div>
            <q-btn
              unelevated
              no-caps
              icon="how_to_reg"
              label="รับเรื่อง (กำลังไปรับ)"
              class="accept-btn"
              :loading="confirming"
              @click="confirmRequest"
            />
          </div>
        </q-card>

        <!-- Cancelled banner -->
        <q-banner
          v-if="detail.status === 'cancelled'"
          dense
          rounded
          class="cancelled-banner q-mt-lg"
        >
          <template #avatar><q-icon name="cancel" color="grey-7" /></template>
          คำร้องนี้ถูกยกเลิกแล้ว ไม่สามารถบันทึกการรับซื้อได้
        </q-banner>

        <!-- Purchase form: only once the committee has accepted the request and
             is out collecting it ('confirmed'). At 'requested' the weigh-in has
             not happened yet, so there is nothing real to record. -->
        <q-card v-else-if="detail.status === 'confirmed'" flat class="panel-card q-mt-lg">
          <div class="panel-head">
            <div>
              <div class="panel-title">บันทึกการรับซื้อจริง</div>
            </div>
            <q-icon name="scale" class="panel-deco" />
          </div>

          <div class="purchase-table q-mt-md">
            <div class="table-head">
              <span class="col-name">ประเภทขยะ</span>
              <span class="col-num">น้ำหนัก (กก.)</span>
              <span class="col-num">ราคา/กก.</span>
              <span class="col-num">รวม (บาท)</span>
              <span class="col-del"></span>
            </div>

            <div
              v-for="line in lines"
              :key="line.wasteTypeId"
              class="table-row"
              :class="{ 'is-extra': line.estimated === null, 'is-skipped': line.skipped }"
            >
              <span class="col-name">
                {{ line.name }}
                <q-badge v-if="line.estimated === null" class="extra-chip">เพิ่มหน้างาน</q-badge>
                <q-badge v-else-if="line.skipped" class="skip-chip">ไม่มีของ</q-badge>
              </span>
              <!-- data-label: the column name, shown above each cell when the row
                   becomes a card on a phone (the table head is hidden there). -->
              <span class="col-num cell-actual" data-label="น้ำหนัก (กก.)">
                <!-- `for` sets the native input's id, so a newly added line can
                     take the focus straight away (see addLine). -->
                <q-input
                  v-model.number="line.actual"
                  :for="`actual-${line.wasteTypeId}`"
                  type="number"
                  min="0"
                  dense
                  outlined
                  hide-bottom-space
                  no-error-icon
                  :disable="line.skipped"
                  :error="isNegativeWeight(line)"
                  error-message="ห้ามติดลบ"
                  input-class="text-center text-weight-bold"
                  class="qty-input"
                />
              </span>
              <span class="col-num cell-price" data-label="ราคา/กก.">
                <q-input
                  v-model.number="line.unitPrice"
                  type="number"
                  min="0"
                  step="0.5"
                  dense
                  outlined
                  :disable="line.skipped"
                  input-class="text-center"
                  class="qty-input"
                />
              </span>
              <span class="col-num subtotal-cell" data-label="รวม (บาท)">{{
                lineSubtotal(line).toLocaleString()
              }}</span>
              <span class="col-del">
                <!-- Added on site: nothing to keep, so drop the row outright.
                     On a phone the buttons carry a label: a tooltip can't be hovered. -->
                <q-btn
                  v-if="line.estimated === null"
                  flat
                  dense
                  no-caps
                  :round="!isPhone"
                  size="sm"
                  icon="delete_outline"
                  :label="isPhone ? 'ลบรายการ' : ''"
                  color="negative"
                  @click="removeLine(line.wasteTypeId)"
                >
                  <q-tooltip>ลบรายการที่เพิ่มหน้างาน</q-tooltip>
                </q-btn>
                <!-- Declared by the member: keep the row (it is the record of what
                     was promised) and just mark it as not collected. -->
                <q-btn
                  v-else
                  flat
                  dense
                  no-caps
                  :round="!isPhone"
                  size="sm"
                  :icon="line.skipped ? 'undo' : 'remove_shopping_cart'"
                  :label="isPhone ? (line.skipped ? 'กลับมารับซื้อ' : 'ไม่มีของ') : ''"
                  :color="line.skipped ? 'primary' : 'negative'"
                  @click="toggleSkipped(line)"
                >
                  <q-tooltip>
                    {{ line.skipped ? 'กลับมารับซื้อรายการนี้' : 'วันไปรับไม่มีของรายการนี้' }}
                  </q-tooltip>
                </q-btn>
              </span>
            </div>
          </div>

          <!-- Add a waste type found on site. Picking one adds the line at once;
               the select always stays empty, ready for the next one. -->
          <div class="add-row q-mt-md">
            <q-select
              :model-value="null"
              dense
              outlined
              emit-value
              map-options
              label="เพิ่มรายการขยะ"
              class="add-select"
              :options="addableWasteTypes"
              @update:model-value="addLine"
            >
              <template #prepend><q-icon name="add" /></template>
            </q-select>
          </div>

          <!-- Money summary, read top to bottom like a receipt:
               purchase - automatic top-up - extra savings = cash. -->
          <div class="money-box">
            <div class="money-row">
              <span class="money-label">ยอดรับซื้อ</span>
              <strong class="money-value">{{ totalAmount.toLocaleString() }} บาท</strong>
            </div>

            <div class="money-row">
              <span class="money-label">
                หักเข้าเงินสะสม
                <span class="money-sub">
                  <template v-if="currentContribution >= detail.fundMinimum">
                    ครบขั้นต่ำ {{ detail.fundMinimum.toLocaleString() }} บาทแล้ว
                  </template>
                  <template v-else>
                    มีแล้ว {{ currentContribution.toLocaleString() }} จากขั้นต่ำ
                    {{ detail.fundMinimum.toLocaleString() }} บาท
                  </template>
                </span>
              </span>
              <strong class="money-value" :class="{ 'is-muted': fundDeduct === 0 }">
                {{ fundDeduct > 0 ? '−' : '' }}{{ fundDeduct.toLocaleString() }} บาท
              </strong>
            </div>

            <!-- Once savings reach the minimum, the member splits what's left:
                 how much stays in savings, the rest goes home as cash. -->
            <div v-if="netAmount > 0" class="surplus-box">
              <div class="surplus-title">
                <q-icon name="savings" size="18px" />
                เก็บเข้าเงินสะสมเพิ่ม
              </div>
              <div class="surplus-input-row">
                <q-input
                  v-model.number="depositAmount"
                  @update:model-value="depositAll = false"
                  type="number"
                  dense
                  outlined
                  min="0"
                  :max="netAmount"
                  step="0.01"
                  suffix="บาท"
                  class="surplus-input"
                  :error="depositNegative || depositTooHigh"
                  :error-message="
                    depositNegative
                      ? 'จำนวนเงินติดลบไม่ได้'
                      : `เก็บได้ไม่เกิน ${netAmount.toLocaleString()} บาท`
                  "
                />
                <!-- One group, so the pair wraps together instead of splitting. -->
                <div class="surplus-quick-group">
                  <q-btn
                    unelevated
                    dense
                    no-caps
                    label="ไม่เก็บ"
                    class="surplus-quick"
                    :class="{ 'is-active': keptDeposit === 0 }"
                    @click="keepNoDeposit"
                  />
                  <q-btn
                    unelevated
                    dense
                    no-caps
                    label="เก็บทั้งหมด"
                    class="surplus-quick"
                    :class="{ 'is-active': keptDeposit === netAmount }"
                    @click="depositAll = true"
                  />
                </div>
              </div>
            </div>

            <div class="money-row money-total">
              <span class="money-label">จ่ายเงินสดให้สมาชิก</span>
              <strong class="money-value">{{ cashPaid.toLocaleString() }} บาท</strong>
            </div>
          </div>

          <q-input
            v-model="purchaseNote"
            dense
            outlined
            autogrow
            label="หมายเหตุการรับซื้อ (ไม่บังคับ)"
            class="q-mt-md note-input"
          />

          <!-- Proof photos. Picked here, uploaded right after the purchase is
               saved (the file has to hang off a sale row that exists). -->
          <div class="proof-box q-mt-md" :class="{ 'is-required': !queuedProofCount }">
            <div class="proof-head">
              <div>
                <div class="proof-title">
                  <q-icon name="photo_camera" size="18px" /> แนบหลักฐานการรับซื้อ
                  <span class="proof-required">*</span>
                </div>
                <div class="proof-caption">ใบเสร็จต้องมีอย่างน้อย 1 ไฟล์จึงจะบันทึกได้</div>
              </div>
            </div>

            <div class="proof-pick-row">
              <q-file
                v-model="proofFiles"
                multiple
                dense
                outlined
                use-chips
                counter
                accept="image/*,application/pdf"
                :max-files="MAX_PROOF_FILES"
                label="เลือกรูปหรือไฟล์ PDF"
                class="proof-file"
              >
                <template #prepend><q-icon name="attach_file" /></template>
              </q-file>
              <!-- Phones only: opens the camera straight away. A desktop browser
                   ignores `capture` and would just show the file picker again. -->
              <q-btn
                v-if="$q.platform.is.mobile"
                unelevated
                no-caps
                icon="photo_camera"
                label="ถ่ายรูป"
                class="camera-btn"
                @click="cameraInput?.click()"
              />
              <!-- Off-screen rather than display:none: some Android browsers
                   ignore `capture` on a hidden input and open the gallery. -->
              <!-- `android/allowCamera` is not a real MIME type: it is the known
                   workaround for Chrome on Android 14/15, which otherwise sends a
                   plain image/* input to the photo picker and skips the camera. -->
              <input
                ref="cameraInput"
                type="file"
                accept="image/*,android/allowCamera"
                capture="environment"
                class="camera-input"
                tabindex="-1"
                aria-hidden="true"
                @change="onCameraCapture"
              />
            </div>
          </div>

          <div class="submit-row">
            <!-- Every line skipped or zero: there is no purchase to record. The
                 right move is to cancel the request instead. -->
            <div v-if="negativeLineCount > 0" class="submit-hint submit-hint--error">
              <q-icon name="error_outline" size="16px" />
              น้ำหนักติดลบไม่ได้ แก้ช่องสีแดงก่อนจึงจะบันทึกได้
            </div>
            <div v-else-if="depositNegative" class="submit-hint submit-hint--error">
              <q-icon name="error_outline" size="16px" />
              จำนวนเงินที่เก็บเข้าเงินสะสมติดลบไม่ได้ แก้ช่องสีแดงก่อนจึงจะบันทึกได้
            </div>
            <div v-else-if="activeLineCount === 0" class="submit-hint">
              <q-icon name="info" size="16px" />
              ไม่มีรายการที่จะบันทึก ถ้าวันไปรับไม่มีของเลย ให้ยกเลิกคำร้องนี้จากหน้ารายการคำร้อง
            </div>
            <div v-else-if="!queuedProofCount" class="submit-hint">
              <q-icon name="photo_camera" size="16px" />
              แนบหลักฐานการรับซื้ออย่างน้อย 1 ไฟล์ก่อน จึงจะบันทึกได้
            </div>
            <q-btn
              unelevated
              no-caps
              icon="save"
              :label="`บันทึกรับซื้อ (${activeLineCount} รายการ)`"
              class="save-btn"
              :loading="saving"
              :disable="
                activeLineCount === 0 ||
                !queuedProofCount ||
                negativeLineCount > 0 ||
                depositNegative
              "
              @click="submitPurchase"
            />
          </div>
        </q-card>

        <!-- Completed: what was declared vs what was actually weighed. Scoped to
             'completed' so a request still waiting to be accepted doesn't render
             an empty result card. -->
        <q-card
          v-else-if="detail.status === 'completed'"
          flat
          class="panel-card receipt-card q-mt-lg"
        >
          <div class="result-head">
            <div class="panel-title">ผลการรับซื้อ</div>
            <div class="panel-caption">
              {{ detail.sale?.saleNo }}
              <template v-if="detail.sale?.receipt">
                · ใบเสร็จ {{ detail.sale.receipt.receiptNo }}</template
              >
              · บันทึก {{ detail.sale ? formatTime(detail.sale.saleDate) : '-' }}
            </div>
          </div>

          <!-- The cell classes carry the phone layout: at 599px the declared and
               difference columns drop out and the rest folds into a receipt line
               (see the .result-table rules in the mobile media query). -->
          <div class="result-table q-mt-md">
            <div class="table-head">
              <span class="col-name">ประเภทขยะ</span>
              <span class="col-num res-estimated">สมาชิกแจ้ง (กก.)</span>
              <span class="col-num res-actual">ชั่งได้จริง (กก.)</span>
              <span class="col-num res-diff">ส่วนต่าง</span>
              <span class="col-num res-price">ราคา/กก.</span>
              <span class="col-num res-sub">รวม (บาท)</span>
            </div>
            <div
              v-for="row in comparisonRows"
              :key="row.name"
              class="table-row"
              :class="{ 'is-extra': row.estimated === null, 'is-unsold': row.actual === null }"
            >
              <span class="col-name">
                {{ row.name }}
                <q-badge v-if="row.estimated === null" class="extra-chip">เพิ่มหน้างาน</q-badge>
                <q-badge v-else-if="row.actual === null" class="skip-chip">ไม่ได้รับซื้อ</q-badge>
              </span>
              <span class="col-num res-estimated">{{ row.estimated ?? '-' }}</span>
              <span class="col-num res-actual">{{ row.actual ?? '-' }}</span>
              <span class="col-num res-diff" :class="diffClass(row.diff)">
                {{ row.diff === null ? '-' : `${row.diff > 0 ? '+' : ''}${row.diff}` }}
              </span>
              <span class="col-num res-price">{{ row.unitPrice ?? '-' }}</span>
              <span class="col-num subtotal-cell res-sub">{{
                row.subtotal !== null ? row.subtotal.toLocaleString() : '-'
              }}</span>
            </div>
          </div>

          <div class="totals-grid" v-if="detail.sale">
            <div class="totals-row">
              <span>ยอดรับซื้อรวม</span>
              <strong>{{ detail.sale.totalAmount.toLocaleString() }} บาท</strong>
            </div>
            <div class="totals-row fund-row">
              <span>เติมเงินสะสมให้ครบขั้นต่ำ</span>
              <strong>{{ detail.sale.fundDeductAmount.toLocaleString() }} บาท</strong>
            </div>
            <div v-if="detail.savingsDeposit > 0" class="totals-row deposit-row">
              <span>เก็บเข้าเงินสะสมเพิ่ม</span>
              <strong>{{ detail.savingsDeposit.toLocaleString() }} บาท</strong>
            </div>
            <div class="totals-row net-row">
              <span>เงินสดที่จ่ายให้สมาชิก</span>
              <strong
                >{{ (detail.sale.netAmount - detail.savingsDeposit).toLocaleString() }} บาท</strong
              >
            </div>
          </div>
        </q-card>

        <!-- Proof of the purchase: its own card, and it stays available after the
             sale is recorded (photos are often taken on site and uploaded once
             the committee has signal again). -->
        <q-card v-if="detail.sale" flat class="panel-card q-mt-lg">
          <div class="result-head">
            <div class="panel-title">หลักฐานการรับซื้อ</div>
            <div class="panel-caption">
              รูปถ่ายหรือไฟล์ที่กรรมการแนบไว้เป็นหลักฐานการรับซื้อจริง ·
              {{ detail.sale.documents.length }} ไฟล์
            </div>
          </div>

          <div v-if="detail.sale.documents.length" class="proof-grid q-mt-md">
            <a
              v-for="document in detail.sale.documents"
              :key="document.id"
              class="proof-item"
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
              <div v-else class="proof-pdf"><q-icon name="picture_as_pdf" size="30px" /></div>
              <div class="proof-meta">
                <span class="proof-name">{{ document.originalName }}</span>
                <span class="proof-size">{{ formatFileSize(document.fileSize) }}</span>
              </div>
            </a>
          </div>

          <div v-else class="proof-empty q-mt-md">
            <q-icon name="image_not_supported" size="20px" /> ยังไม่มีหลักฐานแนบไว้
          </div>

          <div class="proof-add q-mt-md">
            <q-file
              v-model="proofFiles"
              multiple
              dense
              outlined
              use-chips
              accept="image/*,application/pdf"
              max-files="6"
              label="แนบหลักฐานเพิ่ม"
              class="proof-file"
            >
              <template #prepend><q-icon name="attach_file" /></template>
            </q-file>
            <q-btn
              unelevated
              no-caps
              label="อัปโหลด"
              class="proof-upload-btn"
              :loading="uploadingProof"
              :disable="!proofFiles || !proofFiles.length"
              @click="uploadProofFiles()"
            />
          </div>
        </q-card>
      </template>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useCommitteeRequestStore } from 'src/stores/committeeRequestStore';
import { apiErrorMessage } from 'src/utils/apiError';
import { sellRequestStatusMeta as statusMeta } from 'src/utils/sellRequestStatus';
import { compressImage, formatFileSize } from 'src/utils/imageCompress';
import { midNotify } from 'components/MID';

// One editable line of the purchase form. `estimated === null` marks a line
// the committee added on site (the member never declared that waste type).
// `skipped` marks a declared line that turned out not to be there on pickup day:
// the row stays visible (it is the record of what the member promised) but is
// left out of the purchase.
interface PurchaseLine {
  wasteTypeId: number;
  name: string;
  estimated: number | null;
  actual: number;
  unitPrice: number;
  skipped: boolean;
}

const route = useRoute();
const $q = useQuasar();
const store = useCommitteeRequestStore();
const isPhone = computed(() => $q.screen.lt.sm);

const requestId = Number(route.params.id);
const detail = computed(() => store.requestDetail.data);
const hasGeo = computed(
  () => !!detail.value && detail.value.pickupLat !== null && detail.value.pickupLng !== null,
);
const pickupAddressText = computed(() => {
  const request = detail.value;
  if (!request) return 'ไม่ได้ระบุที่อยู่';
  if (request.pickupAddress && !isUnreadableAddress(request.pickupAddress))
    return request.pickupAddress;

  const home = request.member.household;
  if (!home) return 'ไม่ได้ระบุที่อยู่';
  const parts = [
    home.houseNo ? `บ้านเลขที่ ${home.houseNo}` : null,
    home.moo ? `หมู่ ${home.moo}` : null,
    home.subdistrict ? `ต.${home.subdistrict}` : null,
    home.district ? `อ.${home.district}` : null,
    home.province ? `จ.${home.province}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' ') : 'ไม่ได้ระบุที่อยู่';
});

const lines = ref<PurchaseLine[]>([]);
const purchaseNote = ref('');
// How much of what's left after the automatic top-up the member keeps in
// savings; the rest is paid out in cash.
const depositAmount = ref<number | string | null>(0);
// Starts on "เก็บทั้งหมด" and keeps the amount equal to what's left as the weights
// change, until the committee types an amount or picks "ไม่เก็บ".
const depositAll = ref(true);
const saving = ref(false);
const confirming = ref(false);

// Proof photos/files queued in the picker, not yet uploaded.
const proofFiles = ref<File[] | null>(null);
const MAX_PROOF_FILES = 6;
const cameraInput = ref<HTMLInputElement | null>(null);

// A photo from the camera joins the files already picked (the q-file above
// shows it as one more chip), up to the same limit.
function onCameraCapture(event: Event) {
  const input = event.target as HTMLInputElement;
  const photo = input.files?.[0];
  // Cleared so taking another photo straight after still fires `change`.
  input.value = '';
  if (!photo) return;

  const current = proofFiles.value ?? [];
  if (current.length >= MAX_PROOF_FILES) {
    midNotify({ type: 'warning', message: `แนบได้สูงสุด ${MAX_PROOF_FILES} ไฟล์` });
    return;
  }
  proofFiles.value = [...current, photo];
}
const uploadingProof = ref(false);
const queuedProofCount = computed(() => proofFiles.value?.length ?? 0);

// Seed the editable lines from the member's declared items whenever the
// detail (re)loads and the request is still purchasable.
watch(detail, (value) => {
  if (!value || value.status === 'completed' || value.status === 'cancelled') return;
  depositAll.value = true;
  lines.value = value.items.map((item) => ({
    wasteTypeId: item.wasteTypeId,
    name: item.wasteType.wasteName,
    estimated: item.estimatedQuantity,
    actual: item.estimatedQuantity,
    unitPrice: item.wasteType.defaultPrice,
    skipped: false,
  }));
});

const addableWasteTypes = computed(() => {
  const used = new Set(lines.value.map((line) => line.wasteTypeId));
  return (store.wasteTypes.data ?? [])
    .filter((wt) => !used.has(wt.id))
    .map((wt) => ({ label: `${wt.wasteName} (${wt.defaultPrice} บาท/กก.)`, value: wt.id }));
});

function addLine(wasteTypeId: number | null) {
  const wasteType = (store.wasteTypes.data ?? []).find((wt) => wt.id === wasteTypeId);
  if (!wasteType) return;
  lines.value.push({
    wasteTypeId: wasteType.id,
    name: wasteType.wasteName,
    estimated: null,
    actual: 0,
    unitPrice: wasteType.defaultPrice,
    skipped: false,
  });

  // Straight into the new line's weight, with the 0 selected so typing replaces
  // it. After the render flush, so it also wins over the select's own refocus
  // as its menu closes.
  void nextTick(() => {
    const input = document.getElementById(`actual-${wasteType.id}`);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  });
}

function removeLine(wasteTypeId: number) {
  lines.value = lines.value.filter((line) => line.wasteTypeId !== wasteTypeId);
}

// "วันไปรับไม่มีของรายการนี้" - the declared row is kept rather than deleted so
// the committee can still see what the member promised (and undo in one click).
// Restoring puts the declared quantity back as the starting figure.
function toggleSkipped(line: PurchaseLine) {
  line.skipped = !line.skipped;
  line.actual = line.skipped ? 0 : (line.estimated ?? 0);
}

function lineSubtotal(line: PurchaseLine) {
  const quantity = Math.max(Number(line.actual) || 0, 0);
  const price = Math.max(Number(line.unitPrice) || 0, 0);
  return Math.round(quantity * price * 100) / 100;
}

// Colours the declared-vs-weighed difference in the read-only result table.
function diffClass(diff: number | null) {
  if (diff === null || diff === 0) return 'diff-zero';
  return diff > 0 ? 'diff-up' : 'diff-down';
}

function isUnreadableAddress(value: string): boolean {
  return /\?{3,}/.test(value);
}

// What actually gets bought: skipped rows and zero-weight rows are left out of
// the payload (a 0 means "not on this bill"), so the sale only carries what was
// really collected.
const activeLines = computed(() =>
  lines.value.filter((line) => !line.skipped && (Number(line.actual) || 0) > 0),
);
const activeLineCount = computed(() => activeLines.value.length);

// A negative weight is a typo, not "nothing collected": the field turns red and
// saving is blocked until it is fixed, rather than quietly dropping the line.
function isNegativeWeight(line: PurchaseLine): boolean {
  return !line.skipped && (Number(line.actual) || 0) < 0;
}
const negativeLineCount = computed(() => lines.value.filter(isNegativeWeight).length);

const totalAmount = computed(
  () =>
    Math.round(activeLines.value.reduce((sum, line) => sum + lineSubtotal(line), 0) * 100) / 100,
);
const currentContribution = computed(
  () => detail.value?.member.fundBalance?.totalContribution ?? 0,
);
const fundDeduct = computed(() => {
  const minimum = detail.value?.fundMinimum ?? 0;
  return (
    Math.round(
      Math.min(totalAmount.value, Math.max(minimum - currentContribution.value, 0)) * 100,
    ) / 100
  );
});
const netAmount = computed(() => Math.round((totalAmount.value - fundDeduct.value) * 100) / 100);
const depositValue = computed(
  () => Math.round(Math.max(Number(depositAmount.value) || 0, 0) * 100) / 100,
);
// A negative amount is a typo, not "keep nothing": the field turns red and
// saving is blocked until it is fixed, same rule as a negative weight.
const depositNegative = computed(() => Number(depositAmount.value) < 0);
// Weights can still change after the amount was typed, shrinking what's left.
const depositTooHigh = computed(() => netAmount.value > 0 && depositValue.value > netAmount.value);
// The totals show at most what's actually left; the input flags the excess and
// submitPurchase refuses it.
const keptDeposit = computed(() => Math.max(Math.min(depositValue.value, netAmount.value), 0));
const cashPaid = computed(() => Math.round((netAmount.value - keptDeposit.value) * 100) / 100);

watch(
  [netAmount, depositAll],
  ([net, all]) => {
    if (all) depositAmount.value = net;
  },
  { immediate: true },
);

function keepNoDeposit() {
  depositAll.value = false;
  depositAmount.value = 0;
}

// Completed view: merge declared items and actual sale lines by waste type.
const comparisonRows = computed(() => {
  const value = detail.value;
  if (!value?.sale) return [];

  const rows = new Map<
    number,
    {
      name: string;
      estimated: number | null;
      actual: number | null;
      diff: number | null;
      unitPrice: number | null;
      subtotal: number | null;
    }
  >();

  for (const item of value.items) {
    rows.set(item.wasteTypeId, {
      name: item.wasteType.wasteName,
      estimated: item.estimatedQuantity,
      actual: null,
      diff: null,
      unitPrice: null,
      subtotal: null,
    });
  }
  for (const line of value.sale.details) {
    const existing = rows.get(line.wasteTypeId);
    if (existing) {
      existing.actual = line.quantity;
      existing.diff =
        existing.estimated !== null
          ? Math.round((line.quantity - existing.estimated) * 100) / 100
          : null;
      existing.unitPrice = line.unitPrice;
      existing.subtotal = line.subtotal;
    } else {
      rows.set(line.wasteTypeId, {
        name: line.wasteType.wasteName,
        estimated: null,
        actual: line.quantity,
        diff: null,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
      });
    }
  }
  return [...rows.values()];
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

// เวลาอย่างเดียว - ใช้ในบรรทัดกำกับของการ์ดผลการรับซื้อ ที่มีวันที่อยู่ด้านบนแล้ว
function formatTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

// --- Purchase proof -----------------------------------------------------------------
// Photos go through compressImage() first: a phone shot is 3-8 MB, and a
// 1280 px JPEG at quality 0.6 is still plenty to read a scale display while
// taking ~5% of the space. PDFs pass through untouched.

async function uploadProofFiles(options: { silent?: boolean } = {}) {
  const files = proofFiles.value ?? [];
  if (!files.length) return;

  uploadingProof.value = true;
  const failed: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    try {
      await store.uploadSaleDocument(requestId, await compressImage(file));
      uploaded += 1;
    } catch {
      failed.push(file.name);
    }
  }

  uploadingProof.value = false;
  // Keep only what failed so the committee can retry without re-picking.
  proofFiles.value = failed.length ? files.filter((file) => failed.includes(file.name)) : null;

  if (failed.length) {
    midNotify({
      type: 'error',
      message: `แนบหลักฐานไม่สำเร็จ ${failed.length} ไฟล์ (${failed.join(', ')}) ลองอัปโหลดอีกครั้งได้`,
    });
  } else if (uploaded && !options.silent) {
    midNotify({ type: 'success', message: `แนบหลักฐาน ${uploaded} ไฟล์เรียบร้อย` });
  }

  if (uploaded && !options.silent) {
    await store.fetchRequestDetail(requestId);
  }
}

async function confirmRequest() {
  confirming.value = true;
  try {
    await store.confirmRequest(requestId);
    midNotify({ type: 'success', message: 'รับเรื่องแล้ว สถานะเปลี่ยนเป็น "กำลังไปรับ"' });
    await store.fetchRequestDetail(requestId);
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'รับเรื่องไม่สำเร็จ') });
  } finally {
    confirming.value = false;
  }
}

async function submitPurchase() {
  if (negativeLineCount.value > 0) {
    midNotify({ type: 'warning', message: 'น้ำหนักติดลบไม่ได้ แก้ช่องสีแดงก่อนบันทึก' });
    return;
  }
  if (depositNegative.value) {
    midNotify({
      type: 'warning',
      message: 'จำนวนเงินที่เก็บเข้าเงินสะสมติดลบไม่ได้ แก้ช่องสีแดงก่อนบันทึก',
    });
    return;
  }
  if (activeLines.value.length === 0) {
    midNotify({ type: 'warning', message: 'กรอกปริมาณชั่งจริงอย่างน้อย 1 รายการ' });
    return;
  }
  if (!queuedProofCount.value) {
    midNotify({ type: 'warning', message: 'ต้องแนบหลักฐานการรับซื้ออย่างน้อย 1 ไฟล์ก่อนบันทึก' });
    return;
  }
  if (depositTooHigh.value) {
    midNotify({
      type: 'warning',
      message: `เก็บเข้าเงินสะสมได้ไม่เกิน ${netAmount.value.toLocaleString()} บาท`,
    });
    return;
  }

  saving.value = true;
  try {
    // Proof travels with the purchase in one request, so a sale can never be
    // recorded without it. Photos are downscaled first.
    const documents = await Promise.all(
      (proofFiles.value ?? []).map((file) => compressImage(file)),
    );

    await store.recordPurchase(
      requestId,
      activeLines.value.map((line) => ({
        wasteTypeId: line.wasteTypeId,
        quantity: Number(line.actual),
        unitPrice: Number(line.unitPrice),
      })),
      keptDeposit.value,
      documents,
      purchaseNote.value.trim() || undefined,
    );
    proofFiles.value = null;
    midNotify({ type: 'success', message: 'บันทึกการรับซื้อพร้อมหลักฐานเรียบร้อยแล้ว' });
    await store.fetchRequestDetail(requestId);
    void store.fetchSummary();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกการรับซื้อไม่สำเร็จ') });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void store.fetchRequestDetail(requestId);
  void store.fetchWasteTypes();
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.detail-shell {
  width: min(1080px, 100%);
}

.back-btn {
  margin-bottom: 12px;
  color: #5f6f66;
  font-weight: 700;
}

// Avatar | name + meta | status. On a phone the status drops under the name, so the
// name keeps the full width instead of breaking mid-word beside the chip.
.member-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: 'avatar info status';
  align-items: center;
  gap: 14px;
}

.member-status {
  grid-area: status;
  justify-self: end;
}

.member-avatar {
  grid-area: avatar;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  min-width: 52px;
  color: #0d7a44;
  background: #eaf6ec;
  border-radius: 999px;
  font-size: 22px;
  font-weight: 900;
}

.member-info {
  grid-area: info;
  min-width: 0;
}

.member-name {
  color: #16352a;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.member-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 6px;
}

.member-moo {
  padding: 2px 10px;
  color: #0d7a44;
  background: #eaf6ec;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6b7c72;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.meta-item .q-icon {
  color: #98a19d;
}

@media (max-width: 599px) {
  .member-head {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'avatar info'
      '.      status';
    row-gap: 10px;
  }

  .member-status {
    justify-self: start;
  }
}

// Request facts as icon + label/value pairs: scannable at a glance on a phone in the field.
.fact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px 24px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e7ece8;
}

.fact {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fact-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  min-width: 38px;
  color: #0d7a44;
  background: #f0f7f2;
  border-radius: 12px;
  font-size: 19px;
}

.fact-body {
  min-width: 0;
}

.fact-label {
  color: #98a19d;
  font-size: 12px;
  font-weight: 600;
}

.fact-value {
  margin-top: 2px;
  color: #16352a;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.fact-missing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  color: #b9821f;
  font-size: 12.5px;
  font-weight: 600;
}

.status-chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.chip-wait {
  color: #8a5a12;
  background: #fff4e5;
}
.chip-going {
  color: #1565c0;
  background: #e3f0fd;
}
.chip-done {
  color: #0d7a44;
  background: #e9f7ee;
}
.chip-off {
  color: #667066;
  background: #eef1f0;
}

.location-box {
  margin-top: 16px;
  padding: 14px 16px;
  background: #f7faf8;
  border: 1px solid #e3ece2;
  border-radius: 14px;
}

.location-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.location-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.location-label .q-icon {
  color: #0d7a44;
}

.loc-address {
  margin-top: 6px;
  color: #16352a;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.loc-coords {
  margin-top: 4px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

// A small tonal button: a helper, not the page's main action.
.navigate-btn {
  padding: 2px 12px;
  color: #1565c0;
  background: #e3f0fd;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
}

.navigate-btn :deep(.q-icon) {
  font-size: 16px;
}

.note-box {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 14px;
  color: #6a5b22;
  background: #fdf8e7;
  border: 1px solid #f1e5b8;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #e7ece8;
}

.accept-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 600;
}

// The page's one main action: solid green and full size, clearly apart from the
// small blue navigate button.
.accept-btn {
  min-height: 44px;
  padding: 0 22px;
  color: #ffffff;
  background: #0d7a44;
  border-radius: 12px;
  font-weight: 800;
  box-shadow: 0 6px 16px rgba(13, 122, 68, 0.22);
}

@media (max-width: 599px) {
  .accept-hint {
    margin-right: 0;
  }

  .accept-btn {
    width: 100%;
  }
}

.cancelled-banner {
  color: #667066;
  background: #eef1f0;
  border: 1px solid #dde3de;
  border-radius: 14px;
  font-weight: 700;
}

.panel-deco {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  color: #1e8a44;
  background: #eaf6ec;
  border: 1px solid #dcefe1;
  border-radius: 14px;
  font-size: 22px;
}

// --- Purchase / comparison table ---------------------------------------------

.purchase-table {
  overflow-x: auto;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
}

// Read-only result table: no box around it, just ruled rows like the mockup.
.result-table {
  overflow-x: auto;
}

.result-table .table-head {
  background: transparent;
  border-bottom: 1px solid #eef3ee;
}

.result-table .table-head,
.result-table .table-row {
  grid-template-columns: minmax(160px, 1.6fr) repeat(5, minmax(88px, 1fr));
  padding: 12px 4px;
}

.result-table .col-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.result-head .panel-title {
  font-size: 17px;
}

.result-head .panel-caption {
  font-variant-numeric: tabular-nums;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: minmax(160px, 1.6fr) repeat(5, minmax(88px, 1fr)) 40px;
  gap: 8px;
  align-items: center;
  min-width: 720px;
  padding: 10px 14px;
}

// Completed view has no delete column - last track collapses harmlessly.

// The purchase form has no declared/difference columns (members no longer declare
// waste types): name, weighed, price, total, delete.
.purchase-table .table-head,
.purchase-table .table-row {
  grid-template-columns: minmax(160px, 1.6fr) repeat(3, minmax(100px, 1fr)) 40px;
  min-width: 540px;
}

.table-head {
  color: #7d8a83;
  background: #f5f8f5;
  font-size: 12px;
  font-weight: 700;
}

.table-row {
  border-top: 1px solid #eef3ee;
  color: #2c3b33;
  font-size: 13.5px;
  font-weight: 600;
}

.table-row.is-extra {
  background: #fbf7ef;
}

// Declared but not there on pickup day - dimmed, left in place for reference.
.table-row.is-skipped {
  background: #f4f6f4;
  opacity: 0.72;
}

.table-row.is-skipped .col-name {
  text-decoration: line-through;
  text-decoration-color: #9aa6a0;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}

.col-num {
  text-align: center;
}

.subtotal-cell {
  color: #0d7a44;
  font-weight: 800;
}

.qty-input {
  max-width: 110px;
  margin: 0 auto;
}

.qty-input :deep(.q-field__control) {
  border-radius: 10px;
  background: #ffffff;
}

.extra-chip {
  padding: 3px 8px;
  color: #8a5a12;
  background: #fff4e5;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
}

.skip-chip {
  padding: 3px 8px;
  color: #667066;
  background: #eef1f0;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
}

// Declared vs weighed difference in the read-only result table.
.diff-up {
  color: #0d7a44;
}
.diff-down {
  color: #b45050;
}
.diff-zero {
  color: #667066;
}

.add-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.add-select {
  min-width: min(360px, 100%);
}

.add-select :deep(.q-field__control) {
  border-radius: 12px;
  background: #fbfdfb;
}

.totals-grid {
  display: grid;
  gap: 8px;
  max-width: 460px;
  margin-left: auto;
  padding-top: 14px;
}

.totals-row strong {
  font-variant-numeric: tabular-nums;
}

.totals-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: #5f6f66;
  font-size: 13.5px;
  font-weight: 700;
}

.totals-row strong {
  color: #16352a;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
}

.fund-row strong {
  color: #b9821f;
}

.deposit-row strong {
  color: #1565c0;
}

.net-row {
  padding-top: 8px;
  border-top: 1px dashed #e0ebe2;
}

.net-row strong {
  color: #0d7a44;
  font-size: 20px;
}

// --- Money summary (purchase form) -------------------------------------------------

.money-box {
  display: grid;
  gap: 12px;
  max-width: 520px;
  margin: 16px 0 0 auto;
  padding: 16px 18px;
  background: #fbfdfb;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
}

.money-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.money-label {
  color: #5f6f66;
  font-size: 13.5px;
  font-weight: 700;
}

.money-sub {
  display: block;
  margin-top: 2px;
  color: #98a19d;
  font-size: 12px;
  font-weight: 600;
}

.money-value {
  color: #16352a;
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.money-value.is-muted {
  color: #98a19d;
}

.money-total {
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e4ebe5;
}

.money-total .money-label {
  color: #16352a;
  font-size: 14.5px;
  font-weight: 800;
}

.money-total .money-value {
  color: #0d7a44;
  font-size: 22px;
  font-weight: 900;
}

.surplus-box {
  padding: 12px 14px;
  background: #f3f8fd;
  border: 1px solid #d7e7f7;
  border-radius: 12px;
}

.surplus-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #114f8c;
  font-size: 13.5px;
  font-weight: 800;
}

.surplus-input-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
}

.surplus-input {
  flex: 1 1 140px;
}

.surplus-input :deep(.q-field__control) {
  border-radius: 10px;
  background: #ffffff;
}

.surplus-quick-group {
  display: flex;
  gap: 8px;
}

// Same height as the dense input beside them; the chosen one is filled.
.surplus-quick {
  min-height: 40px;
  padding: 0 14px;
  color: #114f8c;
  background: #ffffff;
  border: 1px solid #cfe0f2;
  border-radius: 10px;
  font-weight: 700;
}

.surplus-quick.is-active {
  color: #ffffff;
  background: #1565c0;
  border-color: #1565c0;
}

.note-input :deep(.q-field__control) {
  border-radius: 12px;
  background: #fbfdfb;
}

// --- Purchase proof -----------------------------------------------------------------

.proof-box {
  padding: 14px 16px;
  background: #fbfdfb;
  border: 1px dashed #d7e4da;
  border-radius: 14px;
}

// Nothing attached yet: proof is required, so make the box look outstanding.
.proof-box.is-required {
  background: #fffdf6;
  border-color: #e6c98a;
}

.proof-required {
  color: #c0392b;
  font-weight: 900;
}

.proof-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #16352a;
  font-size: 14px;
  font-weight: 800;
}

.proof-caption {
  margin-top: 3px;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
}

.proof-file :deep(.q-field__control) {
  border-radius: 12px;
  background: #ffffff;
}

.proof-pick-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
}

.proof-pick-row .proof-file {
  flex: 1;
  min-width: 0;
}

.camera-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

// Same height as the dense file field beside it.
.camera-btn {
  min-height: 40px;
  padding: 0 14px;
  color: #ffffff;
  background: #0d7a44;
  border-radius: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}

.proof-item {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 12px;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.proof-item:hover {
  border-color: #17a24f;
  box-shadow: 0 6px 18px rgba(16, 116, 74, 0.12);
}

.proof-item img,
.proof-pdf {
  display: block;
  width: 100%;
  height: 104px;
  object-fit: cover;
}

.proof-pdf {
  display: grid;
  place-items: center;
  color: #c0392b;
  background: #fdf3f2;
}

.proof-meta {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
}

.proof-name {
  overflow: hidden;
  color: #2c3b33;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.proof-size {
  color: #98a19d;
  font-size: 11px;
  font-weight: 600;
}

.proof-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #98a19d;
  font-size: 13px;
  font-weight: 600;
}

.proof-add {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.proof-add .proof-file {
  flex: 1 1 260px;
}

.proof-upload-btn {
  min-height: 40px;
  padding: 0 20px;
  color: #ffffff;
  background: #0f9d52;
  border-radius: 12px;
  font-weight: 700;
}

.submit-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.submit-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: #8a5a12;
  font-size: 12.5px;
  font-weight: 600;
}

.submit-hint--error {
  color: #c62828;
}

.save-btn {
  min-height: 46px;
  padding: 0 28px;
  color: #ffffff;
  background: linear-gradient(135deg, #0f9d52, #17c13f);
  border-radius: 999px;
  box-shadow: 0 8px 20px rgba(23, 193, 63, 0.3);
  font-weight: 900;
}

// --- Phone: the purchase form ---------------------------------------------------------
// The line table needs 540px, so on a phone each line becomes a card:
//   name
//   weighed     | price/kg      (the two inputs, side by side)
//   skip/delete | line total
@media (max-width: 599px) {
  .purchase-table {
    display: grid;
    gap: 10px;
    overflow: visible;
    border: none;
    border-radius: 0;
  }

  .purchase-table .table-head {
    display: none;
  }

  .purchase-table .table-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'name   name'
      'actual price'
      'del    sub';
    gap: 12px;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid #e4ebe5;
    border-radius: 14px;
  }

  .purchase-table .col-name {
    grid-area: name;
    flex-wrap: wrap;
    font-size: 14.5px;
  }

  .purchase-table .col-num {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: left;
  }

  .purchase-table .col-num::before {
    content: attr(data-label);
    color: #7d8a83;
    font-size: 11.5px;
    font-weight: 700;
  }

  .purchase-table .cell-actual {
    grid-area: actual;
  }
  .purchase-table .cell-price {
    grid-area: price;
  }

  .purchase-table .cell-actual,
  .purchase-table .cell-price {
    align-items: stretch;
  }

  .purchase-table .qty-input {
    max-width: none;
    margin: 0;
  }

  // Line total, bottom right: "รวม (บาท) 48" on one line.
  .purchase-table .subtotal-cell {
    grid-area: sub;
    flex-direction: row;
    align-items: baseline;
    justify-content: flex-end;
    gap: 6px;
    font-size: 16px;
  }

  .purchase-table .col-del {
    grid-area: del;
    align-self: center;
    justify-self: start;
  }

  // --- Phone: the finished sale reads as a receipt ----------------------------
  // Six columns never fit a phone, and once the sale is recorded the declared
  // weight and the difference are history - what matters is the weight, the rate
  // and what it paid. Those two columns drop out and each waste type folds into
  // a single bill line.
  .receipt-card .result-head {
    text-align: center;
  }

  .receipt-card .result-head .panel-caption {
    line-height: 1.7;
  }

  .result-table {
    display: grid;
    overflow: visible;
    padding-top: 2px;
    border-top: 1px dashed #d8e3da;
  }

  .result-table .table-head {
    display: none;
  }

  .result-table .res-estimated,
  .result-table .res-diff {
    display: none;
  }

  .result-table .table-row {
    grid-template-columns: auto auto minmax(0, 1fr);
    grid-template-areas:
      'name  name  name'
      'qty   price sub';
    gap: 3px 6px;
    min-width: 0;
    padding: 11px 2px;
    border-top: none;
  }

  .result-table .table-row + .table-row {
    border-top: 1px dashed #e7efe8;
  }

  .result-table .col-name {
    grid-area: name;
    flex-wrap: wrap;
    font-size: 14.5px;
  }

  // "น้ำหนัก 2 กก. x 3.5 บาท" - one quiet line under the waste type name.
  .result-table .res-actual,
  .result-table .res-price {
    align-self: baseline;
    color: #7d8a83;
    font-size: 12.5px;
    font-weight: 700;
  }

  .result-table .res-actual {
    grid-area: qty;
  }

  .result-table .res-actual::before {
    content: 'น้ำหนัก ';
  }

  .result-table .res-actual::after {
    content: ' กก.';
  }

  .result-table .res-price {
    grid-area: price;
  }

  .result-table .res-price::before {
    content: '× ';
  }

  .result-table .res-price::after {
    content: ' บาท';
  }

  .result-table .res-sub {
    grid-area: sub;
    align-self: baseline;
    font-size: 15px;
  }

  // Declared but never weighed: no weight, no rate, no money to show - the
  // "ไม่ได้รับซื้อ" chip next to the name already says it.
  .result-table .is-unsold .res-actual,
  .result-table .is-unsold .res-price,
  .result-table .is-unsold .res-sub {
    display: none;
  }

  // Totals sit below the tear line, the way a receipt ends.
  .receipt-card .totals-grid {
    padding-top: 14px;
    border-top: 1px dashed #d8e3da;
  }

  .add-select {
    flex: 1 1 100%;
  }

  .totals-grid {
    max-width: none;
  }

  .money-box {
    padding: 14px;
  }

  // Phone: the amount gets its own row, the two buttons share the row below.
  .surplus-input,
  .surplus-quick-group {
    flex: 1 1 100%;
  }

  .surplus-quick {
    flex: 1;
  }

  .proof-box {
    padding: 12px 14px;
  }

  .submit-hint {
    align-items: flex-start;
    margin-right: 0;
  }

  .submit-hint .q-icon {
    margin-top: 2px;
  }

  .save-btn {
    width: 100%;
  }
}
</style>
