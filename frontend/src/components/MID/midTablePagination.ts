import { ref, watch, type Ref } from 'vue';

// Rows-per-page choices every q-table offers. A table whose own default is not
// one of these (a grid sized 6, 8, 12...) gets that number added - see
// midRowsPerPageOptions.
export const MID_ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50];

export function midRowsPerPageOptions(defaultRows: number): number[] {
  return [...new Set([...MID_ROWS_PER_PAGE_OPTIONS, defaultRows])].sort((a, b) => a - b);
}

// The rows per page a member picked on a table stays picked - across visits and
// reloads, in that browser - until they pick another. One key per table.
const STORAGE_PREFIX = 'mid-rows-per-page:';

export function savedRowsPerPage(key: string, fallback: number): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_PREFIX + key));
    return Number.isInteger(saved) && saved > 0 ? saved : fallback;
  } catch {
    return fallback;
  }
}

// Saves whenever the source changes - only a real change, so a table nobody
// touched keeps following its default.
export function rememberRowsPerPage(key: string, source: () => number) {
  watch(source, (rows, previous) => {
    if (rows === previous || !(rows > 0)) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + key, String(rows));
    } catch {
      // Private mode / storage off: the choice just lasts until the page closes.
    }
  });
}

// A table's v-model:pagination state that starts from the remembered rows per
// page and remembers new picks. Read before the first request, so a
// server-paged table never loads the default size first.
export function useRememberedPagination<T extends { rowsPerPage: number }>(
  key: string,
  initial: T,
): Ref<T> {
  const pagination = ref({
    ...initial,
    rowsPerPage: savedRowsPerPage(key, initial.rowsPerPage),
  }) as Ref<T>;
  rememberRowsPerPage(key, () => pagination.value.rowsPerPage);
  return pagination;
}
