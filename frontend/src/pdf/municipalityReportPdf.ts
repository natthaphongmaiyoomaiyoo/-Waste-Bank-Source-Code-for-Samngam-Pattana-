// สร้างเอกสาร PDF รายงานธนาคารขยะสำหรับเจ้าหน้าที่เทศบาล (pdfmake + ฟอนต์ TH Sarabun PSK
// ฝังในตัว จึงแสดงภาษาไทยถูกต้องเสมอ) - ข้อมูลทั้งหมดมาจาก GET /municipality/reports/pdf-data
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { sarabunVfs } from './sarabunVfs';

pdfMake.vfs = sarabunVfs;
pdfMake.fonts = {
  'TH Sarabun PSK': {
    normal: 'Sarabun-Regular.ttf',
    bold: 'Sarabun-Bold.ttf',
    italics: 'Sarabun-Regular.ttf',
    bolditalics: 'Sarabun-Bold.ttf',
  },
};

// ปรับชื่อหน่วยงาน/องค์กรได้ที่เดียวตรงนี้
export const ORGANIZATION_NAME = 'ธนาคารขยะรีไซเคิลเทศบาลสามง่ามพัฒนา';
export const ORGANIZATION_SUB = 'รายงานกำกับดูแลโดยเจ้าหน้าที่เทศบาล';

// --- ชนิดข้อมูลจาก backend ---------------------------------------------------

export interface PdfReportData {
  generatedAt: string;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    moo: string | null;
    villageLabel: string | null;
  };
  villageOptions: { moo: string; label: string }[];
  overview: {
    memberCount: number;
    activeMemberCount: number;
    villageCount: number;
    totalQuantity: number;
    totalAmount: number;
    totalFundDeduct: number;
    completedSaleCount: number;
  };
  purchasesByRound: {
    roundDate: string;
    area: string;
    saleCount: number;
    quantity: number;
    amount: number;
  }[];
  byWasteType: {
    wasteName: string;
    unit: string;
    quantity: number;
    amount: number;
    avgPrice: number;
  }[];
  byVillage: {
    village: string;
    sellerCount: number;
    quantity: number;
    amount: number;
    fundDeduct: number;
  }[];
  requestStatus: {
    total: number;
    requested: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
}

export type ReportType = 'overview' | 'purchases' | 'wasteTypes' | 'villages' | 'requests';

export const REPORT_TITLES: Record<ReportType, string> = {
  overview: 'รายงานสรุปภาพรวมธนาคารขยะ',
  purchases: 'รายงานการรับซื้อขยะตามช่วงเวลา',
  wasteTypes: 'รายงานการรับซื้อแยกตามประเภทขยะ',
  villages: 'รายงานการรับซื้อแยกตามหมู่บ้าน/พื้นที่',
  requests: 'รายงานสถานะคำขอขายขยะ',
};

// --- ตัวช่วยจัดรูปแบบ ---------------------------------------------------------

const GREEN_DARK = '#0b4f36';
const GREEN = '#159757';
const GREY_LINE = '#c9d6cd';
const ZEBRA = '#f2f7f3';

function baht(value: number): string {
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(value: number): string {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
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

function rangeText(filters: PdfReportData['filters']): string {
  if (filters.dateFrom && filters.dateTo) {
    return `${thaiDate(filters.dateFrom)} ถึง ${thaiDate(filters.dateTo)}`;
  }
  if (filters.dateFrom) return `ตั้งแต่ ${thaiDate(filters.dateFrom)}`;
  if (filters.dateTo) return `จนถึง ${thaiDate(filters.dateTo)}`;
  return 'ข้อมูลสะสมทั้งหมด';
}

function th(text: string): TableCell {
  return { text, style: 'th' };
}

function tdRight(text: string): TableCell {
  return { text, alignment: 'right' };
}

function reportTable(headerRow: TableCell[], rows: TableCell[][], widths: (string | number)[]): Content {
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

function summaryLine(label: string, value: string): Content {
  return {
    columns: [
      { text: label, bold: true, width: '*' },
      { text: value, bold: true, alignment: 'right', width: 'auto', color: GREEN_DARK },
    ],
    margin: [0, 2, 0, 0],
  };
}

// --- ส่วนหัว/ท้ายเอกสาร --------------------------------------------------------

function documentHeader(
  type: ReportType,
  data: PdfReportData,
  preparedBy: string,
  logoDataUrl?: string,
): Content[] {
  const headerColumns: Content = {
    columns: [
      ...(logoDataUrl ? [{ image: logoDataUrl, width: 46, height: 46 } as Content] : []),
      {
        stack: [
          { text: ORGANIZATION_NAME, fontSize: 15, bold: true, color: GREEN_DARK },
          { text: ORGANIZATION_SUB, fontSize: 10, color: '#5f6f66', margin: [0, 2, 0, 0] },
        ],
        margin: [logoDataUrl ? 10 : 0, 4, 0, 0],
      },
    ],
  };

  const metaCell = (label: string, value: string): Content => ({
    columns: [
      { text: label, width: 92, color: '#5f6f66' },
      { text: value, width: '*', bold: true },
    ],
    margin: [0, 1, 0, 1],
  });

  return [
    headerColumns,
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.2, lineColor: GREEN }],
      margin: [0, 8, 0, 10],
    },
    { text: REPORT_TITLES[type], fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 8] },
    metaCell('ช่วงข้อมูล', rangeText(data.filters)),
    metaCell('พื้นที่', data.filters.villageLabel ?? 'ทุกหมู่บ้าน/พื้นที่'),
    metaCell('วันที่ออกรายงาน', thaiDateTime(data.generatedAt)),
    metaCell('ผู้จัดทำ', preparedBy),
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: GREY_LINE }],
      margin: [0, 8, 0, 4],
    },
  ];
}

// --- เนื้อหาแต่ละรายงาน ---------------------------------------------------------

function overviewContent(data: PdfReportData): Content[] {
  const o = data.overview;
  const rows: TableCell[][] = [
    ['จำนวนสมาชิกทั้งหมด', tdRight(`${o.memberCount.toLocaleString('th-TH')} คน`)],
    ['สมาชิกสถานะใช้งาน (active)', tdRight(`${o.activeMemberCount.toLocaleString('th-TH')} คน`)],
    ['จำนวนหมู่บ้าน/ชุมชน', tdRight(`${o.villageCount.toLocaleString('th-TH')} หมู่บ้าน`)],
    ['จำนวนครั้งที่รับซื้อสำเร็จ', tdRight(`${o.completedSaleCount.toLocaleString('th-TH')} ครั้ง`)],
    ['ปริมาณขยะรวม', tdRight(`${qty(o.totalQuantity)} กก.`)],
    ['ยอดเงินรับซื้อรวม', tdRight(`${baht(o.totalAmount)} บาท`)],
    ['เติมเงินสะสมขั้นต่ำรวม', tdRight(`${baht(o.totalFundDeduct)} บาท`)],
  ];
  return [
    reportTable([th('รายการ'), th('ค่า')], rows, ['*', 180]),
    { text: ' ', margin: [0, 4, 0, 0] },
    summaryLine('สรุป: มูลค่ารับซื้อรวมทั้งสิ้น', `${baht(o.totalAmount)} บาท`),
    summaryLine('เติมเงินสะสมขั้นต่ำรวม', `${baht(o.totalFundDeduct)} บาท`),
  ];
}

function purchasesContent(data: PdfReportData): Content[] {
  const rows: TableCell[][] = data.purchasesByRound.map((r) => [
    thaiDate(r.roundDate),
    r.area,
    tdRight(r.saleCount.toLocaleString('th-TH')),
    tdRight(qty(r.quantity)),
    tdRight(baht(r.amount)),
  ]);
  const totals = data.purchasesByRound.reduce(
    (acc, r) => ({
      saleCount: acc.saleCount + r.saleCount,
      quantity: acc.quantity + r.quantity,
      amount: acc.amount + r.amount,
    }),
    { saleCount: 0, quantity: 0, amount: 0 },
  );
  if (!rows.length) rows.push([{ text: 'ไม่มีข้อมูลในช่วงที่เลือก', colSpan: 5, alignment: 'center' }, '', '', '', '']);
  return [
    reportTable(
      [th('วันที่รับซื้อ'), th('พื้นที่/หมู่บ้าน'), th('จำนวนรายการ'), th('น้ำหนักรวม (กก.)'), th('มูลค่ารวม (บาท)')],
      rows,
      [90, '*', 70, 90, 95],
    ),
    { text: ' ', margin: [0, 4, 0, 0] },
    summaryLine('รวมจำนวนรายการรับซื้อ', `${totals.saleCount.toLocaleString('th-TH')} รายการ`),
    summaryLine('รวมน้ำหนัก', `${qty(totals.quantity)} กก.`),
    summaryLine('รวมมูลค่ารับซื้อ', `${baht(totals.amount)} บาท`),
  ];
}

function wasteTypesContent(data: PdfReportData): Content[] {
  const rows: TableCell[][] = data.byWasteType.map((r) => [
    r.wasteName,
    tdRight(qty(r.quantity)),
    tdRight(baht(r.avgPrice)),
    tdRight(baht(r.amount)),
  ]);
  const totalQ = data.byWasteType.reduce((s, r) => s + r.quantity, 0);
  const totalA = data.byWasteType.reduce((s, r) => s + r.amount, 0);
  if (!rows.length) rows.push([{ text: 'ไม่มีข้อมูลในช่วงที่เลือก', colSpan: 4, alignment: 'center' }, '', '', '']);
  return [
    { text: 'เรียงลำดับจากปริมาณ (น้ำหนัก) มากไปน้อย', fontSize: 9, color: '#5f6f66', margin: [0, 2, 0, 0] },
    reportTable(
      [th('ประเภทขยะ'), th('น้ำหนักรวม (กก.)'), th('ราคาเฉลี่ย (บาท/กก.)'), th('มูลค่ารวม (บาท)')],
      rows,
      ['*', 95, 110, 105],
    ),
    { text: ' ', margin: [0, 4, 0, 0] },
    summaryLine('รวมน้ำหนักทุกประเภท', `${qty(totalQ)} กก.`),
    summaryLine('รวมมูลค่าทุกประเภท', `${baht(totalA)} บาท`),
  ];
}

function villagesContent(data: PdfReportData): Content[] {
  const rows: TableCell[][] = data.byVillage.map((r) => [
    r.village,
    tdRight(r.sellerCount.toLocaleString('th-TH')),
    tdRight(qty(r.quantity)),
    tdRight(baht(r.amount)),
    tdRight(baht(r.fundDeduct)),
  ]);
  const totals = data.byVillage.reduce(
    (acc, r) => ({
      sellers: acc.sellers + r.sellerCount,
      quantity: acc.quantity + r.quantity,
      amount: acc.amount + r.amount,
      fund: acc.fund + r.fundDeduct,
    }),
    { sellers: 0, quantity: 0, amount: 0, fund: 0 },
  );
  if (!rows.length) rows.push([{ text: 'ไม่มีข้อมูลในช่วงที่เลือก', colSpan: 5, alignment: 'center' }, '', '', '', '']);
  return [
    { text: 'เรียงลำดับจากมูลค่ารับซื้อมากไปน้อย', fontSize: 9, color: '#5f6f66', margin: [0, 2, 0, 0] },
    reportTable(
      [
        th('หมู่บ้าน/พื้นที่'),
        th('สมาชิกที่มีการขาย'),
        th('น้ำหนักรวม (กก.)'),
        th('มูลค่ารวม (บาท)'),
        th('เติมเงินสะสมรวม (บาท)'),
      ],
      rows,
      ['*', 75, 85, 90, 95],
    ),
    { text: ' ', margin: [0, 4, 0, 0] },
    summaryLine('รวมน้ำหนักทุกพื้นที่', `${qty(totals.quantity)} กก.`),
    summaryLine('รวมมูลค่ารับซื้อทุกพื้นที่', `${baht(totals.amount)} บาท`),
    summaryLine('รวมเติมเงินสะสมทุกพื้นที่', `${baht(totals.fund)} บาท`),
  ];
}

function requestsContent(data: PdfReportData): Content[] {
  const s = data.requestStatus;
  const items = [
    { label: 'รอรับเรื่อง', value: s.requested },
    { label: 'กรรมการกำลังไปรับ', value: s.confirmed },
    { label: 'รับซื้อแล้ว', value: s.completed },
    { label: 'ยกเลิกแล้ว', value: s.cancelled },
  ];
  const rows: TableCell[][] = items.map((i) => [
    i.label,
    tdRight(i.value.toLocaleString('th-TH')),
    tdRight(s.total > 0 ? `${((i.value / s.total) * 100).toFixed(1)}%` : '-'),
  ]);
  return [
    reportTable([th('สถานะคำขอ'), th('จำนวน (คำขอ)'), th('สัดส่วน')], rows, ['*', 100, 90]),
    { text: ' ', margin: [0, 4, 0, 0] },
    summaryLine('จำนวนคำขอทั้งหมด', `${s.total.toLocaleString('th-TH')} คำขอ`),
  ];
}

const CONTENT_BUILDERS: Record<ReportType, (data: PdfReportData) => Content[]> = {
  overview: overviewContent,
  purchases: purchasesContent,
  wasteTypes: wasteTypesContent,
  villages: villagesContent,
  requests: requestsContent,
};

// --- ประกอบเอกสาร ------------------------------------------------------------

export function buildReportDoc(
  type: ReportType,
  data: PdfReportData,
  options: { preparedBy: string; logoDataUrl?: string | undefined },
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 36, 40, 46],
    defaultStyle: { font: 'TH Sarabun PSK', fontSize: 10.5, lineHeight: 1.15 },
    styles: {
      th: { bold: true, color: '#ffffff', fontSize: 10 },
    },
    info: { title: REPORT_TITLES[type], author: options.preparedBy },
    content: [
      ...documentHeader(type, data, options.preparedBy, options.logoDataUrl),
      ...CONTENT_BUILDERS[type](data),
    ],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `ออกรายงานเมื่อ ${thaiDateTime(data.generatedAt)}`, fontSize: 8, color: '#8a958e' },
        {
          text: `หน้า ${currentPage} / ${pageCount}`,
          fontSize: 8,
          color: '#8a958e',
          alignment: 'right',
        },
      ],
      margin: [40, 14, 40, 0],
    }),
  };
}

export function createReportPdf(
  type: ReportType,
  data: PdfReportData,
  options: { preparedBy: string; logoDataUrl?: string | undefined },
) {
  return pdfMake.createPdf(buildReportDoc(type, data, options));
}
