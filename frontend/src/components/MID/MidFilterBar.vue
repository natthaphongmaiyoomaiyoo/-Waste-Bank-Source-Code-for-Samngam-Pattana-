<template>
  <div class="mid-filter-bar">
    <div class="mid-filter-bar__row">
      <q-input
        v-if="searchable"
        :model-value="search"
        dense
        outlined
        clearable
        class="mid-filter-bar__search"
        :label="searchLabel"
        :debounce="searchDebounce"
        @update:model-value="onSearch"
      >
        <template #prepend><q-icon name="search" /></template>
        <template v-if="hasFilters" #append>
          <q-btn
            flat
            round
            dense
            icon="filter_alt"
            :class="['mid-filter-bar__trigger', { 'is-active': active.length > 0 }]"
            :aria-label="triggerLabel"
            @click.stop="open = true"
          >
            <q-badge v-if="active.length > 0" floating rounded class="mid-filter-bar__count">
              {{ active.length }}
            </q-badge>
            <q-tooltip>ตัวกรอง</q-tooltip>
          </q-btn>
        </template>
      </q-input>

      <!-- No search box on this page: the same trigger stands on its own. -->
      <q-btn
        v-else-if="hasFilters"
        outline
        no-caps
        icon="filter_alt"
        label="ตัวกรอง"
        :class="['mid-filter-bar__standalone', { 'is-active': active.length > 0 }]"
        :aria-label="triggerLabel"
        @click="open = true"
      >
        <q-badge v-if="active.length > 0" floating rounded class="mid-filter-bar__count">
          {{ active.length }}
        </q-badge>
      </q-btn>

      <slot name="actions" />
    </div>

    <!-- What is filtered right now, readable and removable without reopening
         the dialog. -->
    <div v-if="active.length > 0" class="mid-filter-bar__chips">
      <q-chip
        v-for="item in active"
        :key="item.key"
        dense
        removable
        class="mid-filter-bar__chip"
        :aria-label="`ล้างตัวกรอง ${item.label}`"
        @remove="emit('clear', item.key)"
      >
        <span class="mid-filter-bar__chip-label">{{ item.label }}:</span>
        {{ item.value }}
      </q-chip>
      <q-btn
        v-if="active.length > 1"
        flat
        dense
        no-caps
        label="ล้างทั้งหมด"
        class="mid-filter-bar__clear"
        @click="emit('clear-all')"
      />
    </div>

    <MidDialog v-if="hasFilters" v-model="open" :title="title" badge="ตัวกรอง" icon="filter_alt" size="sm">
      <div class="mid-filter-bar__fields">
        <slot />
      </div>
      <template #actions>
        <MidButton
          variant="secondary"
          label="ล้างค่าทั้งหมด"
          :disable="active.length === 0"
          @click="emit('clear-all')"
        />
        <MidButton label="เสร็จสิ้น" @click="open = false" />
      </template>
    </MidDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import MidButton from './MidButton.vue';
import MidDialog from './MidDialog.vue';
import type { MidActiveFilter } from './midFilter';

const props = withDefaults(
  defineProps<{
    // Leave undefined on pages without a search box - the filter trigger then
    // renders as its own button instead of sitting inside the search field.
    search?: string | undefined;
    searchLabel?: string | undefined;
    // Passed straight to q-input, for pages that filter on every keystroke.
    searchDebounce?: number | undefined;
    title?: string;
    active?: MidActiveFilter[];
  }>(),
  {
    search: undefined,
    searchLabel: 'ค้นหา',
    searchDebounce: undefined,
    title: 'ตัวกรองข้อมูล',
    active: () => [],
  },
);

const emit = defineEmits<{
  'update:search': [value: string];
  clear: [key: string];
  'clear-all': [];
}>();

const slots = useSlots();
const open = ref(false);

const searchable = computed(() => props.search !== undefined);
const hasFilters = computed(() => Boolean(slots.default));

const triggerLabel = computed(() =>
  props.active.length > 0 ? `ตัวกรอง (ใช้อยู่ ${props.active.length} รายการ)` : 'ตัวกรอง',
);

// q-input's clear button hands back null; pages keep search as a plain string.
function onSearch(value: string | number | null) {
  emit('update:search', value === null ? '' : String(value));
}
</script>

<style scoped>
.mid-filter-bar {
  width: 100%;
}

.mid-filter-bar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.mid-filter-bar__search {
  flex: 1 1 320px;
}

.mid-filter-bar__trigger {
  color: #5c7769;
}

.mid-filter-bar__trigger.is-active,
.mid-filter-bar__standalone.is-active {
  color: #087f49;
}

.mid-filter-bar__standalone {
  min-height: 40px;
  border-radius: 10px;
  color: #3f5a4c;
}

.mid-filter-bar__count {
  background: #087f49;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
}

.mid-filter-bar__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.mid-filter-bar__chip {
  margin: 0;
  color: #0b5d37;
  background: #e6f5ed;
  font-weight: 600;
}

.mid-filter-bar__chip-label {
  margin-right: 4px;
  color: #5c7769;
  font-weight: 500;
}

.mid-filter-bar__clear {
  color: #5c7769;
  font-weight: 600;
}

.mid-filter-bar__fields {
  display: grid;
  gap: 14px;
}
</style>
