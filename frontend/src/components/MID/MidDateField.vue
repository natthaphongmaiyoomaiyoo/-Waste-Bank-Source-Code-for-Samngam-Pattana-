<template>
  <q-input
    v-model="display"
    outlined
    :dense="dense"
    stack-label
    :class="['mid-date-field', accentClass]"
    mask="##/##/####"
    inputmode="numeric"
    :label="label"
    :placeholder="MID_THAI_DATE_HINT"
    :disable="disable"
    :readonly="readonly"
    :clearable="clearable"
    :rules="fieldRules"
    :hint="hint"
    @blur="commitTyped"
    @clear="onClear"
  >
    <template #append>
      <q-icon name="event" class="mid-date-field__icon" :class="{ 'is-disabled': disable }">
        <q-popup-proxy
          v-if="!disable && !readonly"
          cover
          transition-show="scale"
          transition-hide="scale"
          @before-show="openBuddhistPicker"
        >
          <!-- พ.ศ. picker: q-date can only print ค.ศ. years, so it draws just the
               day grid here and the header / month-year bar / month and year
               grids around it are ours. -->
          <div v-if="buddhistYear" :class="['mid-date-be', accentClass]">
            <div class="mid-date-be__header">
              <div class="mid-date-be__header-caption">วันที่เลือก</div>
              <div class="mid-date-be__header-date">
                {{ modelValue ? isoToThaiLongDate(modelValue) : '—' }}
              </div>
            </div>

            <div class="mid-date-be__nav">
              <div class="mid-date-be__nav-group">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="chevron_left"
                  aria-label="เดือนก่อนหน้า"
                  @click="stepCalendar('month', true)"
                />
                <q-btn
                  flat
                  dense
                  no-caps
                  class="mid-date-be__nav-label"
                  :label="midThaiDateLocale.months[viewMonth - 1]"
                  @click="togglePanel('months')"
                />
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="chevron_right"
                  aria-label="เดือนถัดไป"
                  @click="stepCalendar('month', false)"
                />
              </div>
              <div class="mid-date-be__nav-group">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="chevron_left"
                  aria-label="ปีก่อนหน้า"
                  @click="stepCalendar('year', true)"
                />
                <q-btn
                  flat
                  dense
                  no-caps
                  class="mid-date-be__nav-label"
                  :label="String(viewYear + BUDDHIST_YEAR_OFFSET)"
                  @click="togglePanel('years')"
                />
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="chevron_right"
                  aria-label="ปีถัดไป"
                  @click="stepCalendar('year', false)"
                />
              </div>
            </div>

            <div v-if="panel === 'months'" class="mid-date-be__grid mid-date-be__grid--months">
              <q-btn
                v-for="(name, index) in midThaiDateLocale.months"
                :key="name"
                flat
                dense
                no-caps
                :label="name"
                :class="{ 'is-current': index + 1 === viewMonth }"
                @click="pickMonth(index + 1)"
              />
            </div>

            <div v-else-if="panel === 'years'" class="mid-date-be__years">
              <q-btn
                flat
                round
                dense
                size="sm"
                icon="chevron_left"
                aria-label="ช่วงปีก่อนหน้า"
                @click="yearPageStart -= YEARS_PER_PAGE"
              />
              <div class="mid-date-be__grid mid-date-be__grid--years">
                <q-btn
                  v-for="year in yearPage"
                  :key="year"
                  flat
                  dense
                  no-caps
                  :label="String(year + BUDDHIST_YEAR_OFFSET)"
                  :class="{ 'is-current': year === viewYear }"
                  @click="pickYear(year)"
                />
              </div>
              <q-btn
                flat
                round
                dense
                size="sm"
                icon="chevron_right"
                aria-label="ช่วงปีถัดไป"
                @click="yearPageStart += YEARS_PER_PAGE"
              />
            </div>

            <q-date
              v-show="panel === 'calendar'"
              ref="buddhistDateRef"
              :model-value="modelValue || ''"
              mask="YYYY-MM-DD"
              minimal
              flat
              class="mid-date-be__calendar"
              :locale="midThaiDateLocale"
              :default-year-month="defaultYearMonth"
              :options="pickerOptions"
              @navigation="onNavigation"
              @update:model-value="onPick"
            />

            <div class="mid-date-be__footer">
              <q-btn flat no-caps label="วันนี้" class="mid-date-be__today" @click="pickToday" />
              <q-btn v-close-popup flat no-caps label="ปิด" color="grey-7" />
            </div>
          </div>

          <q-date
            v-else
            :model-value="modelValue || ''"
            mask="YYYY-MM-DD"
            :class="accentClass"
            :locale="midThaiDateLocale"
            :default-year-month="defaultYearMonth"
            :options="pickerOptions"
            today-btn
            @update:model-value="onPick"
          >
            <div class="row items-center justify-end q-gutter-sm">
              <q-btn v-close-popup flat no-caps label="ปิด" color="grey-7" />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QDate, ValidationRule } from 'quasar';
import {
  BUDDHIST_YEAR_OFFSET,
  MID_THAI_DATE_ERROR,
  MID_THAI_DATE_HINT,
  isoToThaiDate,
  isoToThaiLongDate,
  midThaiDateLocale,
  thaiDateToIso,
} from './thaiDate';

// Date field for the whole app: types as วว/ดด/ปปปป in พ.ศ., picks from a Thai
// calendar, and always talks ISO (YYYY-MM-DD) to the parent - so v-model can go
// straight into an API payload.

const props = withDefaults(
  defineProps<{
    // ISO date, e.g. "2026-07-26". Accepts null so filter fields that start
    // empty (ref<string | null>(null)) can bind straight to it.
    modelValue: string | null;
    label?: string | undefined;
    hint?: string | undefined;
    dense?: boolean;
    disable?: boolean;
    readonly?: boolean;
    required?: boolean;
    // Shows the "x" button - handy on filter bars.
    clearable?: boolean;
    // 'purple' for the funeral/bereavement flow; brand green everywhere else.
    accent?: 'primary' | 'purple';
    // Month the calendar opens on when no date is picked yet, e.g. "2000/01".
    defaultYearMonth?: string | undefined;
    // Passed through to q-date (limit selectable days).
    options?: ((date: string) => boolean) | undefined;
    // Extra rules appended after the built-in format check.
    rules?: ValidationRule[] | undefined;
    // Show the calendar popup's years in พ.ศ. too (header, month-year bar and
    // year grid). Off = Quasar's own q-date, which prints ค.ศ. years.
    buddhistYear?: boolean;
    // Nothing after today: future days are greyed out in the calendar and a
    // typed future date fails validation (birth dates).
    noFuture?: boolean;
  }>(),
  {
    label: undefined,
    hint: undefined,
    dense: true,
    disable: false,
    readonly: false,
    required: false,
    clearable: false,
    accent: 'primary',
    defaultYearMonth: undefined,
    options: undefined,
    rules: undefined,
    buddhistYear: false,
    noFuture: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// The picker is portaled to <body>, outside any wrapper the page may have put
// the accent class on - so stamp it on the q-date directly too.
const accentClass = computed(() => (props.accent === 'purple' ? 'mid-accent-purple' : undefined));

const display = ref(isoToThaiDate(props.modelValue));

// Keep the visible พ.ศ. text in step when the parent changes the ISO value
// (form reset, loading an existing record, picking from the calendar).
watch(
  () => props.modelValue,
  (iso) => {
    const next = isoToThaiDate(iso);
    if (next !== display.value) display.value = next;
  },
);

const fieldRules = computed<ValidationRule[]>(() => [
  (value: string | null) => {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return props.required ? 'จำเป็นต้องกรอก' : true;
    return thaiDateToIso(trimmed) ? true : MID_THAI_DATE_ERROR;
  },
  (value: string | null) => {
    if (!props.noFuture) return true;
    const iso = thaiDateToIso((value ?? '').trim());
    return !iso || iso <= localIsoDate() || 'วันที่ต้องไม่เกินวันนี้';
  },
  ...(props.rules ?? []),
]);

// Only push a complete, real date upward - half-typed input must not wipe the
// parent's value while the user is still typing.
function commitTyped() {
  const trimmed = display.value.trim();
  if (!trimmed) {
    emit('update:modelValue', '');
    return;
  }

  const iso = thaiDateToIso(trimmed);
  if (iso) emit('update:modelValue', iso);
}

function onPick(value: string | null) {
  const iso = value ?? '';
  display.value = isoToThaiDate(iso);
  emit('update:modelValue', iso);
}

// Today as "YYYY-MM-DD" in local time (toISOString would be UTC).
function localIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// q-date hands each day over as "YYYY/MM/DD".
const pickerOptions = computed(() => {
  if (!props.noFuture) return props.options;
  const pageOptions = props.options;
  return (date: string) =>
    date.replace(/\//g, '-') <= localIsoDate() && (pageOptions ? pageOptions(date) : true);
});

function onClear() {
  display.value = '';
  emit('update:modelValue', '');
}

// --- พ.ศ. picker ----------------------------------------------------------------
// q-date stays on its day grid for good; the month and year grids are ours, and
// our bar drives q-date through offsetCalendar / setCalendarTo. viewYear is ค.ศ.
// (what q-date speaks) - only the labels add BUDDHIST_YEAR_OFFSET.

const YEARS_PER_PAGE = 20;

const buddhistDateRef = ref<QDate | null>(null);
const panel = ref<'calendar' | 'months' | 'years'>('calendar');
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth() + 1);
const yearPageStart = ref(viewYear.value);

const yearPage = computed(() =>
  Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart.value + i),
);

// Same month q-date opens on: the picked date, else defaultYearMonth, else today.
function openBuddhistPicker() {
  const picked = /^(\d{4})-(\d{2})/.exec(props.modelValue ?? '');
  const fallback = /^(\d{4})\/(\d{2})/.exec(props.defaultYearMonth ?? '');
  const source = picked ?? fallback;
  const today = new Date();
  viewYear.value = source ? Number(source[1]) : today.getFullYear();
  viewMonth.value = source ? Number(source[2]) : today.getMonth() + 1;
  panel.value = 'calendar';
}

function onNavigation({ year, month }: { year: number; month: number }) {
  viewYear.value = year;
  viewMonth.value = month;
}

function stepCalendar(unit: 'month' | 'year', back: boolean) {
  panel.value = 'calendar';
  buddhistDateRef.value?.offsetCalendar(unit, back);
}

function togglePanel(target: 'months' | 'years') {
  if (panel.value === target) {
    panel.value = 'calendar';
    return;
  }
  // Open the year grid on the page holding the year being viewed (in พ.ศ.
  // blocks of 20, e.g. 2540-2559).
  if (target === 'years') {
    const buddhist = viewYear.value + BUDDHIST_YEAR_OFFSET;
    yearPageStart.value = buddhist - (buddhist % YEARS_PER_PAGE) - BUDDHIST_YEAR_OFFSET;
  }
  panel.value = target;
}

function pickMonth(month: number) {
  buddhistDateRef.value?.setCalendarTo(viewYear.value, month);
  viewMonth.value = month;
  panel.value = 'calendar';
}

function pickYear(year: number) {
  buddhistDateRef.value?.setCalendarTo(year, viewMonth.value);
  viewYear.value = year;
  panel.value = 'calendar';
}

function pickToday() {
  panel.value = 'calendar';
  buddhistDateRef.value?.setToday();
}
</script>

<style scoped>
/* --mid-accent is set by mid-theme.scss (brand green by default, swapped by an
   accent wrapper such as .mid-accent-purple). Never hard-code a colour here -
   scoped styles out-specify the global theme, so the accent could not win. */
.mid-date-field__icon {
  color: var(--mid-accent, #087f49);
  cursor: pointer;
}

.mid-date-field__icon.is-disabled {
  color: var(--mid-accent-disabled, #9db3a6);
  cursor: not-allowed;
}

/* --- พ.ศ. picker --- */
.mid-date-be {
  width: 290px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
}

.mid-date-be__header {
  padding: 14px 18px;
  color: #ffffff;
  background: linear-gradient(135deg, var(--mid-accent, #087f49), var(--mid-accent-deep, #0b5f38));
}

.mid-date-be__header-caption {
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.8;
}

.mid-date-be__header-date {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 800;
}

.mid-date-be__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 10px 8px 0;
  color: var(--mid-accent-deep, #0b5f38);
}

.mid-date-be__nav-group {
  display: flex;
  align-items: center;
}

.mid-date-be__nav-label {
  padding: 2px 6px;
  font-weight: 700;
}

.mid-date-be__calendar {
  width: 100%;
  min-width: 0;
}

/* Our bar replaces q-date's, which would print the ค.ศ. year. */
.mid-date-be__calendar :deep(.q-date__navigation) {
  display: none;
}

.mid-date-be__grid {
  display: grid;
  gap: 6px;
  padding: 12px;
}

.mid-date-be__grid--months {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mid-date-be__years {
  display: flex;
  align-items: center;
}

.mid-date-be__grid--years {
  flex: 1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding-inline: 0;
}

.mid-date-be__grid .q-btn {
  min-height: 34px;
  color: #1f2d26;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
}

.mid-date-be__grid .q-btn.is-current {
  color: #ffffff;
  background: var(--mid-accent, #087f49);
  font-weight: 800;
}

.mid-date-be__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 8px;
}

.mid-date-be__today {
  color: var(--mid-accent-deep, #0b5f38);
  font-weight: 700;
}
</style>
