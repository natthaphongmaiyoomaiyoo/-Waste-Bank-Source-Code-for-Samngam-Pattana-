<template>
  <div class="mid-section-header">
    <div class="mid-section-header__title-wrap">
      <div class="mid-section-header__title">
        <q-icon v-if="icon" :name="icon" />
        <span>{{ title }}</span>
      </div>
      <div class="mid-section-header__underline"></div>
      <p v-if="caption">{{ caption }}</p>
    </div>

    <div v-if="$slots.actions" class="mid-section-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    icon?: string | undefined;
    caption?: string | undefined;
  }>(),
  {
    icon: undefined,
    caption: undefined,
  },
);
</script>

<style scoped>
.mid-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.mid-section-header__title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #087f49;
  font-size: 25px;
  font-weight: 950;
}

.mid-section-header__underline {
  width: 44px;
  height: 3px;
  margin-top: 8px;
  margin-left: 30px;
  background: #8dc63f;
  border-radius: 999px;
}

.mid-section-header p {
  margin: 8px 0 0;
  color: #6d8a7c;
  font-size: 14px;
  font-weight: 800;
}

.mid-section-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 640px) {
  .mid-section-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
