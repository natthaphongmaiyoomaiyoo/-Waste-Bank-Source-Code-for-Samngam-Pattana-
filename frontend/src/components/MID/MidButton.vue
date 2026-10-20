<template>
  <q-btn
    :class="buttonClasses"
    :color="undefined"
    :disable="disable"
    :flat="variant === 'ghost'"
    :icon="icon"
    :icon-right="iconRight"
    :label="label"
    :loading="loading"
    :no-caps="noCaps"
    :outline="variant === 'outline'"
    :rounded="rounded"
    :to="to"
    :type="type"
    :unelevated="variant !== 'ghost'"
    @click="$emit('click', $event)"
  >
    <slot />
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
defineProps<{
    label?: string | undefined;
    icon?: string | undefined;
    iconRight?: string | undefined;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    to?: string | undefined;
    loading?: boolean;
    disable?: boolean;
    rounded?: boolean;
    noCaps?: boolean;
    fullWidth?: boolean;
  }>(),
  {
    label: undefined,
    icon: undefined,
    iconRight: undefined,
    variant: 'primary',
    size: 'md',
    type: 'button',
    to: undefined,
    loading: false,
    disable: false,
    rounded: true,
    noCaps: true,
    fullWidth: false,
  },
);

defineEmits<{
  click: [event: Event];
}>();

const buttonClasses = computed(() => [
  'mid-button',
  `mid-button--${props.variant}`,
  `mid-button--${props.size}`,
  { 'mid-button--full': props.fullWidth },
]);
</script>

<style scoped>
.mid-button {
  min-height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  font-weight: 900;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.mid-button:hover {
  transform: translateY(-1px);
}

.mid-button--sm {
  min-height: 40px;
  padding-inline: 16px;
  font-size: 13px;
}

.mid-button--lg {
  min-height: 56px;
  padding-inline: 28px;
  font-size: 16px;
}

.mid-button--full {
  width: 100%;
}

.mid-button--primary {
  color: white;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  box-shadow: 0 18px 34px rgba(0, 102, 58, 0.22);
}

.mid-button--secondary {
  color: #087f49;
  background: #dbf4df;
}

.mid-button--outline {
  color: #087f49;
  background: rgba(219, 244, 223, 0.58);
}

.mid-button--ghost {
  color: #087f49;
  background: transparent;
}

.mid-button--danger {
  color: white;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 18px 34px rgba(220, 38, 38, 0.18);
}
</style>
