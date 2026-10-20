import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../utils/jwt.js';
import { logAction } from '../services/systemLogService.js';

// ---------------------------------------------------------------------------
// Route → Thai description mapping
// ---------------------------------------------------------------------------
// Each entry: [method, urlPattern (regex), module, action]
// urlPattern is tested against req.originalUrl (which starts with /api/…).

interface RouteMapping {
  method: string;          // HTTP method (POST, PUT, PATCH, DELETE)
  pattern: RegExp;         // regex to match the full path (e.g. /api/news)
  module: string;          // module label (Thai)
  action: string;          // action label (Thai)
  actionType: string;      // create | update | delete | status_change | transaction | system
}

const ROUTE_MAP: RouteMapping[] = [
  // ── Auth ──────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/auth\/login$/,                      module: 'ระบบ',          action: 'เข้าสู่ระบบ',                          actionType: 'login' },
  { method: 'POST',   pattern: /^\/api\/auth\/register$/,                   module: 'ระบบ',          action: 'สมัครสมาชิก',                          actionType: 'create' },
  { method: 'PATCH',  pattern: /^\/api\/auth\/me$/,                         module: 'ระบบ',          action: 'แก้ไขข้อมูลส่วนตัว',                   actionType: 'update' },
  { method: 'POST',   pattern: /^\/api\/auth\/me\/avatar$/,                 module: 'ระบบ',          action: 'อัปโหลดรูปโปรไฟล์',                    actionType: 'update' },
  { method: 'PATCH',  pattern: /^\/api\/auth\/password$/,                   module: 'ระบบ',          action: 'เปลี่ยนรหัสผ่าน',                      actionType: 'update' },

  // ── News ──────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/news$/,                             module: 'ข่าวสาร',       action: 'เพิ่มข่าวสาร',                         actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/news\/\d+$/,                        module: 'ข่าวสาร',       action: 'แก้ไขข่าวสาร',                         actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/news\/\d+$/,                        module: 'ข่าวสาร',       action: 'ลบข่าวสาร',                            actionType: 'delete' },

  // ── Banners ───────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/banners$/,                          module: 'แบนเนอร์',      action: 'เพิ่มแบนเนอร์',                        actionType: 'create' },
  { method: 'DELETE', pattern: /^\/api\/banners\/\d+$/,                     module: 'แบนเนอร์',      action: 'ลบแบนเนอร์',                           actionType: 'delete' },

  // ── Videos ────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/videos$/,                           module: 'วิดีโอคัดแยกขยะ', action: 'เพิ่มวิดีโอคัดแยกขยะ',                 actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/videos\/\d+$/,                      module: 'วิดีโอคัดแยกขยะ', action: 'แก้ไขวิดีโอคัดแยกขยะ',                 actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/videos\/\d+$/,                      module: 'วิดีโอคัดแยกขยะ', action: 'ลบวิดีโอคัดแยกขยะ',                    actionType: 'delete' },

  // ── Waste Types ───────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/waste-types$/,                      module: 'ประเภทขยะ',     action: 'เพิ่มประเภทขยะ',                       actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/waste-types\/\d+$/,                 module: 'ประเภทขยะ',     action: 'แก้ไขประเภทขยะ',                       actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/waste-types\/\d+$/,                 module: 'ประเภทขยะ',     action: 'ลบประเภทขยะ',                          actionType: 'delete' },
  { method: 'POST',   pattern: /^\/api\/waste-types\/proposals$/,           module: 'ประเภทขยะ',     action: 'ผู้รับซื้อเสนอเพิ่มประเภทขยะ',            actionType: 'create' },
  { method: 'POST',   pattern: /^\/api\/waste-types\/proposals\/\d+\/approve$/, module: 'ประเภทขยะ', action: 'อนุมัติประเภทขยะที่เสนอ',                actionType: 'status_change' },
  { method: 'POST',   pattern: /^\/api\/waste-types\/proposals\/\d+\/reject$/,  module: 'ประเภทขยะ', action: 'ไม่อนุมัติประเภทขยะที่เสนอ',             actionType: 'status_change' },

  // ── Member (self) ─────────────────────────────────────────────────────
  { method: 'PATCH',  pattern: /^\/api\/member\/profile$/,                  module: 'สมาชิก',        action: 'แก้ไขโปรไฟล์สมาชิก',                   actionType: 'update' },

  // ── Sell Requests (member) ────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/sell-requests$/,                    module: 'แจ้งขายขยะ',    action: 'สร้างคำขอขายขยะ',                      actionType: 'create' },
  { method: 'PATCH',  pattern: /^\/api\/sell-requests\/\d+\/cancel$/,       module: 'แจ้งขายขยะ',    action: 'ยกเลิกคำขอขายขยะ',                     actionType: 'status_change' },

  // ── Committee: Members ────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/committee\/members$/,               module: 'จัดการสมาชิก',  action: 'เพิ่มสมาชิกใหม่',                      actionType: 'create' },
  { method: 'PATCH',  pattern: /^\/api\/committee\/members\/\d+$/,          module: 'จัดการสมาชิก',  action: 'แก้ไขข้อมูลสมาชิก',                    actionType: 'update' },
  { method: 'POST',   pattern: /^\/api\/committee\/members\/\d+\/documents$/, module: 'จัดการสมาชิก', action: 'อัปโหลดเอกสารสมาชิก',                actionType: 'create' },
  { method: 'POST',   pattern: /^\/api\/committee\/members\/\d+\/verification$/, module: 'จัดการสมาชิก', action: 'ตรวจสอบคุณสมบัติสมาชิก',          actionType: 'status_change' },
  { method: 'PATCH',  pattern: /^\/api\/committee\/members\/\d+\/approve$/,     module: 'จัดการสมาชิก', action: 'อนุมัติสมาชิก',                    actionType: 'status_change' },
  { method: 'PATCH',  pattern: /^\/api\/committee\/members\/\d+\/cancel$/,      module: 'จัดการสมาชิก', action: 'ยกเลิกสมาชิก',                     actionType: 'status_change' },
  { method: 'PATCH',  pattern: /^\/api\/committee\/members\/\d+\/deceased$/,    module: 'จัดการสมาชิก', action: 'แจ้งสมาชิกเสียชีวิต (รอเทศบาลอนุมัติ)',           actionType: 'create' },
  { method: 'POST',   pattern: /^\/api\/municipality\/funeral-cases\/\d+\/approve$/, module: 'รายงานการเสียชีวิต', action: 'อนุมัติการแจ้งเสียชีวิตและหักเงินสะสม', actionType: 'status_change' },

  // ── Committee: Sell Requests ──────────────────────────────────────────
  { method: 'PATCH',  pattern: /^\/api\/committee\/sell-requests\/\d+\/confirm$/, module: 'รับซื้อขยะ', action: 'ยืนยันคำขอขายขยะ',                actionType: 'status_change' },
  { method: 'PATCH',  pattern: /^\/api\/committee\/sell-requests\/\d+\/cancel$/,  module: 'รับซื้อขยะ', action: 'ปฏิเสธคำขอขายขยะ',                actionType: 'status_change' },
  { method: 'POST',   pattern: /^\/api\/committee\/sell-requests\/\d+\/purchase$/, module: 'รับซื้อขยะ', action: 'บันทึกการรับซื้อขยะ',             actionType: 'transaction' },

  // ── Pickup route plans (committee confirms -> buyer drives) ───────────
  { method: 'PATCH',  pattern: /^\/api\/committee\/route-plans\/\d+\/start$/,      module: 'แผนที่รับซื้อ', action: 'กำหนดจุดเริ่มต้นเส้นทางรับซื้อ',          actionType: 'update' },
  { method: 'PATCH',  pattern: /^\/api\/buyer\/route-plans\/\d+\/stops\/\d+$/,     module: 'แผนที่รับซื้อ', action: 'อัปเดตสถานะจุดรับซื้อ',                actionType: 'status_change' },

  // ── Admin: Users ──────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/users$/,                       module: 'ผู้ใช้งาน',    action: 'เพิ่มบัญชีผู้ใช้งาน',                  actionType: 'create' },
  { method: 'PATCH',  pattern: /^\/api\/admin\/users\/\d+$/,                  module: 'ผู้ใช้งาน',    action: 'แก้ไขบัญชีผู้ใช้งาน',                  actionType: 'update' },
  { method: 'PATCH',  pattern: /^\/api\/admin\/users\/\d+\/status$/,          module: 'ผู้ใช้งาน',    action: 'เปลี่ยนสถานะผู้ใช้งาน',                actionType: 'status_change' },
  { method: 'POST',   pattern: /^\/api\/admin\/users\/\d+\/reset-password$/,  module: 'ผู้ใช้งาน',    action: 'รีเซ็ตรหัสผ่านผู้ใช้งาน',              actionType: 'update' },

  // ── Admin: Master Data - Village Areas ────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/village-areas$/,        module: 'พื้นที่',     action: 'เพิ่มข้อมูลพื้นที่',                   actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/admin\/master-data\/village-areas\/\d+$/,   module: 'พื้นที่',     action: 'แก้ไขข้อมูลพื้นที่',                   actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/admin\/master-data\/village-areas\/\d+$/,   module: 'พื้นที่',     action: 'ลบข้อมูลพื้นที่',                     actionType: 'delete' },

  // ── Admin: Master Data - Buyers ───────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/buyers$/,               module: 'ผู้รับซื้อ',  action: 'เพิ่มผู้รับซื้อ',                     actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/admin\/master-data\/buyers\/\d+$/,          module: 'ผู้รับซื้อ',  action: 'แก้ไขผู้รับซื้อ',                     actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/admin\/master-data\/buyers\/\d+$/,          module: 'ผู้รับซื้อ',  action: 'ลบผู้รับซื้อ',                        actionType: 'delete' },

  // ── Admin: Master Data - Fund Accounts ────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/fund-accounts$/,        module: 'บัญชีกองทุน', action: 'เพิ่มบัญชีกองทุน',                    actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/admin\/master-data\/fund-accounts\/\d+$/,   module: 'บัญชีกองทุน', action: 'แก้ไขบัญชีกองทุน',                    actionType: 'update' },

  // ── Admin: Master Data - Roles ────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/roles$/,                module: 'บทบาทผู้ใช้', action: 'เพิ่มบทบาทผู้ใช้',                    actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/admin\/master-data\/roles\/\d+$/,           module: 'บทบาทผู้ใช้', action: 'แก้ไขบทบาทผู้ใช้',                    actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/admin\/master-data\/roles\/\d+$/,           module: 'บทบาทผู้ใช้', action: 'ลบบทบาทผู้ใช้',                      actionType: 'delete' },

  // ── Admin: Master Data - Settings ─────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/settings$/,             module: 'ตั้งค่าระบบ', action: 'บันทึกการตั้งค่าระบบ',                actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/admin\/master-data\/settings\/\d+$/,        module: 'ตั้งค่าระบบ', action: 'ลบการตั้งค่าระบบ',                    actionType: 'delete' },

  // ── Admin: Master Data - Waste Price History ──────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/waste-price-history$/,  module: 'ราคาขยะ',    action: 'เพิ่มประวัติราคาขยะ',                  actionType: 'create' },

  // ── Admin: Master Data - Member Types ─────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/master-data\/member-types$/,         module: 'ประเภทสมาชิก', action: 'เพิ่มประเภทสมาชิก',                 actionType: 'create' },
  { method: 'PUT',    pattern: /^\/api\/admin\/master-data\/member-types\/\d+$/,    module: 'ประเภทสมาชิก', action: 'แก้ไขประเภทสมาชิก',                 actionType: 'update' },
  { method: 'DELETE', pattern: /^\/api\/admin\/master-data\/member-types\/\d+$/,    module: 'ประเภทสมาชิก', action: 'ลบประเภทสมาชิก',                    actionType: 'delete' },

  // ── Admin: Backup & Restore ───────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/admin\/backup\/restore$/,                   module: 'สำรองข้อมูล', action: 'กู้คืนข้อมูลจากไฟล์สำรอง',            actionType: 'system' },

  // ── Notifications ─────────────────────────────────────────────────────
  { method: 'PATCH',  pattern: /^\/api\/notifications\/\d+\/read$/,                 module: 'แจ้งเตือน',   action: 'อ่านการแจ้งเตือน',                    actionType: 'update' },
];

// Paths to skip logging entirely (noisy / internal / read-only-ish)
const SKIP_PATTERNS = [
  /^\/api\/auth\/login$/,       // login is already tracked in LoginAudit table
  /^\/api\/auth\/register$/,    // registration is already tracked
  /^\/api\/notifications/,      // reading notifications is too noisy
];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
function extractTargetId(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

export function systemLogMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only log mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip noisy routes
  const path = req.originalUrl.split('?')[0]; // strip query string
  if (SKIP_PATTERNS.some((p) => p.test(path))) {
    return next();
  }

  // Find matching route
  const mapping = ROUTE_MAP.find((m) => m.method === req.method && m.pattern.test(path));
  if (!mapping) {
    return next(); // unmapped route = no log
  }

  // Extract user from JWT (if available)
  let userId: number | null = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAuthToken(header.slice(7));
      userId = payload.userId;
    } catch {
      // token invalid = no user, still log the action
    }
  }

  // Log AFTER the response is sent (so we capture success/failure)
  const originalEnd = res.end;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.end = function (this: Response, ...args: any[]) {
    // Determine status from HTTP response code
    const logStatus = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'error';

    // Fire and forget - never block the response
    void logAction({
      userId,
      actionType: mapping.actionType,
      module: mapping.module,
      action: mapping.action,
      detail: logStatus === 'error' ? `HTTP ${res.statusCode}` : null,
      targetId: extractTargetId(path),
      ipAddress: (req.ip || req.socket.remoteAddress) ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      status: logStatus,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return originalEnd.apply(this, args as any);
  } as typeof res.end;

  next();
}
