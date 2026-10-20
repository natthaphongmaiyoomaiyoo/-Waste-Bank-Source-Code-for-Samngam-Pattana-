<template>
  <!-- Phone-width row card (q-table grid mode), the same card the committee
       pages use: title + status on top, label/value rows, then the actions as
       full-size labelled buttons two per line. -->
  <div class="admin-card-wrap col-12">
    <article
      :class="['admin-card', { 'admin-card--clickable': clickable }]"
      @click="$emit('click', $event)"
    >
      <div class="admin-card-head">
        <slot name="avatar" />
        <div class="admin-card-title">
          <div class="admin-card-name">{{ title }}</div>
          <div v-if="subtitle" class="admin-card-sub">{{ subtitle }}</div>
        </div>
        <q-badge
          v-if="badgeText"
          :color="badgeColor"
          :text-color="badgeTextColor"
          class="admin-card-badge q-px-sm q-py-xs"
          rounded
        >
          {{ badgeText }}
        </q-badge>
      </div>

      <div v-if="$slots.chips" class="admin-card-chips">
        <slot name="chips" />
      </div>

      <dl v-if="rows?.length || $slots.rows" class="admin-card-rows">
        <div v-for="row in rows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value ?? '-' }}</dd>
        </div>
        <slot name="rows" />
      </dl>

      <div v-if="$slots.details" class="admin-card-body">
        <slot name="details" />
      </div>

      <!-- click.stop: the buttons act on the row, not on "open the card". -->
      <div v-if="$slots.actions" class="admin-card-actions" @click.stop>
        <slot name="actions" />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
export interface AdminGridCardRow {
  label: string;
  value: string | number | null | undefined;
}

withDefaults(
  defineProps<{
    title: string;
    subtitle?: string | undefined;
    badgeText?: string | undefined;
    badgeColor?: string | undefined;
    badgeTextColor?: string | undefined;
    rows?: AdminGridCardRow[] | undefined;
    clickable?: boolean;
  }>(),
  {
    subtitle: undefined,
    badgeText: undefined,
    badgeColor: undefined,
    badgeTextColor: undefined,
    rows: undefined,
    clickable: false,
  },
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<!-- Not scoped: the rows and buttons arrive through slots, and every rule is
     prefixed with admin-card so nothing leaks onto other pages. -->
<style lang="scss">
.admin-card-wrap {
  padding: 6px 16px;
}

.admin-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 14px;
}

.admin-card--clickable {
  cursor: pointer;
}

.admin-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-card-title {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.admin-card-name {
  color: #18231e;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.3;
}

.admin-card-sub {
  margin-top: 2px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 600;
}

.admin-card-badge {
  flex-shrink: 0;
  align-self: flex-start;
}

.admin-card-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.admin-card-rows {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #e3ece2;
}

.admin-card-rows > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}

.admin-card-rows dt {
  flex-shrink: 0;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 600;
}

.admin-card-rows dd {
  margin: 0;
  color: #18231e;
  font-size: 13.5px;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.admin-card-body {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e3ece2;
  color: #43514a;
  font-size: 13.5px;
}

.admin-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e3ece2;
}

// Each button takes at least half the row, so they pair up two per line and a
// lone one still reads as a button rather than a stray chip. 10px is q-btn's
// size="sm", what the committee cards pass on every button.
.admin-card-actions > .q-btn {
  flex: 1 1 calc(50% - 8px);
  min-height: 38px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;

  &.is-detail {
    color: #0d7a44;
    background: #eaf6ec;
  }

  &.is-edit {
    color: #1565c0;
    background: #e8f1fc;
  }

  &.is-approve {
    color: #0d7a44;
    background: #dff2e4;
  }

  &.is-warning {
    color: #9a5a00;
    background: #fff4d6;
  }

  &.is-cancel {
    color: #b23a3a;
    background: #fdeaea;
  }

  &.is-deceased {
    color: #5e35b1;
    background: #efe9fa;
  }
}
</style>
