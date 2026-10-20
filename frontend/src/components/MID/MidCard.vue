<template>
  <q-card
    flat
    :class="[
      'mid-card',
      `mid-card--${variant}`,
      `mid-card--${padding}`,
      { 'mid-card--clickable': clickable },
    ]"
    @click="$emit('click', $event)"
  >
    <div v-if="$slots.header" class="mid-card__header">
      <slot name="header" />
    </div>

    <div class="mid-card__body">
      <slot />
    </div>

    <div v-if="$slots.footer" class="mid-card__footer">
      <slot name="footer" />
    </div>
  </q-card>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'panel' | 'news' | 'soft' | 'hero';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    clickable?: boolean;
  }>(),
  {
    variant: 'default',
    padding: 'md',
    clickable: false,
  },
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style scoped>
.mid-card {
  overflow: hidden;
  color: #17452e;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(7, 95, 56, 0.08);
  border-radius: 18px;
  box-shadow: 0 14px 36px rgba(35, 74, 49, 0.08);
}

.mid-card--clickable {
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.mid-card--clickable:hover {
  box-shadow: 0 18px 42px rgba(0, 82, 45, 0.12);
  transform: translateY(-2px);
}

.mid-card--panel {
  border-radius: 18px;
}

.mid-card--news {
  min-height: 190px;
  color: white;
  border: 0;
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(0, 82, 45, 0.12);
}

.mid-card--soft {
  background: linear-gradient(135deg, #f5fbf5, #ffffff);
  border-color: #d6ead7;
  border-radius: 12px;
}

.mid-card--hero {
  color: white;
  background:
    radial-gradient(circle at 78% 24%, rgba(156, 216, 66, 0.5), transparent 26%),
    linear-gradient(135deg, #00573d 0%, #00843e 56%, #48b52f 100%);
  border: 0;
  border-radius: 22px;
  box-shadow: 0 22px 48px rgba(0, 83, 52, 0.18);
}

.mid-card--none .mid-card__body {
  padding: 0;
}

.mid-card--sm .mid-card__body,
.mid-card--sm .mid-card__header,
.mid-card--sm .mid-card__footer {
  padding: 18px;
}

.mid-card--md .mid-card__body,
.mid-card--md .mid-card__header,
.mid-card--md .mid-card__footer {
  padding: 24px;
}

.mid-card--lg .mid-card__body,
.mid-card--lg .mid-card__header,
.mid-card--lg .mid-card__footer {
  padding: 32px 36px;
}

.mid-card__header {
  padding-bottom: 0;
}

.mid-card__footer {
  padding-top: 0;
}
</style>
