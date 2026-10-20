<template>
  <q-input
    :model-value="modelValue"
    outlined
    :dense="dense"
    stack-label
    :class="['mid-time-field', accentClass]"
    mask="##:##"
    inputmode="numeric"
    placeholder="เช่น 09:00"
    :label="label"
    :disable="disable"
    :readonly="readonly"
    :rules="fieldRules"
    :hint="hint"
    @update:model-value="(value) => emit('update:modelValue', String(value ?? ''))"
  >
    <template #append>
      <q-icon name="schedule" class="mid-time-field__icon" :class="{ 'is-disabled': disable }">
        <q-popup-proxy
          v-if="!disable && !readonly"
          cover
          transition-show="scale"
          transition-hide="scale"
          @before-show="openWheel"
          @show="scrollToDraft"
        >
          <div v-if="picker === 'digital'" :class="['mid-time-wheel', accentClass]">
            <div class="mid-time-wheel__labels">
              <span>ชั่วโมง</span>
              <span>นาที</span>
            </div>

            <div class="mid-time-wheel__body">
              <div class="mid-time-wheel__band"></div>
              <div
                ref="hourCol"
                class="mid-time-wheel__col"
                role="listbox"
                aria-label="ชั่วโมง"
                @scroll="onWheelScroll('hour')"
              >
                <div
                  v-for="(hour, index) in HOURS"
                  :key="hour"
                  role="option"
                  :aria-selected="hour === draftHour"
                  class="mid-time-wheel__item"
                  :class="{ 'is-selected': hour === draftHour }"
                  @click="scrollColumn(hourCol, index, 'smooth')"
                >
                  {{ hour }}
                </div>
              </div>
              <div class="mid-time-wheel__colon">:</div>
              <div
                ref="minuteCol"
                class="mid-time-wheel__col"
                role="listbox"
                aria-label="นาที"
                @scroll="onWheelScroll('minute')"
              >
                <div
                  v-for="(minute, index) in MINUTES"
                  :key="minute"
                  role="option"
                  :aria-selected="minute === draftMinute"
                  class="mid-time-wheel__item"
                  :class="{ 'is-selected': minute === draftMinute }"
                  @click="scrollColumn(minuteCol, index, 'smooth')"
                >
                  {{ minute }}
                </div>
              </div>
            </div>

            <div class="mid-time-wheel__footer">
              <q-btn
                v-close-popup
                unelevated
                no-caps
                label="ตกลง"
                class="mid-time-wheel__done"
                @click="emitDraft"
              />
            </div>
          </div>

          <q-time
            v-else
            :model-value="modelValue"
            format24h
            now-btn
            :class="accentClass"
            @update:model-value="(value) => emit('update:modelValue', String(value ?? ''))"
          >
            <div class="row items-center justify-end">
              <q-btn v-close-popup flat no-caps label="ปิด" color="grey-7" />
            </div>
          </q-time>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import type { ValidationRule } from 'quasar';

// Time field for the whole app: 24-hour HH:mm (Thai convention), brand-green
// picker popup, and the same rounded field chrome as MidDateField.

const props = withDefaults(
  defineProps<{
    // "HH:mm" ('' when empty).
    modelValue: string;
    label?: string | undefined;
    hint?: string | undefined;
    dense?: boolean;
    disable?: boolean;
    readonly?: boolean;
    required?: boolean;
    // Must be later than this time, e.g. a round's start time.
    after?: string | undefined;
    afterMessage?: string | undefined;
    rules?: ValidationRule[] | undefined;
    // 'purple' for the funeral/bereavement flow; brand green everywhere else.
    accent?: 'primary' | 'purple';
    // 'clock' = Quasar's analog dial; 'digital' = hour and minute scroll wheels.
    // Either way the field itself still takes typed input.
    picker?: 'clock' | 'digital';
  }>(),
  {
    label: undefined,
    hint: undefined,
    dense: true,
    disable: false,
    readonly: false,
    required: false,
    after: undefined,
    afterMessage: undefined,
    rules: undefined,
    accent: 'primary',
    picker: 'clock',
  },
);

// The clock is portaled to <body>, outside any wrapper carrying the accent
// class - so stamp it on the q-time directly too.
const accentClass = computed(() => (props.accent === 'purple' ? 'mid-accent-purple' : undefined));

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// --- Digital (scroll wheel) picker ------------------------------------------------
// Two snap-scrolling columns; whichever row sits in the centre band is the value.
// Must match .mid-time-wheel__item's height below.
const ITEM_HEIGHT = 40;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const hourCol = ref<HTMLElement | null>(null);
const minuteCol = ref<HTMLElement | null>(null);
const draftHour = ref('00');
const draftMinute = ref('00');

// Re-read on every open: the field may have been typed into since last time.
// An empty field starts at the current hour.
function openWheel() {
  const match = /^(\d{2}):(\d{2})$/.exec(props.modelValue ?? '');
  draftHour.value = match?.[1] ?? String(new Date().getHours()).padStart(2, '0');
  draftMinute.value = match?.[2] ?? '00';
  void nextTick(scrollToDraft);
}

function scrollColumn(column: HTMLElement | null, index: number, behavior: ScrollBehavior) {
  column?.scrollTo({ top: Math.max(index, 0) * ITEM_HEIGHT, behavior });
}

function scrollToDraft() {
  scrollColumn(hourCol.value, HOURS.indexOf(draftHour.value), 'auto');
  scrollColumn(minuteCol.value, MINUTES.indexOf(draftMinute.value), 'auto');
}

function emitDraft() {
  emit('update:modelValue', `${draftHour.value}:${draftMinute.value}`);
}

// Read the column once scrolling settles. Landing on the row it was already on
// (the scroll made by opening the picker) changes nothing, so an empty field
// stays empty until the user actually turns a wheel or presses ตกลง.
const settleTimers: Partial<Record<'hour' | 'minute', ReturnType<typeof setTimeout>>> = {};

function onWheelScroll(part: 'hour' | 'minute') {
  clearTimeout(settleTimers[part]);
  settleTimers[part] = setTimeout(() => {
    const column = part === 'hour' ? hourCol.value : minuteCol.value;
    const list = part === 'hour' ? HOURS : MINUTES;
    if (!column) return;
    const index = Math.min(list.length - 1, Math.max(0, Math.round(column.scrollTop / ITEM_HEIGHT)));
    const value = list[index];
    const draft = part === 'hour' ? draftHour : draftMinute;
    if (value === undefined || value === draft.value) return;
    draft.value = value;
    emitDraft();
  }, 90);
}

onBeforeUnmount(() => {
  clearTimeout(settleTimers.hour);
  clearTimeout(settleTimers.minute);
});

const fieldRules = computed<ValidationRule[]>(() => [
  (value: string | null) => {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return props.required ? 'จำเป็นต้องกรอก' : true;
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? true : 'กรอกเวลาเป็นรูปแบบ ชช:นน (24 ชม.)';
  },
  (value: string | null) => {
    const trimmed = (value ?? '').trim();
    if (!props.after || !trimmed) return true;
    return trimmed > props.after || (props.afterMessage ?? `ต้องหลัง ${props.after} น.`);
  },
  ...(props.rules ?? []),
]);
</script>

<style scoped>
/* See MidDateField: colour comes from --mid-accent so accent wrappers win. */
.mid-time-field__icon {
  color: var(--mid-accent, #087f49);
  cursor: pointer;
}

.mid-time-field__icon.is-disabled {
  color: var(--mid-accent-disabled, #9db3a6);
  cursor: not-allowed;
}

.mid-time-wheel {
  width: min(280px, calc(100vw - 32px));
  padding: 14px 16px 16px;
  background: #ffffff;
}

.mid-time-wheel__labels {
  display: grid;
  grid-template-columns: 1fr 24px 1fr;
  margin-bottom: 6px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
}

.mid-time-wheel__labels span:last-child {
  grid-column: 3;
}

.mid-time-wheel__body {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 24px 1fr;
  align-items: center;
}

/* The row lined up with this band is the chosen value (5 rows tall, band on row 3). */
.mid-time-wheel__band {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  height: 40px;
  background: var(--mid-accent-soft, #e6f5ed);
  border-radius: 12px;
  pointer-events: none;
}

.mid-time-wheel__col {
  position: relative;
  height: 200px;
  padding: 80px 0;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent);
}

.mid-time-wheel__col::-webkit-scrollbar {
  display: none;
}

.mid-time-wheel__item {
  height: 40px;
  color: #9aa7a0;
  font-size: 20px;
  font-weight: 600;
  line-height: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  scroll-snap-align: center;
  cursor: pointer;
  user-select: none;
}

.mid-time-wheel__item.is-selected {
  color: var(--mid-accent-deep, #0b5f38);
  font-weight: 800;
}

.mid-time-wheel__colon {
  position: relative;
  color: var(--mid-accent-deep, #0b5f38);
  font-size: 20px;
  font-weight: 800;
  text-align: center;
}

.mid-time-wheel__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.mid-time-wheel__done {
  padding: 4px 22px;
  color: #ffffff;
  background: var(--mid-accent, #087f49);
  border-radius: 999px;
}
</style>
