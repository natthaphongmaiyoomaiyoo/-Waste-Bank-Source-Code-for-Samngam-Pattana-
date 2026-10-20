<template>
  <article :class="['mid-info-card', `mid-info-card--${tone}`]">
    <div class="mid-info-card__icon">
      <q-icon :name="icon" />
    </div>

    <div class="mid-info-card__content">
      <div class="mid-info-card__label">{{ label }}</div>

      <slot>
        <div class="mid-info-card__value">
          {{ value }}
          <span v-if="unit">{{ unit }}</span>
        </div>
      </slot>

      <q-linear-progress
        v-if="progress !== undefined"
        :value="progress"
        rounded
        size="7px"
        class="mid-info-card__progress"
      />

      <div v-if="hint" class="mid-info-card__hint">{{ hint }}</div>
    </div>
  </article>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    icon: string;
    value?: string | number;
    unit?: string | undefined;
    hint?: string | undefined;
    progress?: number | undefined;
    tone?: 'green' | 'blue' | 'success' | 'warning';
  }>(),
  {
    value: '',
    unit: undefined,
    hint: undefined,
    progress: undefined,
    tone: 'green',
  },
);
</script>

<style scoped>
.mid-info-card {
  position: relative;
  display: flex;
  gap: 18px;
  min-height: 188px;
  padding: 28px 26px 58px;
  color: #17452e;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(7, 95, 56, 0.08);
  border-radius: 18px;
  box-shadow: 0 14px 36px rgba(35, 74, 49, 0.08);
}

.mid-info-card__icon {
  display: grid;
  width: 74px;
  height: 74px;
  min-width: 74px;
  place-items: center;
  color: #27962b;
  background: #e4f4df;
  border-radius: 999px;
  font-size: 38px;
}

.mid-info-card--blue .mid-info-card__icon {
  color: #168edb;
  background: #dfe8fb;
}

.mid-info-card--success .mid-info-card__icon {
  color: #087f49;
  background: #dbf4df;
}

.mid-info-card--warning .mid-info-card__icon {
  color: #9a5a00;
  background: #fff4d6;
}

.mid-info-card__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.mid-info-card__label {
  color: #202b27;
  font-size: 15px;
  font-weight: 900;
}

.mid-info-card__value {
  margin-top: 14px;
  color: #006043;
  font-size: 40px;
  font-weight: 950;
  line-height: 1;
}

.mid-info-card__value span {
  margin-left: 6px;
  font-size: 20px;
  font-weight: 900;
}

.mid-info-card__progress {
  width: 100%;
  margin: 28px 0 12px;
  color: #2fad32;
}

.mid-info-card__hint {
  position: absolute;
  right: 24px;
  bottom: 20px;
  left: 24px;
  color: #7f8787;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
}

@media (max-width: 640px) {
  .mid-info-card {
    padding: 24px;
  }

  .mid-info-card__hint {
    position: static;
    margin-top: 16px;
    text-align: left;
  }
}
</style>
