<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="persistent"
    transition-hide="fade"
    transition-show="scale"
    @hide="$emit('hide')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card
      :class="[
        'mid-dialog-card',
        `mid-dialog-card--${size}`,
        { [`mid-dialog-card--${tone}`]: tone !== 'default' },
      ]"
    >
      <div class="mid-dialog__head">
        <div>
          <q-badge v-if="badge" class="mid-dialog__badge">
            <q-icon v-if="icon" :name="icon" />
            {{ badge }}
          </q-badge>
          <h2>{{ title }}</h2>
          <p v-if="caption">{{ caption }}</p>
        </div>
        <q-btn v-if="closeable" flat round dense icon="close" @click="close" />
      </div>

      <div class="mid-dialog__body">
        <slot />
      </div>

      <div v-if="showActions || $slots.actions" class="mid-dialog__actions">
        <slot name="actions">
          <MidButton variant="secondary" :label="cancelLabel" @click="cancel" />
          <MidButton :variant="confirmVariant" :label="confirmLabel" icon-right="arrow_forward" @click="confirm" />
        </slot>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import MidButton from './MidButton.vue';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    caption?: string | undefined;
    badge?: string | undefined;
    icon?: string | undefined;
    size?: 'sm' | 'md' | 'lg';
    // Opt-in colour for the badge and main button: 'info' blue (editing),
    // 'warning' orange (password reset), 'danger' red (ending a membership);
    // 'default' keeps the brand green.
    tone?: 'default' | 'info' | 'warning' | 'danger';
    persistent?: boolean;
    closeable?: boolean;
    showActions?: boolean;
    cancelLabel?: string;
    confirmLabel?: string;
    confirmVariant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  }>(),
  {
    caption: undefined,
    badge: undefined,
    icon: undefined,
    size: 'md',
    tone: 'default',
    persistent: false,
    closeable: true,
    showActions: false,
    cancelLabel: 'ยกเลิก',
    confirmLabel: 'ตกลง',
    confirmVariant: 'primary',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
  hide: [];
}>();

function close() {
  emit('update:modelValue', false);
}

function cancel() {
  emit('cancel');
  close();
}

function confirm() {
  emit('confirm');
}
</script>

<style scoped>
/* Plain on purpose: a white card, a dark-grey title, and the tone shown only by
   the small badge and the solid main button - a dialog asks a question, it
   shouldn't shout. */
.mid-dialog-card {
  width: min(520px, calc(100vw - 32px));
  padding: 28px 28px 24px;
  color: #374151;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
}

.mid-dialog-card--sm {
  width: min(430px, calc(100vw - 32px));
}

.mid-dialog-card--lg {
  width: min(720px, calc(100vw - 32px));
}

.mid-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.mid-dialog__head .q-btn {
  color: #9ca3af;
}

.mid-dialog__badge {
  gap: 6px;
  padding: 5px 12px;
  color: #15803d;
  background: #f0fdf4;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.mid-dialog__head h2 {
  margin: 14px 0 6px;
  color: #1f2937;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.3;
}

.mid-dialog__head p {
  margin: 0;
  color: #6b7280;
  font-weight: 600;
  line-height: 1.55;
}

.mid-dialog__body {
  color: #374151;
}

.mid-dialog__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 22px;
}

/* Buttons inside a dialog: solid colour, no gradient or glow, and a plain
   outlined secondary. Scoped here, so buttons elsewhere keep their look. */
.mid-dialog-card :deep(.mid-button--primary) {
  background: #15803d;
  box-shadow: none;
}

.mid-dialog-card :deep(.mid-button--danger) {
  background: #dc2626;
  box-shadow: none;
}

.mid-dialog-card :deep(.mid-button--secondary) {
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
}

/* tone="info" (editing), "warning" (password reset), "danger" (ending a
   membership): the badge and the main button take the colour. */
.mid-dialog-card--info .mid-dialog__badge {
  color: #1d4ed8;
  background: #eff6ff;
}

.mid-dialog-card--info :deep(.mid-button--primary) {
  background: #2563eb;
}

.mid-dialog-card--warning .mid-dialog__badge {
  color: #c2410c;
  background: #fff7ed;
}

.mid-dialog-card--warning :deep(.mid-button--primary) {
  background: #ea580c;
}

.mid-dialog-card--danger .mid-dialog__badge {
  color: #b91c1c;
  background: #fef2f2;
}

.mid-dialog-card--danger :deep(.mid-button--primary) {
  background: #dc2626;
}

@media (max-width: 520px) {
  .mid-dialog-card {
    padding: 24px 20px 20px;
  }

  .mid-dialog__head h2 {
    font-size: 21px;
  }

  .mid-dialog__actions {
    grid-template-columns: 1fr;
  }
}
</style>
