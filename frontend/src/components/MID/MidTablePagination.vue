<template>
  <!-- Page numbers for a q-table, in place of Quasar's "1-20 of 26 ‹ ›". Used in
       the table's #pagination slot:
         <template #pagination="scope">
           <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
         </template> -->
  <q-pagination
    v-if="pagesNumber > 1"
    :model-value="pagination.page"
    :max="pagesNumber"
    :max-pages="$q.screen.lt.sm ? 5 : 7"
    boundary-numbers
    direction-links
    flat
    color="grey-7"
    active-color="positive"
    class="mid-table-pagination"
    @update:model-value="goToPage"
  />
</template>

<script setup lang="ts">
import { getCurrentInstance } from 'vue';

defineProps<{
  pagination: { page: number };
  pagesNumber: number;
}>();

interface TableWithPagination {
  setPagination: (pagination: { page: number }) => void;
}

// The slot scope can step a page at a time but has no "go to page N", so this
// reaches the q-table rendering it and uses its setPagination - which also fires
// the table's @request for server-side tables.
const instance = getCurrentInstance();

function owningTable(): TableWithPagination | null {
  for (let parent = instance?.parent; parent; parent = parent.parent) {
    const proxy = parent.proxy as unknown as Partial<TableWithPagination> | null;
    if (typeof proxy?.setPagination === 'function') return proxy as TableWithPagination;
  }
  return null;
}

function goToPage(page: number) {
  owningTable()?.setPagination({ page });
}
</script>

<style scoped>
.mid-table-pagination {
  font-weight: 700;
}
</style>
