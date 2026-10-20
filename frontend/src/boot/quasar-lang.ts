import { defineBoot } from '#q-app/wrappers';
import { Lang } from 'quasar';
import th from 'quasar/lang/th';

// Quasar's Thai pack leaves the table footer's page range in English
// ("1-20 of 26"); every q-table reads it from here.
export default defineBoot(() => {
  Lang.set({
    ...th,
    table: {
      ...th.table,
      pagination: (start: number, end: number, total: number) => `${start}–${end} จาก ${total}`,
    },
  });
});
