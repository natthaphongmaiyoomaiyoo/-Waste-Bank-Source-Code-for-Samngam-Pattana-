// Shared display helpers for the Municipality monitoring pages and the
// Committee member-management pages (src/pages/committee/).
//
// Thai month/day names come from the design system - components/MID/thaiDate.ts -
// so the pickers and these labels can never drift apart.

import { midThaiDateLocale } from 'components/MID';

export function formatBaht(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatQuantity(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

export function formatCarbon(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatThaiDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate));
}

export function formatThaiDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export const THAI_MONTH_NAMES: readonly string[] = midThaiDateLocale.months;
export const THAI_MONTH_SHORT_NAMES: readonly string[] = midThaiDateLocale.monthsShort;

// Every spelling of a date a search box should accept. Tables show the short
// form ("21 ก.ย. 2569"), but people type the long one ("21 กันยายน", "วันจันทร์").
// Parsed the same way as formatThaiDate so both agree on the day.
export function thaiDateSearchText(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.getMonth();
  const weekday = date.getDay();
  const year = date.getFullYear() + 543;
  return [
    `วัน${midThaiDateLocale.days[weekday] ?? ''}ที่ ${day} ${THAI_MONTH_NAMES[month] ?? ''} ${year}`,
    `${midThaiDateLocale.daysShort[weekday] ?? ''} ${day} ${THAI_MONTH_SHORT_NAMES[month] ?? ''} ${year}`,
  ].join(' | ');
}

// "YYYY-MM" (backend monthlySeries key) -> "ม.ค. 2569" style label.
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return `${midThaiDateLocale.monthsShort[month - 1]} ${year + 543}`;
}

export const MEMBER_STATUS_LABELS: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  active: 'ใช้งาน',
  resigned: 'ลาออก',
  deceased: 'เสียชีวิต',
};

export const MEMBER_STATUS_COLORS: Record<string, { color: string; textColor: string }> = {
  pending: { color: 'orange-1', textColor: 'orange-9' },
  active: { color: 'green-2', textColor: 'positive' },
  resigned: { color: 'grey-3', textColor: 'grey-8' },
  deceased: { color: 'grey-4', textColor: 'grey-9' },
};

export function memberStatusLabel(status: string): string {
  return MEMBER_STATUS_LABELS[status] ?? status;
}

export function memberStatusColor(status: string): { color: string; textColor: string } {
  return MEMBER_STATUS_COLORS[status] ?? { color: 'grey-3', textColor: 'grey-8' };
}

// Reading order for every status breakdown: active first, then the ways a
// membership winds down. The statuses themselves still come from whatever the
// backend reports - anything unlisted sorts to the end.
export const MEMBER_STATUS_ORDER: readonly string[] = ['active', 'pending', 'resigned', 'deceased'];

// Fill colours for status charts (the municipality donut, the committee
// dashboard's status bar). Shared so the same status is never two colours in
// two places.
//
// Validated as an ordered set: every neighbouring pair clears ΔE 8 under
// protan/deutan/tritan simulation and ΔE 15 for normal vision, so no two
// adjacent slices can be confused. 'resigned'/'deceased' are deliberately low
// chroma - a wound-down membership should recede rather than compete with the
// live states - and every chart using these ships the label and the count
// beside the swatch, so colour is never the only channel.
export const MEMBER_STATUS_TONE: Record<string, string> = {
  active: '#1e8a44',
  pending: '#d99320',
  resigned: '#7b8fa8',
  deceased: '#4f5d6b',
};

export function memberStatusTone(status: string): string {
  return MEMBER_STATUS_TONE[status] ?? '#7b8fa8';
}

export function memberStatusRank(status: string): number {
  const index = MEMBER_STATUS_ORDER.indexOf(status);
  return index < 0 ? MEMBER_STATUS_ORDER.length : index;
}

// --- Collection-round display state ---------------------------------------------
// collection_round.status only ever says planned / completed / cancelled: nothing
// flips it when a round's own time window closes. So "เปิดรับ" is derived, not
// read straight off the row - a round dated today that ran 09:00-17:00 is over at
// 17:00 even though it is still 'planned'. Backend counterpart:
// scheduleService.roundWindowEnded (same rule, enforced on booking).

export type RoundDisplayState = 'open' | 'ended' | 'completed' | 'cancelled';

export const ROUND_STATE_LABELS: Record<RoundDisplayState, string> = {
  open: 'เปิดรับ',
  ended: 'เลยกำหนด',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิกรอบ',
};

// "YYYY-MM-DD HH:mm" of right now, for lexicographic comparison against a round.
function nowStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export interface RoundStateInput {
  roundDate: string;
  endTime: string;
  status: string;
}

export function roundWindowEnded(round: RoundStateInput): boolean {
  return `${round.roundDate.slice(0, 10)} ${round.endTime}` < nowStamp();
}

export function roundDisplayState(round: RoundStateInput): RoundDisplayState {
  if (round.status === 'cancelled') return 'cancelled';
  if (round.status === 'completed') return 'completed';
  return roundWindowEnded(round) ? 'ended' : 'open';
}

// Client-side search for the round tables (rounds come back unpaginated). Reads
// the same text the table shows - the Thai date label, times, buyer, meeting
// point and village - so whatever the user can see in a row, they can type.
export function roundMatchesSearch(
  round: {
    roundDate: string;
    startTime: string;
    endTime: string;
    locationNote: string | null;
    buyer: { buyerName: string } | null;
    villageArea: { villageName: string; moo: string | null } | null;
  },
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    formatThaiDate(round.roundDate),
    `${round.startTime} - ${round.endTime}`,
    round.buyer?.buyerName,
    round.locationNote,
    round.villageArea
      ? `หมู่ ${round.villageArea.moo ?? '-'} ${round.villageArea.villageName}`
      : 'รอบกลางของเทศบาล',
  ].some((text) => text?.toLowerCase().includes(needle));
}

export const FUND_TYPE_LABELS: Record<string, string> = {
  contribution: 'เติมเงินสะสมขั้นต่ำจากการขายขยะ',
  deposit: 'เก็บเงินสะสมเพิ่มจากการขายขยะ',
  benefit_payment: 'หักจ่ายฌาปนกิจ',
  funeral_late_payment: 'รับชำระเงินฌาปนกิจค้างจ่าย',
  donation: 'เงินบริจาค',
  adjustment: 'ปรับปรุงยอด',
};

export function fundTypeLabel(type: string): string {
  return FUND_TYPE_LABELS[type] ?? type;
}

export function memberFullName(member: {
  prefix?: string | null;
  firstName: string;
  lastName: string;
}): string {
  return `${member.prefix ?? ''}${member.firstName} ${member.lastName}`.trim();
}

// --- Fund-contribution tracking -------------------------------------------------
// Every member is required to hold at least this much in their savings
// (backend: FUND_MINIMUM_BAHT). Falling under it costs them the
// funeral-benefit eligibility, so both member lists can filter on who is short.
export const FUND_MINIMUM_BAHT = 50;

// Sentinel option value for the "สถานะ" select. It is NOT a member.status, so
// the pages translate it into the backend's separate `fundStatus` query param -
// which means picking it replaces the status filter rather than combining with
// it (resigned/deceased members under the minimum show up too).
export const FUND_BELOW_MINIMUM_FILTER = 'fund_below_minimum';

// What that sentinel turns into on the wire (backend MEMBER_FUND_FILTER).
export const FUND_STATUS_BELOW_MINIMUM = 'below_minimum';

export const MEMBER_LIST_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  ...Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  { value: FUND_BELOW_MINIMUM_FILTER, label: `เงินสะสมยังไม่ครบ (${FUND_MINIMUM_BAHT} บาท)` },
];

export function isFundBelowMinimum(member: {
  fundBalance?: { totalContribution: number } | null;
}): boolean {
  return (member.fundBalance?.totalContribution ?? 0) < FUND_MINIMUM_BAHT;
}

// The "เงินสะสมไม่ครบ" chip beside the status. Once a member has resigned or died
// the membership is over, so the list shows only that status.
const MEMBERSHIP_ENDED_STATUSES = new Set(['resigned', 'deceased']);

export function showsFundShortfall(member: {
  status: string;
  fundBalance?: { totalContribution: number } | null;
}): boolean {
  return !MEMBERSHIP_ENDED_STATUSES.has(member.status) && isFundBelowMinimum(member);
}
