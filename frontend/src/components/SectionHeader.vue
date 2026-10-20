<template>
  <div class="section-header">
    <div class="section-heading">
      <div class="section-icon"><q-icon :name="icon" /></div>
      <div class="section-title">{{ title }}</div>
    </div>

    <div v-if="viewAllTo || $slots.default" class="section-actions">
      <router-link v-if="viewAllTo" :to="viewAllTo" class="view-all-btn">ดูทั้งหมด</router-link>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Shared heading row for the public news/video sections and their "ดูทั้งหมด" pages.
// The default slot holds extra controls (e.g. prev/next buttons) next to the link.
defineProps<{
  icon: string;
  title: string;
  viewAllTo?: string | undefined;
}>();
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 34px 0 26px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.section-icon {
  display: grid;
  width: 44px;
  height: 44px;
  min-width: 44px;
  place-items: center;
  color: #087f49;
  background: #e6f5ea;
  border-radius: 13px;
  font-size: 22px;
}

.section-title {
  color: #0b2c1c;
  font-size: clamp(20px, 2.4vw, 27px);
  font-weight: 950;
  line-height: 1.2;
}

.section-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 14px;
}

.view-all-btn {
  color: #087f49;
  font-size: 13px;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
}

/* Phones keep title, "ดูทั้งหมด" and the prev/next controls on one row by
   shrinking everything; only the title text may wrap if it still can't fit. */
@media (max-width: 640px) {
  .section-header {
    gap: 8px;
    margin: 26px 0 20px;
  }

  .section-heading {
    gap: 8px;
  }

  .section-icon {
    width: 34px;
    height: 34px;
    min-width: 34px;
    border-radius: 10px;
    font-size: 18px;
  }

  .section-title {
    font-size: 17px;
  }

  .section-actions {
    gap: 8px;
  }

  .view-all-btn {
    font-size: 12px;
  }

  .section-actions :deep(.control-group) {
    gap: 2px;
    padding: 2px;
  }

  .section-actions :deep(.control-btn) {
    font-size: 12px;
  }
}

/* A 360px phone leaves ~300px for the row - not enough for the icon, a
   readable title and the actions together, so the decorative icon goes. */
@media (max-width: 420px) {
  .section-icon {
    display: none;
  }

  .section-title {
    font-size: 15px;
  }

  .section-actions :deep(.control-btn) {
    font-size: 11px;
  }
}
</style>
