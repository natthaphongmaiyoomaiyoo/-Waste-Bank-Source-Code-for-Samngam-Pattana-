import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/', // หน้าแรกสุด (ข่าวสาร)
    component: () => import('pages/public/FristPage.vue'),
  },
  {
    path: '/news', // ดูข่าวทั้งหมด
    component: () => import('pages/public/NewsListPage.vue'),
  },
  {
    path: '/news/:id',
    component: () => import('pages/public/NewsDetailPage.vue'),
  },
  {
    path: '/videos', // ดูวิดีโอทั้งหมด
    component: () => import('pages/public/VideoListPage.vue'),
  },
  // Keep old bookmarks working without retaining a separate login page.
  { path: '/login', redirect: '/?login=1' },
  {
    path: '/forgot-password',
    component: () => import('layouts/LoginLayout.vue'),
    children: [{ path: '', component: () => import('pages/auth/ForgotPasswordPage.vue') }],
  },
  {
    path: '/change-password',
    component: () => import('layouts/LoginLayout.vue'),
    children: [{ path: '', component: () => import('pages/auth/ChangePasswordPage.vue') }],
  },
  {
    path: '/apply-member',
    component: () => import('pages/public/MemberApplyPage.vue'),
  },
  {
    path: '/mid-components',
    component: () => import('pages/shared/MIDShowcasePage.vue'),
  },

  {
    path: '/system-layout', // 🌟 แก้ที่ 1: เปลี่ยนจาก '/' เป็นชื่ออื่นเพื่อไม่ให้ซ้ำกับหน้าแรก
    component: () => import('layouts/MainLayout.vue'),
    children: [
      // --- SHARED (any authenticated role) ---
      {
        path: '/profile',
        component: () => import('pages/shared/ProfilePage.vue'),
      },

      // --- ADMIN ROUTES ---
      // 🌟 แก้ที่ 2: เติม '/' นำหน้า path ลูกทุกตัว เพื่อให้ URL เป็น /admin (ไม่ใช่ /system-layout/admin)
      {
        path: '/admin',
        component: () => import('pages/admin/IndexPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/manage-news',
        component: () => import('pages/admin/ManageNewPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/manage-videos',
        component: () => import('pages/admin/ManageVideoPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/manage-banners',
        component: () => import('pages/admin/ManageBannerPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/members',
        component: () => import('pages/admin/AdminMembersPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/members/:id/deceased',
        component: () => import('pages/committee/CommitteeMemberDeceasedPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/rounds',
        component: () => import('pages/admin/AdminRoundsPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/reports',
        component: () => import('pages/admin/ReportPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/schedule',
        component: () => import('pages/admin/SchedulePage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/buyers',
        component: () => import('pages/admin/BuyerManagementPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/master-data',
        component: () => import('pages/admin/MasterDataPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/waste-types',
        component: () => import('pages/admin/WasteTypesPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/village',
        component: () => import('pages/admin/VillagePage.vue'),
        meta: { role: ['admin'] },
      },
      {
        // Village committees are bound to the villages added on /village above.
        path: '/admin/committees',
        component: () => import('pages/admin/CommitteeManagementPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        // Add / edit share one full-page form (route order: /new before /:id).
        path: '/admin/committees/new',
        component: () => import('pages/admin/CommitteeFormPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/committees/:id/edit',
        component: () => import('pages/admin/CommitteeFormPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/users',
        component: () => import('pages/admin/UserManagementPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/users/new',
        component: () => import('pages/admin/AdminAddUserPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/add-member',
        component: () => import('pages/admin/AdminAddMemberPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/member-types',
        component: () => import('pages/admin/MemberTypesPage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/backup',
        component: () => import('pages/admin/BackupRestorePage.vue'),
        meta: { role: ['admin'] },
      },
      {
        path: '/admin/logs',
        component: () => import('pages/admin/SystemLogsPage.vue'),
        meta: { role: ['admin'] },
      },

      // --- MUNICIPALITY ROUTES (read-only monitoring/reporting) ---
      {
        path: '/municipality',
        component: () => import('pages/municipality/MunicipalityDashboardPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/members',
        component: () => import('pages/municipality/MunicipalityMembersPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/members/:id',
        component: () => import('pages/municipality/MunicipalityMemberDetailPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/operations',
        component: () => import('pages/municipality/MunicipalityOperationsPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/fund',
        component: () => import('pages/municipality/MunicipalityFundPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/reports',
        component: () => import('pages/municipality/MunicipalityReportsPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        // รายงานการเสียชีวิต: รายชื่อผู้เสียชีวิต -> สรุปเงินฌาปนกิจรายคน -> PDF
        path: '/municipality/funeral',
        component: () => import('pages/municipality/MunicipalityFuneralPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/funeral/:id',
        component: () => import('pages/municipality/MunicipalityFuneralDetailPage.vue'),
        meta: { role: ['municipality'] },
      },
      {
        path: '/municipality/pdf-report',
        component: () => import('pages/municipality/MunicipalityPdfReportPage.vue'),
        meta: { role: ['municipality'] },
      },

      // --- COMMITTEE ROUTES (member management for the Waste Bank Committee) ---
      {
        // Landing page: savings totals, this month's stats, the current round and
        // everything waiting for the committee.
        path: '/committee',
        component: () => import('pages/committee/CommitteeDashboardPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/members',
        component: () => import('pages/committee/CommitteeMembersPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/members/:id/deceased',
        component: () => import('pages/committee/CommitteeMemberDeceasedPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/add-member',
        component: () => import('pages/committee/CommitteeAddMemberPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        // Buying rounds this committee opens for its own village.
        path: '/committee/rounds',
        component: () => import('pages/committee/CommitteeRoundsPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/sell-requests',
        component: () => import('pages/committee/CommitteeRoundTimelinePage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/sell-requests/round/:roundId',
        component: () => import('pages/committee/CommitteeSellRequestsPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/sell-requests/:id',
        component: () => import('pages/committee/CommitteeSellRequestDetailPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        // Pick the round first (same shape as the sell-request flow), then plan it.
        path: '/committee/route-plan',
        component: () => import('pages/committee/CommitteeRoutePlanRoundsPage.vue'),
        meta: { role: ['committee'] },
      },
      {
        path: '/committee/route-plan/round/:roundId',
        component: () => import('pages/committee/CommitteeRoutePlanPage.vue'),
        meta: { role: ['committee'] },
      },

      // --- BUYER ROUTES (waste buyer / ผู้รับซื้อขยะ) ---
      {
        // Pickup runs the village committee confirmed and handed to this shop.
        path: '/buyer/route-plan',
        component: () => import('pages/buyer/BuyerRoutePlanPage.vue'),
        meta: { role: ['buyer'] },
      },
      {
        // Read the approved catalog + propose new types (admin approves before
        // members see them).
        path: '/buyer/waste-types',
        component: () => import('pages/buyer/BuyerWasteTypesPage.vue'),
        meta: { role: ['buyer'] },
      },

      // --- USER ROUTES ---
      {
        path: '/dashboard',
        component: () => import('pages/user/DashboardPage.vue'),
        meta: { role: ['user'] },
      },
      {
        path: '/sell-request',
        component: () => import('pages/user/SellRequestPage.vue'),
        meta: { role: ['user'] },
      },
      {
        path: '/sell-request-history',
        component: () => import('pages/user/SellRequestHistoryPage.vue'),
        meta: { role: ['user'] },
      },
      {
        path: '/schedule',
        component: () => import('pages/user/SchedulePage.vue'),
        meta: { role: ['user'] },
      },
      {
        path: '/history',
        component: () => import('pages/user/HistoryPage.vue'),
        meta: { role: ['user'] },
      },
    ],
  },

  // โซน Error 404
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/shared/ErrorNotFound.vue'),
  },
];

export default routes;
