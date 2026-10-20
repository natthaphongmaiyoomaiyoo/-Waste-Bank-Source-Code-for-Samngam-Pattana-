// รายงาน PDF "การเสียชีวิตและเงินฌาปนกิจสงเคราะห์" ของเจ้าหน้าที่เทศบาล
// ใช้ pdfmake + ฟอนต์ TH Sarabun PSK ชุดเดียวกับรายงานเล่มหลัก (municipalityReportPdf)
// จึงแสดงภาษาไทยได้ถูกต้องเหมือนกัน ข้อมูลมาจาก GET /municipality/funeral-cases[/:id]
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { sarabunVfs } from './sarabunVfs';
import { ORGANIZATION_NAME, ORGANIZATION_SUB } from './municipalityReportPdf';
import type {
  FuneralCaseDetail,
  FuneralCaseRow,
  FuneralContributionRow,
} from 'src/stores/municipalityStore';

pdfMake.vfs = sarabunVfs;
pdfMake.fonts = {
  'TH Sarabun PSK': {
    normal: 'Sarabun-Regular.ttf',
    bold: 'Sarabun-Bold.ttf',
    italics: 'Sarabun-Regular.ttf',
    bolditalics: 'Sarabun-Bold.ttf',
  },
};

const GREEN_DARK = '#0b4f36';
const GREEN = '#159757';
const GREY_LINE = '#c9d6cd';
const ZEBRA = '#f2f7f3';

const CASE_REPORT_TITLE = 'รายงานการเสียชีวิตและเงินฌาปนกิจสงเคราะห์';
const LIST_REPORT_TITLE = 'รายงานสรุปการเสียชีวิตของสมาชิก';

export const CONTRIBUTION_STATUS_LABELS: Record<FuneralContributionRow['status'], string> = {
  completed: 'จ่ายครบ',
  partially_paid: 'จ่ายบางส่วน',
  shortfall_remaining: 'ยังไม่ได้จ่าย',
};

function baht(value: number): string {
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thaiDate(value: string | Date): string {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(value),
  );
}

function thaiDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function th(text: string): TableCell {
  return { text, style: 'th' };
}

function tdRight(text: string): TableCell {
  return { text, alignment: 'right' };
}

function reportTable(
  headerRow: TableCell[],
  rows: TableCell[][],
  widths: (string | number)[],
): Content {
  return {
    table: { headerRows: 1, widths, body: [headerRow, ...rows] },
    layout: {
      fillColor: (rowIndex: number) =>
        rowIndex === 0 ? GREEN_DARK : rowIndex % 2 === 0 ? ZEBRA : null,
      hLineColor: () => GREY_LINE,
      vLineColor: () => GREY_LINE,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 6,
      paddingRight: () => 6,
    },
    margin: [0, 6, 0, 0],
  };
}

function sectionTitle(text: string): Content {
  return { text, fontSize: 12, bold: true, color: GREEN_DARK, margin: [0, 14, 0, 0] };
}

function metaCell(label: string, value: string): Content {
  return {
    columns: [
      { text: label, width: 110, color: '#5f6f66' },
      { text: value, width: '*', bold: true },
    ],
    margin: [0, 1, 0, 1],
  };
}

function documentHeader(title: string, preparedBy: string, generatedAt: Date): Content[] {
  return [
    {
      stack: [
        { text: ORGANIZATION_NAME, fontSize: 15, bold: true, color: GREEN_DARK },
        { text: ORGANIZATION_SUB, fontSize: 10, color: '#5f6f66', margin: [0, 2, 0, 0] },
      ],
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.2, lineColor: GREEN }],
      margin: [0, 8, 0, 10],
    },
    { text: title, fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 8] },
    metaCell('วันที่ออกรายงาน', thaiDateTime(generatedAt)),
    metaCell('ผู้จัดทำ', preparedBy),
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: GREY_LINE }],
      margin: [0, 8, 0, 4],
    },
  ];
}

function addressOf(row: FuneralCaseRow): string {
  const home = row.deceasedMember.household;
  if (!home) return '-';
  return [
    home.houseNo ? `บ้านเลขที่ ${home.houseNo}` : '',
    home.moo ? `หมู่ ${home.moo}` : '',
    home.subdistrict ? `ต.${home.subdistrict}` : '',
    home.district ? `อ.${home.district}` : '',
    home.province ? `จ.${home.province}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function documentFooter(generatedAt: Date) {
  return (currentPage: number, pageCount: number): Content => ({
    columns: [
      { text: `ออกรายงานเมื่อ ${thaiDateTime(generatedAt)}`, fontSize: 8, color: '#8a958e' },
      {
        text: `หน้า ${currentPage} / ${pageCount}`,
        fontSize: 8,
        color: '#8a958e',
        alignment: 'right',
      },
    ],
    margin: [40, 14, 40, 0],
  });
}

function baseDoc(title: string, preparedBy: string, generatedAt: Date, body: Content[]) {
  return {
    pageSize: 'A4',
    pageMargins: [40, 36, 40, 46],
    defaultStyle: { font: 'TH Sarabun PSK', fontSize: 10.5, lineHeight: 1.15 },
    styles: { th: { bold: true, color: '#ffffff', fontSize: 10 } },
    info: { title, author: preparedBy },
    content: [...documentHeader(title, preparedBy, generatedAt), ...body],
    footer: documentFooter(generatedAt),
  } satisfies TDocumentDefinitions;
}

// --- รายงานรายกรณี (ผู้เสียชีวิต 1 ราย) -------------------------------------------

export function buildFuneralCaseDoc(
  detail: FuneralCaseDetail,
  options: { preparedBy: string },
): TDocumentDefinitions {
  const generatedAt = new Date();
  const member = detail.deceasedMember;
  const summary = detail.summary;

  const deceasedRows: TableCell[][] = [
    ['ชื่อ-นามสกุล', member.fullName],
    ['รหัสสมาชิก', member.memberCode],
    ['เลขบัตรประชาชน', member.citizenId],
    ['ที่อยู่', addressOf(detail)],
    ['วันที่เสียชีวิต', thaiDate(detail.deathDate)],
    ['สาเหตุการเสียชีวิต', detail.causeOfDeath],
    ['วันที่บันทึกเรื่อง', thaiDate(detail.eventDate)],
  ];

  // ยอดที่ทายาทได้รับ = เงินสมทบที่เก็บได้จากสมาชิกคนอื่น + เงินสะสมของผู้เสียชีวิตเอง
  // ที่ถูกปิดบัญชีเข้ากองทุนทั้งจำนวนตอนแจ้งเสียชีวิต
  const summaryRows: TableCell[][] = [
    ['อัตราเงินสมทบต่อคน', tdRight(`${baht(summary.requiredAmount)} บาท`)],
    ['จำนวนสมาชิกที่ถูกเรียกเก็บ', tdRight(`${summary.chargedMemberCount.toLocaleString('th-TH')} คน`)],
    ['จ่ายครบตามอัตรา', tdRight(`${summary.paidInFullCount.toLocaleString('th-TH')} คน`)],
    ['จ่ายบางส่วน', tdRight(`${summary.partiallyPaidCount.toLocaleString('th-TH')} คน`)],
    ['ยังไม่ได้จ่าย (เงินสะสมไม่พอ)', tdRight(`${summary.unpaidCount.toLocaleString('th-TH')} คน`)],
    ['เงินสมทบที่เก็บได้จากสมาชิก', tdRight(`${baht(summary.totalCollected)} บาท`)],
    ['เงินสะสมของผู้เสียชีวิต (ปิดบัญชีทั้งจำนวน)', tdRight(`${baht(summary.deceasedOwnSavings)} บาท`)],
    [
      { text: 'ยอดเงินที่ทายาทผู้เสียชีวิตได้รับ', bold: true },
      { text: `${baht(summary.totalPayout)} บาท`, alignment: 'right', bold: true },
    ],
    ['ยอดที่ยังค้างชำระ', tdRight(`${baht(summary.totalShortfall)} บาท`)],
  ];

  // แยกให้เห็นว่าการเสียชีวิตครั้งนี้แต่ละหมู่บ้านจ่ายไปเท่าไร
  // (แถวสุดท้ายคือผลรวม ซึ่งต้องเท่ากับยอดที่ทายาทได้รับในหัวข้อ 2)
  const villageRows: TableCell[][] = detail.villageBreakdown.map((row, index) => [
    tdRight(String(index + 1)),
    row.moo ? `หมู่ ${row.moo}` : '-',
    row.villageName ?? 'ไม่ระบุหมู่บ้าน',
    tdRight(row.memberCount.toLocaleString('th-TH')),
    tdRight(row.paidInFullCount.toLocaleString('th-TH')),
    tdRight(baht(row.totalPaid)),
    tdRight(baht(row.totalShortfall)),
  ]);

  if (villageRows.length) {
    villageRows.push([
      { text: 'รวม', colSpan: 3, bold: true },
      {},
      {},
      { text: summary.chargedMemberCount.toLocaleString('th-TH'), alignment: 'right', bold: true },
      { text: summary.paidInFullCount.toLocaleString('th-TH'), alignment: 'right', bold: true },
      { text: baht(summary.totalCollected), alignment: 'right', bold: true },
      { text: baht(summary.totalShortfall), alignment: 'right', bold: true },
    ]);
  }

  const contributionRows: TableCell[][] = detail.contributions.map((row, index) => [
    tdRight(String(index + 1)),
    row.memberCode,
    row.fullName,
    row.moo ? `หมู่ ${row.moo}` : '-',
    tdRight(baht(row.totalPaid)),
    tdRight(baht(row.shortfall)),
    CONTRIBUTION_STATUS_LABELS[row.status],
  ]);

  return baseDoc(CASE_REPORT_TITLE, options.preparedBy, generatedAt, [
    sectionTitle('1. ข้อมูลสมาชิกผู้เสียชีวิต'),
    reportTable([th('รายการ'), th('ข้อมูล')], deceasedRows, [150, '*']),

    sectionTitle('2. สรุปเงินฌาปนกิจสงเคราะห์'),
    reportTable([th('รายการ'), th('จำนวน')], summaryRows, ['*', 140]),

    sectionTitle('3. เงินสมทบแยกตามหมู่บ้าน'),
    villageRows.length
      ? reportTable(
          [
            th('ลำดับ'),
            th('หมู่'),
            th('ชื่อหมู่บ้าน'),
            th('ผู้จ่ายสมทบ (คน)'),
            th('จ่ายครบ (คน)'),
            th('จ่ายแล้ว (บาท)'),
            th('ค้างชำระ (บาท)'),
          ],
          villageRows,
          [34, 42, '*', 76, 68, 76, 76],
        )
      : { text: 'ยังไม่มีรายการเรียกเก็บเงินสมทบ', margin: [0, 6, 0, 0], color: '#8a958e' },

    sectionTitle(`4. รายชื่อสมาชิกที่จ่ายเงินสมทบ (${detail.contributions.length} คน)`),
    contributionRows.length
      ? reportTable(
          [
            th('ลำดับ'),
            th('รหัส'),
            th('ชื่อ-นามสกุล'),
            th('หมู่'),
            th('จ่ายแล้ว'),
            th('ค้างชำระ'),
            th('สถานะ'),
          ],
          contributionRows,
          [34, 44, '*', 42, 62, 62, 72],
        )
      : { text: 'ยังไม่มีรายการเรียกเก็บเงินสมทบ', margin: [0, 6, 0, 0], color: '#8a958e' },

    {
      columns: [
        { text: '', width: '*' },
        {
          stack: [
            { text: 'ลงชื่อ ......................................................', margin: [0, 44, 0, 0] },
            { text: `( ${options.preparedBy} )`, alignment: 'center', margin: [0, 6, 0, 0] },
            { text: 'ผู้จัดทำรายงาน', alignment: 'center', margin: [0, 2, 0, 0] },
          ],
          width: 240,
        },
      ],
    },
  ]);
}

export function createFuneralCasePdf(detail: FuneralCaseDetail, options: { preparedBy: string }) {
  return pdfMake.createPdf(buildFuneralCaseDoc(detail, options));
}

// --- รายงานรวม (รายชื่อผู้เสียชีวิตทั้งหมดที่กรองอยู่) --------------------------------

export function buildFuneralListDoc(
  cases: FuneralCaseRow[],
  options: { preparedBy: string; rangeLabel: string },
): TDocumentDefinitions {
  const generatedAt = new Date();

  const rows: TableCell[][] = cases.map((row, index) => [
    tdRight(String(index + 1)),
    row.deceasedMember.memberCode,
    row.deceasedMember.fullName,
    row.deceasedMember.household?.moo ? `หมู่ ${row.deceasedMember.household.moo}` : '-',
    thaiDate(row.deathDate),
    tdRight(row.summary.chargedMemberCount.toLocaleString('th-TH')),
    tdRight(baht(row.summary.totalPayout)),
  ]);

  const totalReceived = cases.reduce((sum, row) => sum + row.summary.totalPayout, 0);

  return baseDoc(LIST_REPORT_TITLE, options.preparedBy, generatedAt, [
    metaCell('ช่วงข้อมูล', options.rangeLabel),
    metaCell('จำนวนผู้เสียชีวิต', `${cases.length.toLocaleString('th-TH')} ราย`),
    metaCell('ยอดเงินสงเคราะห์รวม', `${baht(totalReceived)} บาท`),

    rows.length
      ? reportTable(
          [
            th('ลำดับ'),
            th('รหัส'),
            th('ชื่อ-นามสกุล'),
            th('หมู่'),
            th('วันที่เสียชีวิต'),
            th('ผู้จ่ายสมทบ (คน)'),
            th('ยอดที่ได้รับ (บาท)'),
          ],
          rows,
          [34, 44, '*', 42, 90, 76, 82],
        )
      : { text: 'ไม่พบข้อมูลผู้เสียชีวิตตามเงื่อนไขที่เลือก', margin: [0, 10, 0, 0], color: '#8a958e' },
  ]);
}

export function createFuneralListPdf(
  cases: FuneralCaseRow[],
  options: { preparedBy: string; rangeLabel: string },
) {
  return pdfMake.createPdf(buildFuneralListDoc(cases, options));
}
