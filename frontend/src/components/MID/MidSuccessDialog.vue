<template>
  <q-dialog
    :model-value="modelValue"
    transition-show="scale"
    transition-hide="fade"
    @hide="$emit('hide')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="mid-success-card">
      <q-btn flat round dense icon="close" class="mid-success-close" v-close-popup />

      <div class="mid-success-mark">
        <q-icon name="check_circle" />
      </div>
      <h2 class="mid-success-title">{{ title }}</h2>

      <div class="mid-success-panel">
        <div v-if="person" class="mid-success-person">
          <div class="mid-success-avatar">{{ person.initials }}</div>
          <div class="mid-success-name">{{ person.name }}</div>
        </div>

        <div
          v-for="row in rows"
          :key="row.label"
          :class="['mid-success-row', { 'is-first': !person && row === rows[0] }]"
        >
          <span class="mid-success-label">{{ row.label }}</span>
          <q-badge
            v-if="row.badge"
            class="mid-success-status"
            :color="row.badge.color"
            :text-color="row.badge.textColor"
          >
            <q-icon name="circle" class="mid-success-status-dot" />
            {{ row.value }}
          </q-badge>
          <span v-else class="mid-success-value">{{ row.value }}</span>
        </div>
      </div>

      <div class="mid-success-actions">
        <q-btn flat no-caps :label="secondaryLabel" class="mid-success-secondary" v-close-popup />
        <q-btn
          unelevated
          no-caps
          :label="primaryLabel"
          class="mid-success-primary"
          @click="$emit('primary')"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
// "Saved successfully" dialog: a big check mark, a title, a summary panel of
// label/value rows (optionally headed by a person's initials + name) and two
// buttons - a flat one that just closes, and a primary one the page handles.
export interface MidSuccessRow {
  label: string;
  // Right-aligned; a "\n" in it starts a new line instead of wrapping by width.
  value: string;
  // Render the value as a status pill instead of plain text.
  badge?: { color: string; textColor: string } | undefined;
}

defineProps<{
  modelValue: boolean;
  title: string;
  rows: MidSuccessRow[];
  person?: { name: string; initials: string } | undefined;
  secondaryLabel: string;
  primaryLabel: string;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
  // Fired however the dialog closes - pages reset their form here.
  hide: [];
  primary: [];
}>();
</script>

<style scoped>
/* Plain like MidDialog: a white card, a soft green check, a dark-grey title and
   a solid main button - no glow or gradients. */
.mid-success-card {
  position: relative;
  width: min(520px, calc(100vw - 32px));
  padding: 30px 28px 24px;
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
}

.mid-success-close {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #9ca3af;
}

/* Prefixed with the card class: Quasar's `.q-card > div:not(:first-child)`
   zeroes the corners of a card's inner blocks and would otherwise win, leaving
   a square check and a square-cornered panel. */
.mid-success-card .mid-success-mark {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto;
  background: #f0fdf4;
  border-radius: 999px;
}

.mid-success-mark .q-icon {
  color: #16a34a;
  font-size: 40px;
}

.mid-success-title {
  margin: 14px 0 20px;
  color: #1f2937;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.3;
}

.mid-success-card .mid-success-panel {
  padding: 16px 18px 18px;
  text-align: left;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
}

.mid-success-person {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px dashed #e5e7eb;
}

.mid-success-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  color: #15803d;
  background: #dcfce7;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
}

.mid-success-name {
  color: #111827;
  font-size: 15px;
  font-weight: 800;
}

.mid-success-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.mid-success-row.is-first {
  margin-top: 0;
}

.mid-success-label {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

/* pre-line: a value with a "\n" in it breaks where the page meant it to, rather
   than wherever the width runs out (a date and its time, say). */
.mid-success-value {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
  text-align: right;
  white-space: pre-line;
}

.mid-success-status {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
}

.mid-success-status-dot {
  margin-right: 6px;
  font-size: 8px;
}

.mid-success-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

.mid-success-secondary {
  min-height: 44px;
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  font-weight: 700;
}

.mid-success-primary {
  min-height: 44px;
  color: #ffffff;
  background: #15803d;
  border-radius: 12px;
  font-weight: 800;
}

@media (max-width: 520px) {
  .mid-success-card {
    padding: 26px 20px 20px;
  }

  .mid-success-actions {
    grid-template-columns: 1fr;
  }
}
</style>
