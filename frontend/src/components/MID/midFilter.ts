// One entry per filter that currently narrows a list, for MidFilterBar. The
// page builds these from its own refs, so every page keeps its existing filter
// fields (selects, date fields, dependent year/month pickers...) - the bar only
// moves them into a dialog and reports what is on.
export interface MidActiveFilter {
  key: string;
  // Field name, e.g. 'สถานะ'
  label: string;
  // Human-readable selected value, e.g. 'ใช้งาน'
  value: string;
}

// Label of the selected option, for a chip's value - falls back to the raw value
// so a stale selection still shows something rather than an empty chip.
export function midOptionLabel<T>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}
