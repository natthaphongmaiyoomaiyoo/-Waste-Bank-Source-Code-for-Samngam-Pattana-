import { Prisma } from '@prisma/client';

// SQL twins of the frontend's Thai date labels, so a server-side search can
// match the same date text a table shows ("21 ก.ย. 2569", "วันจันทร์ที่ 21
// กันยายน 2569"). The words are spelled as in the frontend's MID date locale.

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// The server runs in the community's timezone, the same one its users' browsers
// show dates in.
export const SERVER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// A stored (UTC) timestamp column as the local wall-clock time.
export function localTimeSql(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${SERVER_TIME_ZONE})`;
}

// "21 ก.ย. 2569" - Intl th-TH { day: 'numeric', month: 'short', year: 'numeric' }.
export function thaiShortDateSql(date: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(EXTRACT(DAY FROM ${date})::int || ' '
    || (${THAI_MONTHS_SHORT}::text[])[EXTRACT(MONTH FROM ${date})::int] || ' '
    || (EXTRACT(YEAR FROM ${date})::int + 543))`;
}

// Both forms thaiDateSearchText produces: "วันจันทร์ที่ 21 กันยายน 2569" and
// "จ. 21 ก.ย. 2569".
export function thaiDateSearchSql(date: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`('วัน' || (${THAI_DAYS}::text[])[EXTRACT(DOW FROM ${date})::int + 1] || 'ที่ '
    || EXTRACT(DAY FROM ${date})::int || ' '
    || (${THAI_MONTHS}::text[])[EXTRACT(MONTH FROM ${date})::int] || ' '
    || (EXTRACT(YEAR FROM ${date})::int + 543)
    || ' | ' || (${THAI_DAYS_SHORT}::text[])[EXTRACT(DOW FROM ${date})::int + 1] || ' '
    || ${thaiShortDateSql(date)})`;
}
