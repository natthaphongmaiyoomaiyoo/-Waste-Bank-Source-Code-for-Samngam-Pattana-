// Compact date for table rows: day + short month + 2-digit year (e.g. "18 ก.ค. 69").
export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(
    new Date(value),
  );
}
