// Thai calendar bits shared by every date/time control in the app.
//
// Previously each page carried its own copy of the month/day names and its own
// พ.ศ. <-> ค.ศ. conversion; they are here now so a fix lands everywhere at once.
// MidDateField / MidTimeField wrap these - reach for those components first and
// only use the raw helpers when you need a bespoke picker.

export const midThaiDateLocale = {
  days: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  daysShort: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
  months: [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
  ],
  monthsShort: [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ],
  firstDayOfWeek: 0,
  format24h: true,
  pluralDay: 'วัน',
} as const;

// Buddhist calendar is 543 years ahead of the Gregorian one.
export const BUDDHIST_YEAR_OFFSET = 543;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// "2026-07-26" -> "26/07/2569" (empty string when the input isn't a valid ISO date).
export function isoToThaiDate(isoDate: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!match) return '';
  return `${match[3]}/${match[2]}/${Number(match[1]) + BUDDHIST_YEAR_OFFSET}`;
}

// "26/07/2569" -> "2026-07-26" ('' when the date is malformed or doesn't exist,
// e.g. 31/02). Rejects Gregorian years typed by mistake (พ.ศ. is always >= 2400).
export function thaiDateToIso(display: string | null | undefined): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((display ?? '').trim());
  if (!match) return '';

  const day = Number(match[1]);
  const month = Number(match[2]);
  const buddhistYear = Number(match[3]);
  const year = buddhistYear - BUDDHIST_YEAR_OFFSET;
  const date = new Date(year, month - 1, day);

  if (
    buddhistYear < 2400 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Long Thai form for read-only display: "26 กรกฎาคม 2569".
export function isoToThaiLongDate(isoDate: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!match) return '-';
  const monthName = midThaiDateLocale.months[Number(match[2]) - 1] ?? '';
  return `${Number(match[3])} ${monthName} ${Number(match[1]) + BUDDHIST_YEAR_OFFSET}`;
}

// Short Thai form with the weekday: "พฤ. 17 ก.ย. 2569". Built from the name
// tables rather than Intl, whose Thai "short" weekday differs between browsers
// (Chrome prints "เสาร์" in full).
export function isoToThaiShortDate(isoDate: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!match) return '-';
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const weekday = midThaiDateLocale.daysShort[new Date(year, month - 1, day).getDay()] ?? '';
  const monthName = midThaiDateLocale.monthsShort[month - 1] ?? '';
  return `${weekday} ${day} ${monthName} ${year + BUDDHIST_YEAR_OFFSET}`;
}

export const MID_THAI_DATE_HINT = 'วว/ดด/ปปปป (พ.ศ.)';
export const MID_THAI_DATE_ERROR = 'กรอกวันที่เป็นรูปแบบ วว/ดด/ปปปป ปี พ.ศ.';
