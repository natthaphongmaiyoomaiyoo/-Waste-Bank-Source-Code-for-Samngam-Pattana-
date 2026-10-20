<template>
  <q-btn
    flat
    dense
    round
    icon="notifications"
    :class="['notification-bell', { 'is-ringing': ringing }]"
    :aria-label="badgeCount ? `การแจ้งเตือน ${badgeCount} รายการใหม่` : 'การแจ้งเตือน'"
    @animationend="ringing = false"
  >
    <q-badge v-if="badgeCount" floating rounded color="red-6">
      {{ badgeCount }}
    </q-badge>

    <q-menu anchor="bottom right" self="top right" @before-show="onMenuOpen" @hide="onMenuHide">
      <div class="alerts-menu">
        <template v-if="hints.length || notificationItems.length">
          <div class="alerts-head">
            <div class="alerts-title">
              <q-icon name="notifications" />
              การแจ้งเตือน
            </div>
          </div>

          <div class="alerts-list">
            <!-- Reminders worked out from the member's own data: they go straight
                 to the page that resolves them. -->
            <router-link
              v-for="hint in hints"
              :key="hint.key"
              v-close-popup
              :to="hint.to"
              :class="['alert-row', { 'is-unread': hintsNewAtOpen.has(hintSignature(hint)) }]"
            >
              <span :class="['alert-dot', hint.tone]">
                <q-icon :name="hint.icon" />
              </span>
              <span class="alert-body">
                <span class="alert-message">{{ hint.message }}</span>
              </span>
              <span
                v-if="hintsNewAtOpen.has(hintSignature(hint))"
                class="alert-unread"
                aria-label="ใหม่"
              />
              <q-icon name="chevron_right" class="alert-arrow" />
            </router-link>

            <!-- A notification stays unread (dot + badge) until the member opens
                 it. -->
            <button
              v-for="item in visibleNotifications"
              :key="item.notification.id"
              v-close-popup
              type="button"
              :class="['alert-row', { 'is-unread': !item.notification.isRead }]"
              @click="openNotification(item)"
            >
              <span :class="['alert-dot', item.meta.tone]">
                <q-icon :name="item.meta.icon" />
              </span>
              <span class="alert-body">
                <span class="alert-title">{{ item.notification.title }}</span>
                <span class="alert-message">{{ item.message }}</span>
                <span class="alert-time">{{ item.when }}</span>
              </span>
              <span v-if="!item.notification.isRead" class="alert-unread" aria-label="ยังไม่อ่าน" />
            </button>
          </div>

          <button
            v-if="visibleCount < notificationItems.length"
            type="button"
            class="alerts-more"
            @click.stop="visibleCount += NOTIFICATIONS_PAGE_SIZE"
          >
            อ่านแจ้งเตือนเพิ่ม
            <q-icon name="expand_more" />
          </button>
        </template>

        <div v-else class="alerts-empty">
          <q-icon name="notifications_none" />
          ไม่มีการแจ้งเตือน
        </div>
      </div>
    </q-menu>
  </q-btn>

  <MidDialog
    v-model="detailOpen"
    size="sm"
    :badge="selected?.meta.label"
    :icon="selected?.meta.icon"
    :title="selected?.notification.title ?? ''"
    :caption="selected?.when"
  >
    <template v-if="selectedRound">
      <dl class="notification-detail-rows">
        <div>
          <dt><q-icon name="event" />วันที่</dt>
          <dd>{{ selectedRound.date }}</dd>
        </div>
        <div>
          <dt><q-icon name="schedule" />เวลา</dt>
          <dd>{{ selectedRound.time }}</dd>
        </div>
        <div v-if="selectedRound.location">
          <dt><q-icon name="place" />สถานที่</dt>
          <dd>{{ selectedRound.location }}</dd>
        </div>
      </dl>
      <p class="notification-detail-note">
        <q-icon name="check_circle" />
        {{ selectedRound.note }}
      </p>
    </template>
    <p v-else class="notification-detail">{{ selected?.message }}</p>

    <!-- Own row instead of MidDialog's 50/50 actions grid, so the main button
         gets the width its label needs and doesn't wrap. -->
    <div class="notification-detail-actions">
      <MidButton
        class="notification-detail-close"
        variant="secondary"
        label="ปิด"
        @click="detailOpen = false"
      />
      <MidButton
        class="notification-detail-go"
        :label="selected?.meta.action"
        icon-right="arrow_forward"
        @click="goToSelected"
      />
    </div>
  </MidDialog>

  <q-dialog v-model="showFuneralDialog" transition-show="scale" transition-hide="fade">
    <q-card class="funeral-dialog">
      <q-card-section class="funeral-dialog-head">
        <div class="funeral-dialog-icon">
          <q-icon name="campaign" />
        </div>
        <div class="funeral-dialog-heading">
          <div class="funeral-dialog-title">แจ้งสมาชิกเสียชีวิต</div>
        </div>
        <q-btn
          flat
          dense
          round
          icon="close"
          aria-label="เก็บการแจ้งเตือนไว้ในกระดิ่ง"
          @click="showFuneralDialog = false"
        >
          <q-tooltip>เก็บไว้ในกระดิ่ง</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-separator />

      <q-card-section class="funeral-dialog-list">
        <div
          v-for="notice in recentFuneralNotices"
          :key="notice.notification.id"
          class="funeral-dialog-item"
        >
          <q-icon name="account_balance_wallet" />
          <div class="funeral-dialog-item-body">
            <div class="funeral-dialog-item-title">{{ notice.notification.title }}</div>
            <div class="funeral-dialog-item-when">{{ notice.when }}</div>

            <dl v-if="notice.details" class="funeral-notice-rows">
              <div>
                <dt>ผู้เสียชีวิต</dt>
                <dd>{{ notice.details.deceasedName }}</dd>
              </div>
              <div>
                <dt>หักจากเงินสะสมของท่าน</dt>
                <dd class="is-paid">{{ notice.details.paid }} บาท</dd>
              </div>
              <div v-if="notice.details.shortfall">
                <dt>ยังขาด</dt>
                <dd class="is-short">{{ notice.details.shortfall }} บาท</dd>
              </div>
            </dl>
            <div v-else class="funeral-dialog-item-message">
              {{ funeralNotificationMessage(notice.notification) }}
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="funeral-dialog-actions">
        <q-btn
          flat
          no-caps
          icon="notifications_off"
          label="ไม่ต้องแสดงอีก"
          color="grey-8"
          :loading="dismissingFuneralNotifications"
          @click="dismissFuneralNotifications"
        />
        <q-btn
          unelevated
          no-caps
          icon-right="notifications"
          label="เก็บไว้ในกระดิ่ง"
          class="funeral-dialog-collapse"
          @click="showFuneralDialog = false"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MidButton, MidDialog, isoToThaiShortDate } from 'components/MID';
import { useMemberProfileStore } from 'src/stores/memberProfileStore';
import { useNotificationStore } from 'src/stores/notificationStore';
import type { AppNotification } from 'src/stores/notificationStore';
import { api } from 'src/boot/axios';
import { getAuthItem } from 'src/utils/authStorage';

const router = useRouter();
const profileStore = useMemberProfileStore();
const notificationStore = useNotificationStore();

// Latest notifications listed when the menu opens; "อ่านแจ้งเตือนเพิ่ม" shows
// this many more each press.
const NOTIFICATIONS_PAGE_SIZE = 3;

const visibleCount = ref(NOTIFICATIONS_PAGE_SIZE);
const pendingSellRequestsCount = ref(0);
const showFuneralDialog = ref(false);
const dismissingFuneralNotifications = ref(false);
// Set on arrival when the badge has something to count; the CSS rings the bell
// 5 times and animationend clears it.
const ringing = ref(false);
const FUNERAL_NOTIFICATION_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const LEGACY_FUNERAL_NOTIFICATION_TITLE = 'หักเงินสมทบฌาปนกิจ';

async function loadPendingSellRequestsCount() {
  try {
    const { data } = await api.get<{ byStatus: Record<string, number> }>('/sell-requests/summary');
    pendingSellRequestsCount.value =
      (data.byStatus.requested ?? 0) + (data.byStatus.confirmed ?? 0);
  } catch {
    pendingSellRequestsCount.value = 0;
  }
}

// waste_type alerts reach two roles from opposite ends of the same flow, so the
// link has to follow the reader: the admin lands on the approval queue, the
// buyer on their own proposal list.
const wasteTypeAlertPath = getAuthItem('role') === 'admin' ? '/waste-types' : '/buyer/waste-types';

interface NotificationMeta {
  label: string;
  icon: string;
  tone: string;
  to: string;
  // The detail dialog's main button, named after where it goes.
  action: string;
}

const notificationTypeMeta: Record<string, NotificationMeta> = {
  sell_request: {
    label: 'คำขอขายขยะ',
    icon: 'recycling',
    tone: 'tone-green',
    to: '/sell-request-history',
    action: 'ดูคำขอขายขยะ',
  },
  // A new collection round opened in the member's village.
  schedule: {
    label: 'รอบรับซื้อ',
    icon: 'event',
    tone: 'tone-green',
    to: '/schedule',
    action: 'ไปที่ตารางรับซื้อ',
  },
  fund: {
    label: 'เงินสะสม',
    icon: 'savings',
    tone: 'tone-blue',
    to: '/history',
    action: 'ดูประวัติเงินสะสม',
  },
  funeral: {
    label: 'ฌาปนกิจ',
    icon: 'campaign',
    tone: 'tone-amber',
    to: '/history',
    action: 'ดูประวัติเงินสะสม',
  },
  waste_type: {
    label: 'ประเภทขยะ',
    icon: 'local_shipping',
    tone: 'tone-green',
    to: wasteTypeAlertPath,
    action: 'ดูประเภทขยะ',
  },
  // Only buyers receive these - the committee sees plan progress on its own page.
  route_plan: {
    label: 'แผนที่รับซื้อ',
    icon: 'route',
    tone: 'tone-green',
    to: '/buyer/route-plan',
    action: 'ดูแผนที่รับซื้อ',
  },
};

const FALLBACK_META: NotificationMeta = {
  label: 'การแจ้งเตือน',
  icon: 'notifications',
  tone: 'tone-blue',
  to: '/dashboard',
  action: 'ไปที่หน้าหลัก',
};

interface HintItem {
  key: string;
  message: string;
  icon: string;
  tone: string;
  to: string;
}

interface NotificationItem {
  notification: AppNotification;
  meta: NotificationMeta;
  message: string;
  when: string;
}

function isFuneralNotification(notification: AppNotification) {
  return (
    notification.notificationType === 'funeral' ||
    (notification.notificationType === 'fund' &&
      notification.title === LEGACY_FUNERAL_NOTIFICATION_TITLE)
  );
}

function isActiveFuneralNotification(notification: AppNotification) {
  return (
    isFuneralNotification(notification) &&
    new Date(notification.createdAt).getTime() >= Date.now() - FUNERAL_NOTIFICATION_LIFETIME_MS
  );
}

function funeralNotificationMessage(notification: AppNotification) {
  if (notification.message.includes('50')) return notification.message;
  return `${notification.message} และหักเงินสะสม 50 บาทเข้ากองทุนฌาปนกิจ`;
}

// "17 ก.ย. 2569 · 13:52 น." in the viewer's local time.
function formatWhen(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDay = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${isoToThaiShortDate(isoDay)} · ${pad(date.getHours())}:${pad(date.getMinutes())} น.`;
}

// Funeral notices expire after three days; everything else stays listed, read
// or not, newest first.
const notificationItems = computed<NotificationItem[]>(() =>
  notificationStore.notifications
    .filter((n) => !isFuneralNotification(n) || isActiveFuneralNotification(n))
    .map((notification) => {
      const funeral = isFuneralNotification(notification);
      return {
        notification,
        meta:
          notificationTypeMeta[funeral ? 'funeral' : notification.notificationType] ??
          FALLBACK_META,
        message: funeral ? funeralNotificationMessage(notification) : notification.message,
        when: formatWhen(notification.createdAt),
      };
    }),
);

const visibleNotifications = computed(() =>
  notificationItems.value.slice(0, visibleCount.value),
);

const hints = computed(() => {
  const list: HintItem[] = [];

  // Profile-derived alerts only once the profile has actually loaded - otherwise
  // the zero defaults would produce false "fund below minimum" warnings.
  if (profileStore.profile.code) {
    if (!profileStore.hasMinimumFund) {
      list.push({
        key: 'fund-below-minimum',
        message: `เงินสะสมของคุณยังขาดอีก ${profileStore.fundShortfall.toLocaleString()} บาท จึงจะครบขั้นต่ำ ${profileStore.profile.fundMinimum} บาท`,
        icon: 'error_outline',
        tone: 'tone-amber',
        to: '/sell-request',
      });
    }

    if (pendingSellRequestsCount.value > 0) {
      list.push({
        key: 'pending-sell-requests',
        message: `คุณมีคำขอขายขยะที่รอดำเนินการ ${pendingSellRequestsCount.value} รายการ`,
        icon: 'schedule_send',
        tone: 'tone-blue',
        to: '/sell-request-history',
      });
    }

    if (profileStore.remainingMonths > 0 && profileStore.remainingMonths <= 2) {
      list.push({
        key: 'eligibility-near',
        message: `ใกล้ครบเงื่อนไขรับสิทธิพิเศษแล้ว อีก ${profileStore.remainingMonths} เดือน`,
        icon: 'star',
        tone: 'tone-green',
        to: '/schedule',
      });
    }
  }

  return list;
});

// --- Unread count -----------------------------------------------------------------

// Reminders aren't stored server-side, so which wordings the member has already
// seen is remembered in this browser. A reminder whose wording changes (6 pending
// requests becoming 7) counts as new again.
function hintSignature(hint: HintItem) {
  return `${hint.key}:${hint.message}`;
}

const seenHints = ref(new Set<string>());
const seenHintsStorageKey = () => `bellSeenHints:${profileStore.profile.code}`;

watch(
  () => profileStore.profile.code,
  (code) => {
    if (!code) return;
    try {
      const stored = localStorage.getItem(seenHintsStorageKey());
      seenHints.value = new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      seenHints.value = new Set();
    }
  },
  // sync, so the count is right as soon as the profile lands - onMounted reads it
  // straight after awaiting the fetch.
  { immediate: true, flush: 'sync' },
);

function markHintsSeen() {
  seenHints.value = new Set(hints.value.map(hintSignature));
  try {
    localStorage.setItem(seenHintsStorageKey(), JSON.stringify([...seenHints.value]));
  } catch {
    // Storage blocked - the reminders just count as new again next visit.
  }
}

const unreadNotifications = computed(() =>
  notificationItems.value.filter((item) => !item.notification.isRead),
);
const unseenHints = computed(() =>
  hints.value.filter((hint) => !seenHints.value.has(hintSignature(hint))),
);

// Matches the rows carrying a dot when the menu opens.
const badgeCount = computed(() => unreadNotifications.value.length + unseenHints.value.length);

// --- Menu -------------------------------------------------------------------------

// Reminders show their whole message in the row, so opening the menu counts as
// reading them. They keep their dot until the menu closes so the member can tell
// them apart.
const hintsNewAtOpen = ref(new Set<string>());

function onMenuOpen() {
  hintsNewAtOpen.value = new Set(unseenHints.value.map(hintSignature));
  markHintsSeen();
}

function onMenuHide() {
  visibleCount.value = NOTIFICATIONS_PAGE_SIZE;
}

// --- Notification detail ---------------------------------------------------------

const detailOpen = ref(false);
const selected = ref<NotificationItem | null>(null);

// Opening a notification reads it, which takes it off the badge.
function openNotification(item: NotificationItem) {
  selected.value = item;
  detailOpen.value = true;
  void notificationStore.markRead([item.notification.id]);
}

interface RoundNoticeDetails {
  date: string;
  time: string;
  location: string | null;
  note: string;
}

// Splits the sentence committeeRoundService.notifyVillageMembers writes
// ("วันที่ … เวลา 12:00-18:00 น. (สถานที่) แจ้งขายขยะได้แล้ว") into labelled rows.
// Any other wording returns null and the dialog shows the plain sentence.
function parseRoundNotice(message: string): RoundNoticeDetails | null {
  const match = message.match(
    /^วันที่ (.+?) เวลา (\d{1,2}:\d{2}-\d{1,2}:\d{2} น\.)(?: \((.+)\))? (.+)$/,
  );
  if (!match) return null;
  const [, date = '', time = '', location, note = ''] = match;
  return { date, time, location: location ?? null, note };
}

const selectedRound = computed(() =>
  selected.value?.notification.notificationType === 'schedule'
    ? parseRoundNotice(selected.value.message)
    : null,
);

function goToSelected() {
  const target = selected.value?.meta.to;
  detailOpen.value = false;
  if (target) void router.push(target);
}

// --- Funeral notices --------------------------------------------------------------

const recentFuneralNotifications = computed(() => {
  return notificationStore.unread.filter((notification) =>
    isActiveFuneralNotification(notification),
  );
});

interface FuneralNoticeDetails {
  deceasedName: string;
  paid: string;
  shortfall: string | null;
}

// Pulls the parts out of the two sentences committeeService.markMemberDeceased
// writes (fully paid / savings fell short), so the popup can show them as
// labelled rows. Any other wording (older notices) returns null and the popup
// shows the plain sentence instead.
function parseFuneralNotice(message: string): FuneralNoticeDetails | null {
  const paidInFull = message.match(
    /^สมาชิก (.+) เสียชีวิต ระบบหักเงินฌาปนกิจจากเงินสะสมของท่าน ([\d,.]+) บาทแล้ว$/,
  );
  if (paidInFull) {
    const [, deceasedName = '', paid = ''] = paidInFull;
    return { deceasedName, paid, shortfall: null };
  }
  const fellShort = message.match(
    /^สมาชิก (.+) เสียชีวิต อัตราเงินฌาปนกิจ [\d,.]+ บาท ระบบหักจากเงินสะสมได้ ([\d,.]+) บาท และยังขาด ([\d,.]+) บาท$/,
  );
  if (fellShort) {
    const [, deceasedName = '', paid = '', shortfall = ''] = fellShort;
    return { deceasedName, paid, shortfall };
  }
  return null;
}

const recentFuneralNotices = computed(() =>
  recentFuneralNotifications.value.map((notification) => ({
    notification,
    details: parseFuneralNotice(notification.message),
    when: formatWhen(notification.createdAt),
  })),
);

async function dismissFuneralNotifications() {
  dismissingFuneralNotifications.value = true;
  try {
    await notificationStore.markRead(
      recentFuneralNotifications.value.map((notification) => notification.id),
    );
    showFuneralDialog.value = false;
  } finally {
    dismissingFuneralNotifications.value = false;
  }
}

// The reminders come from the profile, so the bell waits for it before deciding
// whether to ring. The page underneath may already be fetching it.
async function loadProfile() {
  if (profileStore.profile.code) return;
  if (!profileStore.loading) return profileStore.fetchSummary();
  await new Promise<void>((resolve) => {
    const stop = watch(
      () => profileStore.loading,
      (loading) => {
        if (loading) return;
        stop();
        resolve();
      },
    );
  });
}

onMounted(async () => {
  await Promise.all([
    notificationStore.fetch().then(() => {
      showFuneralDialog.value = recentFuneralNotifications.value.length > 0;
    }),
    loadPendingSellRequestsCount(),
    loadProfile(),
  ]);

  ringing.value = badgeCount.value > 0;
});
</script>

<style scoped>
.notification-bell {
  color: #087f49;
}

/* Rings 5 times when the member arrives with unread notifications. Swings from
   the top of the bell, like a real one. */
.notification-bell.is-ringing :deep(.q-icon) {
  transform-origin: 50% 3px;
  animation: bell-ring 0.7s ease-in-out 5;
}

@keyframes bell-ring {
  0%,
  100% {
    transform: rotate(0);
  }
  15% {
    transform: rotate(18deg);
  }
  30% {
    transform: rotate(-16deg);
  }
  45% {
    transform: rotate(12deg);
  }
  60% {
    transform: rotate(-8deg);
  }
  75% {
    transform: rotate(4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .notification-bell.is-ringing :deep(.q-icon) {
    animation: none;
  }
}

/* max-width: 100% - on a phone Quasar only leaves the menu the room between the
   screen edge and the bell, so the list has to shrink into it, not overflow. */
.alerts-menu {
  width: 380px;
  max-width: 100%;
  max-height: min(70vh, 560px);
  overflow-y: auto;
  padding: 6px 10px;
  background: white;
  border-radius: 14px;
}

.alerts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px 4px;
}

.alerts-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #18231e;
  font-size: 14px;
  font-weight: 900;
}

.alerts-title .q-icon {
  color: #087f49;
  font-size: 18px;
}

.alerts-list {
  display: flex;
  flex-direction: column;
}

.alert-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: none;
  color: #2a3530;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.alert-row:hover {
  background: #f2f8f3;
}

.alert-row + .alert-row {
  border-top: 1px solid rgba(7, 95, 56, 0.06);
}

.alert-row.is-unread {
  background: #f4faf5;
}

.alert-dot {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  min-width: 30px;
  border-radius: 999px;
  font-size: 16px;
}

.alert-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.alert-title {
  color: #18231e;
  font-size: 14px;
  font-weight: 900;
}

/* Full text, wrapped - never cut off with "…". */
.alert-message {
  color: #3d4a43;
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.alert-time {
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

.alert-unread {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  margin-top: 6px;
  background: #e53935;
  border-radius: 999px;
}

.alert-arrow {
  align-self: center;
  color: #9aa5a0;
  font-size: 18px;
}

.alerts-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin: 6px 0 4px;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: #eef8ef;
  color: #087f49;
  font: inherit;
  font-size: 13.5px;
  font-weight: 900;
  cursor: pointer;
}

.alerts-more:hover {
  background: #e0f1e3;
}

.alerts-more .q-icon {
  font-size: 18px;
}

.alerts-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: #7f8a86;
  font-size: 13px;
  font-weight: 750;
}

.alerts-empty .q-icon {
  font-size: 18px;
}

.notification-detail {
  margin: 0;
  padding: 14px 16px;
  color: #2a3530;
  background: #f5f8f6;
  border: 1px solid #e3ebe5;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.65;
  white-space: pre-line;
}

/* A round notice as one label/value row per fact. */
.notification-detail-rows {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 14px 16px;
  background: #f5f8f6;
  border: 1px solid #e3ebe5;
  border-radius: 12px;
}

.notification-detail-rows div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.notification-detail-rows dt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6b7770;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.notification-detail-rows dt .q-icon {
  color: #087f49;
  font-size: 19px;
}

.notification-detail-rows dd {
  margin: 0;
  color: #202823;
  font-size: 15px;
  font-weight: 800;
  text-align: right;
  overflow-wrap: anywhere;
}

.notification-detail-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 0;
  color: #087f49;
  font-size: 14px;
  font-weight: 800;
}

.notification-detail-note .q-icon {
  font-size: 18px;
}

.notification-detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}

.notification-detail-close {
  min-width: 110px;
}

.notification-detail-go {
  flex: 1;
}

/* Small phones: "ปิด" shrinks to its label so the main button's label stays on
   one line. */
@media (max-width: 400px) {
  .notification-detail-close {
    min-width: 0;
  }
}

.tone-amber {
  color: #8a5a12;
  background: #fff4e5;
}

.tone-blue {
  color: #1565c0;
  background: #e3f0fd;
}

.tone-green {
  color: #087f49;
  background: #eef8ef;
}

.funeral-dialog {
  width: min(520px, calc(100vw - 32px));
  max-width: 520px;
  border-radius: 8px;
}

.funeral-dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
}

.funeral-dialog-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 50%;
  color: #9a5b00;
  background: #fff1d6;
}

.funeral-dialog-icon .q-icon {
  font-size: 24px;
}

.funeral-dialog-heading {
  flex: 1;
  min-width: 0;
}

.funeral-dialog-title {
  color: #202823;
  font-size: 18px;
  font-weight: 900;
}

.funeral-dialog-list {
  max-height: min(360px, 50vh);
  overflow-y: auto;
  padding: 8px 20px;
}

.funeral-dialog-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  padding: 14px 0;
}

.funeral-dialog-item + .funeral-dialog-item {
  border-top: 1px solid #e5e9e6;
}

.funeral-dialog-item > .q-icon {
  margin-top: 2px;
  color: #087f49;
  font-size: 22px;
}

.funeral-dialog-item-title {
  color: #26312b;
  font-size: 14px;
  font-weight: 900;
}

.funeral-dialog-item-body {
  min-width: 0;
}

.funeral-dialog-item-when {
  margin-top: 2px;
  color: #7f8a84;
  font-size: 12.5px;
  font-weight: 600;
}

.funeral-dialog-item-message {
  margin-top: 4px;
  color: #4f5d56;
  font-size: 14px;
  line-height: 1.55;
}

/* One label/value row per fact - name first, then the money. */
.funeral-notice-rows {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
  padding: 12px 14px;
  background: #f5f8f6;
  border: 1px solid #e3ebe5;
  border-radius: 10px;
}

.funeral-notice-rows div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.funeral-notice-rows dt {
  color: #6b7770;
  font-size: 13px;
  font-weight: 600;
}

.funeral-notice-rows dd {
  margin: 0;
  color: #202823;
  font-size: 14px;
  font-weight: 800;
  text-align: right;
  overflow-wrap: anywhere;
}

.funeral-notice-rows dd.is-paid {
  color: #087f49;
  font-size: 16px;
  font-weight: 900;
}

.funeral-notice-rows dd.is-short {
  color: #c62828;
  font-size: 16px;
  font-weight: 900;
}

.funeral-dialog-actions {
  gap: 8px;
  padding: 12px 20px 18px;
}

.funeral-dialog-collapse {
  color: white;
  background: #087f49;
}

@media (max-width: 480px) {
  .funeral-dialog-head,
  .funeral-dialog-list {
    padding-right: 16px;
    padding-left: 16px;
  }

  .funeral-dialog-actions {
    display: grid;
    grid-template-columns: 1fr;
    padding: 10px 16px 16px;
  }

  .funeral-dialog-actions .q-btn {
    width: 100%;
  }
}
</style>
