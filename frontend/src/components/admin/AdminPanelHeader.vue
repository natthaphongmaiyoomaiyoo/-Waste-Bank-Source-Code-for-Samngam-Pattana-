<template>
  <!-- Same head as the committee pages' list panels: title row, then the search
       row with MidFilterBar (its filter icon sits inside the search box). -->
  <div :class="['admin-panel-header', { 'admin-panel-header--bare': bare }]">
    <div class="aph-head">
      <div class="aph-copy">
        <div class="aph-title">{{ title }}</div>
        <div v-if="caption" class="aph-caption">{{ caption }}</div>
      </div>
      <div v-if="$slots.actions" class="aph-actions">
        <slot name="actions" />
      </div>
    </div>

    <!-- Search only (no #filters slot): MidFilterBar without filters is just
         the search box, styled like every other list in the app. -->
    <div v-if="!$slots.filters && search !== undefined" class="aph-search">
      <MidFilterBar
        :search="search"
        :search-label="searchPlaceholder ?? 'ค้นหา'"
        @update:search="$emit('update:search', $event)"
      />
    </div>

    <!-- The page's own MidFilterBar, wrapped in its .filter-row -->
    <slot v-if="$slots.filters" name="filters" />
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { MidFilterBar } from 'components/MID';

const props = defineProps<{
  title: string;
  caption?: string | undefined;
  search?: string | undefined;
  searchPlaceholder?: string | undefined;
}>();

defineEmits<{
  (e: 'update:search', value: string): void;
}>();

const slots = useSlots();

// Nothing under the title row: give it the bottom padding the search row
// would otherwise provide, so the table doesn't butt against the title.
const bare = computed(() => !slots.filters && props.search === undefined);
</script>

<style scoped>
.aph-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 22px 26px 0;
}

.admin-panel-header--bare .aph-head {
  padding-bottom: 18px;
}

.aph-copy {
  min-width: 0;
}

.aph-title {
  color: #16352a;
  font-size: 17px;
  font-weight: 700;
}

.aph-caption {
  margin-top: 4px;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 500;
}

.aph-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.aph-search {
  padding: 18px 28px;
}

/* Same 599px line as the tables' card mode */
@media (max-width: 599px) {
  .aph-head {
    padding: 20px 16px 0;
  }

  .admin-panel-header--bare .aph-head {
    padding-bottom: 14px;
  }

  .aph-search {
    padding: 12px 16px;
  }
}
</style>
