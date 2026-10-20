<template>
  <div class="mid-toast-stack" aria-live="polite">
    <TransitionGroup name="mid-toast">
      <div
        v-for="toast in midToasts"
        :key="toast.id"
        :class="['mid-toast', `mid-toast--${toast.type}`, { 'is-paused': paused.has(toast.id) }]"
        :role="toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'"
        :style="{ '--mid-toast-timeout': `${toast.timeout}ms` }"
        @pointerenter="onPointer($event, toast.id, true)"
        @pointerleave="onPointer($event, toast.id, false)"
      >
        <span class="mid-toast__icon">
          <q-icon :name="toastIcons[toast.type]" />
        </span>
        <div class="mid-toast__body">
          <div class="mid-toast__title">{{ toast.title }}</div>
          <div class="mid-toast__message">{{ toast.message }}</div>
        </div>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="close"
          class="mid-toast__close"
          aria-label="ปิดการแจ้งเตือน"
          @click="dismissMidToast(toast.id)"
        />
        <span class="mid-toast__progress" />
      </div>
    </TransitionGroup>
  </div>

  <MidDialog
    v-model="confirmOpen"
    size="sm"
    :title="request?.title ?? ''"
    :caption="request?.message"
    :tone="request?.tone ?? 'default'"
    @hide="onConfirmHide"
  >
    <div v-if="request?.item" class="mid-confirm-item">
      <div class="mid-confirm-item__name">{{ request.item.name }}</div>
      <div v-for="line in itemDetails" :key="line" class="mid-confirm-item__detail">
        {{ line }}
      </div>
    </div>
    <div v-if="request?.note" class="mid-confirm-note">
      <q-icon name="info_outline" />
      <span>{{ request.note }}</span>
    </div>
    <q-input
      v-if="request?.inputLabel"
      v-model="promptText"
      outlined
      dense
      autogrow
      :label="request.inputLabel"
    />
    <template #actions>
      <MidButton
        variant="secondary"
        :label="request?.cancelLabel ?? 'ยกเลิก'"
        @click="confirmOpen = false"
      />
      <MidButton
        :label="request?.confirmLabel ?? 'ตกลง'"
        :icon="request?.confirmIcon"
        @click="acceptConfirm"
      />
    </template>
  </MidDialog>
</template>

<script setup lang="ts">
// Mounted once in App.vue: draws the toasts queued by midNotify() and the
// confirm/prompt dialog opened by midConfirm()/midPrompt().
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import MidButton from './MidButton.vue';
import MidDialog from './MidDialog.vue';
import {
  dismissMidToast,
  midConfirmRequest,
  midToasts,
  type MidConfirmRequest,
  type MidNotifyType,
} from './midNotify';

const toastIcons: Record<MidNotifyType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

// ---- Auto-close timers, paused while a mouse rests on the toast ----
interface ToastTimer {
  handle: number | undefined;
  remaining: number;
  startedAt: number;
}

const timers = new Map<number, ToastTimer>();
const paused = reactive(new Set<number>());

function runTimer(id: number, timer: ToastTimer) {
  timer.startedAt = Date.now();
  timer.handle = window.setTimeout(() => dismissMidToast(id), Math.max(timer.remaining, 0));
}

watch(
  () => midToasts.map((toast) => toast.id),
  (ids) => {
    for (const toast of midToasts) {
      if (timers.has(toast.id)) continue;
      const timer: ToastTimer = { handle: undefined, remaining: toast.timeout, startedAt: 0 };
      timers.set(toast.id, timer);
      runTimer(toast.id, timer);
    }
    for (const [id, timer] of timers) {
      if (ids.includes(id)) continue;
      window.clearTimeout(timer.handle);
      timers.delete(id);
      paused.delete(id);
    }
  },
  { immediate: true },
);

// Mouse only: a tap on a phone fires pointerenter with no matching leave, which
// would freeze the toast on screen.
function onPointer(event: PointerEvent, id: number, entering: boolean) {
  if (event.pointerType !== 'mouse') return;
  const timer = timers.get(id);
  if (!timer) return;
  if (entering && timer.handle !== undefined) {
    window.clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining -= Date.now() - timer.startedAt;
    paused.add(id);
  } else if (!entering && timer.handle === undefined) {
    runTimer(id, timer);
    paused.delete(id);
  }
}

onBeforeUnmount(() => {
  for (const timer of timers.values()) window.clearTimeout(timer.handle);
});

// ---- Confirm / prompt ----
// A local copy keeps the text on the card while it fades out after closing.
const request = ref<MidConfirmRequest | null>(null);
const confirmOpen = ref(false);
const promptText = ref('');
const itemDetails = computed(() =>
  (request.value?.item?.details ?? []).filter((line): line is string => Boolean(line)),
);

watch(midConfirmRequest, (next) => {
  if (!next) return;
  request.value = next;
  promptText.value = '';
  confirmOpen.value = true;
});

// Resolve straight away so the caller's work starts while the card fades out.
function acceptConfirm() {
  request.value?.resolve(request.value.inputLabel ? promptText.value.trim() : true);
  confirmOpen.value = false;
}

// Closed any other way (cancel, ✕, Esc, backdrop) counts as dismissed. A promise
// settles once, so this is a no-op after acceptConfirm.
function onConfirmHide() {
  const closed = request.value;
  closed?.resolve(null);
  if (midConfirmRequest.value === closed) midConfirmRequest.value = null;
}
</script>

<style scoped>
.mid-toast-stack {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 9500;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(380px, calc(100vw - 32px));
  pointer-events: none;
}

.mid-toast {
  --mid-toast-color: #087f49;
  --mid-toast-soft: #dbf4df;
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 14px 10px 16px 14px;
  overflow: hidden;
  color: #17452e;
  background: #ffffff;
  border: 1px solid #d6e8db;
  border-radius: 16px;
  box-shadow: 0 18px 42px rgba(0, 82, 45, 0.16);
  pointer-events: auto;
}

.mid-toast--error {
  --mid-toast-color: #b91c1c;
  --mid-toast-soft: #fee2e2;
  border-color: #fbd5d5;
}

.mid-toast--warning {
  --mid-toast-color: #c2410c;
  --mid-toast-soft: #ffedd5;
  border-color: #fed7aa;
}

.mid-toast--info {
  --mid-toast-color: #1565c0;
  --mid-toast-soft: #e8f1fc;
  border-color: #cfe0f5;
}

.mid-toast__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  color: var(--mid-toast-color);
  background: var(--mid-toast-soft);
  border-radius: 50%;
  font-size: 22px;
}

.mid-toast__body {
  min-width: 0;
  padding-top: 1px;
}

.mid-toast__title {
  color: var(--mid-toast-color);
  font-size: 14px;
  font-weight: 900;
  line-height: 1.35;
}

.mid-toast__message {
  margin-top: 2px;
  color: #17452e;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.mid-toast__close {
  color: #8aa094;
}

/* Shrinks over the toast's timeout - shows how long until it closes itself. */
.mid-toast__progress {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 3px;
  background: var(--mid-toast-color);
  opacity: 0.55;
  transform-origin: left center;
  animation: mid-toast-countdown var(--mid-toast-timeout) linear forwards;
}

.mid-toast.is-paused .mid-toast__progress {
  animation-play-state: paused;
}

@keyframes mid-toast-countdown {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

.mid-toast-enter-active,
.mid-toast-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.mid-toast-move {
  transition: transform 0.22s ease;
}

.mid-toast-enter-from,
.mid-toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

@media (max-width: 599px) {
  .mid-toast-stack {
    top: 72px;
    right: 16px;
    left: 16px;
    width: auto;
  }
}

/* midConfirm({ item }): the affected record on its own, under the message. */
.mid-confirm-item {
  display: grid;
  gap: 2px;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f8fafc;
}

/* midConfirm({ note }): what happens afterwards, small and muted. */
.mid-confirm-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.mid-confirm-note .q-icon {
  flex: none;
  margin-top: 2px;
  font-size: 16px;
}

.mid-confirm-item__name {
  color: #111827;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.mid-confirm-item__detail {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  .mid-toast-enter-active,
  .mid-toast-leave-active,
  .mid-toast-move {
    transition: opacity 0.15s ease;
  }

  .mid-toast-enter-from,
  .mid-toast-leave-to {
    transform: none;
  }
}
</style>
