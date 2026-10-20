<template>
  <q-layout view="lHh Lpr lFf" class="app-shell" :class="{ 'is-admin': isAdmin }">
    <!-- Ambient Animated Glow Background for Admin -->
    <AdminAmbientBackground v-if="isAdmin" />

    <q-header class="app-header" flat>
      <q-toolbar class="app-toolbar">
        <!-- Members, committee and municipality have no side menu - their home page's tiles
             replace it - so their other pages get a way back home where the menu
             toggle would have been. -->
        <q-btn
          v-if="hasDrawer"
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          class="menu-toggle"
          @click="toggleLeftDrawer"
        />
        <q-btn
          v-else-if="showsHomeLink"
          flat
          dense
          round
          icon="arrow_back"
          aria-label="กลับหน้าหลัก"
          class="menu-toggle"
          :to="homeLink"
        />
        <!-- The title flexes into all free space itself; a q-space here would take
             half of it and cut long titles like "ประวัติและเงินสะสม" on phones.
             Beside the back arrow it is that arrow's label, and taps through to
             the same page. -->
        <q-toolbar-title class="page-title">
          <router-link v-if="showsHomeLink" :to="homeLink" class="home-link">
            {{ toolbarTitle }}
          </router-link>
          <template v-else>{{ toolbarTitle }}</template>
        </q-toolbar-title>
        <NotificationBell v-if="role === 'user'" />
        <q-avatar class="header-avatar" size="34px">
          <img v-if="avatarUrl" :src="avatarUrl" alt="รูปโปรไฟล์" />
          <template v-else>{{ avatarLetter }}</template>
          <q-tooltip>บัญชีผู้ใช้</q-tooltip>

          <q-menu anchor="bottom right" self="top right" class="account-menu">
            <q-list class="account-menu-list">
              <div class="account-menu-header">
                <div class="account-menu-name">
                  {{ authStore.user?.fullName || roleDisplayName }}
                </div>
                <div class="account-menu-role">{{ roleDisplayName }}</div>
              </div>
              <q-separator />
              <q-item clickable v-close-popup @click="goToProfile">
                <q-item-section avatar>
                  <q-icon name="person" />
                </q-item-section>
                <q-item-section>ดูโปรไฟล์</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="logout">
                <q-item-section avatar>
                  <q-icon name="logout" color="negative" />
                </q-item-section>
                <q-item-section class="text-negative">ออกจากระบบ</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-avatar>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-if="hasDrawer"
      v-model="leftDrawerOpen"
      :show-if-above="role === 'admin'"
      :behavior="(role === 'admin' && $q.screen.gt.sm) ? 'default' : 'mobile'"
      no-swipe-backdrop
      :persistent="role === 'admin' && $q.screen.gt.sm"
      :class="['app-sidebar', { 'is-mini-drawer': drawerMini && $q.screen.gt.sm }]"
      :width="280"
      :mini-width="78"
      :mini="drawerMini && $q.screen.gt.sm"
    >
      <div class="sidebar-card" :class="{ 'is-mini-sidebar': drawerMini && $q.screen.gt.sm }">
        <div class="brand-row">
          <div class="brand-mark">
            <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" />
          </div>
          <div class="brand-text">
            <div class="brand-name">กองทุนธนาคารขยะเพื่อชุมชน</div>
            <div class="brand-subtitle">{{ roleDisplayName }}</div>
          </div>
        </div>

        <div class="sidebar-scroll">
          <div v-for="section in menuSections" :key="section.label" class="menu-section">
            <div class="section-label">{{ section.label }}</div>

            <q-list class="menu-list">
              <q-item
                v-for="menu in section.items"
                :key="menu.title"
                clickable
                v-ripple
                :to="menu.link"
                :active="isMenuActive(menu.link)"
                active-class="active-menu-item"
                class="sidebar-item"
              >
                <q-item-section avatar class="menu-icon-section">
                  <q-icon :name="menu.icon" />
                </q-item-section>

                <q-item-section class="menu-text-section">
                  <q-item-label>{{ menu.title }}</q-item-label>
                </q-item-section>

                <q-tooltip
                  v-if="drawerMini && $q.screen.gt.sm"
                  anchor="center right"
                  self="center left"
                >
                  {{ menu.title }}
                </q-tooltip>
              </q-item>
            </q-list>
          </div>
        </div>

        <div class="profile-row" @click="goToProfile">
          <q-avatar class="profile-avatar" size="36px">
            <img v-if="avatarUrl" :src="avatarUrl" alt="รูปโปรไฟล์" />
            <template v-else>{{ avatarLetter }}</template>
          </q-avatar>
          <div class="profile-copy">
            <div class="profile-name">{{ roleDisplayName }}</div>
            <div class="profile-role">{{ roleLabel }}</div>
          </div>
          <q-btn flat dense round icon="logout" class="logout-btn" @click.stop="logout">
            <q-tooltip>ออกจากระบบ</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-drawer>

    <q-page-container class="app-page-container" :class="{ 'admin-scale': role === 'admin' }">
      <router-view />
      <AppFooter />
    </q-page-container>

    <q-dialog
      v-model="showLogoutDialog"
      persistent
      transition-show="scale"
      transition-hide="fade"
      @show="focusLogoutConfirm"
    >
      <q-card class="logout-dialog-card" tabindex="0" @keydown.enter.prevent.stop="confirmLogout">
        <div class="logout-dialog-title">ออกจากระบบ</div>
        <div class="logout-dialog-message">ต้องการออกจากระบบหรือไม่?</div>

        <q-card-actions class="logout-dialog-actions">
          <q-btn flat no-caps label="ยกเลิก" class="logout-cancel-btn" @click="closeLogoutDialog" />
          <q-btn
            ref="logoutConfirmButton"
            unelevated
            no-caps
            label="ตกลง"
            icon-right="arrow_forward"
            class="logout-confirm-btn"
            @click="confirmLogout"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppFooter from 'components/AppFooter.vue';
import NotificationBell from 'components/NotificationBell.vue';
import AdminAmbientBackground from 'src/components/admin/AdminAmbientBackground.vue';
import { useAuthStore } from 'src/stores/authStore';
import { getAuthItem } from 'src/utils/authStorage';
import { useQuasar } from 'quasar';

interface MenuProps {
  title: string;
  icon: string;
  link: string;
}

interface MenuSection {
  label: string;
  items: MenuProps[];
}

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const $q = useQuasar();

const role = getAuthItem('role');
const isMember = role === 'user';
const isCommittee = role === 'committee';
const isMunicipality = role === 'municipality';
// Members, committee and municipality navigate from their home page's tiles
// instead; admin and buyer keep the side menu.
const hasDrawer = !isMember && !isCommittee && !isMunicipality;

const isAdmin = computed(() => {
  if (role === 'admin' || authStore.user?.roleName === 'admin') return true;
  return (
    route.path.startsWith('/admin') ||
    [
      '/manage-news',
      '/manage-banners',
      '/manage-videos',
      '/waste-types',
      '/village',
      '/reports',
    ].some((p) => route.path.startsWith(p))
  );
});

const leftDrawerOpen = ref(false);
const drawerMini = ref(false);
const showLogoutDialog = ref(false);
const logoutConfirmButton = ref<{ $el?: HTMLElement; focus?: () => void } | null>(null);

const adminMenu: MenuProps[] = [
  { title: 'แดชบอร์ด', icon: 'grid_view', link: '/admin' },
  { title: 'จัดการข่าวสาร', icon: 'edit_document', link: '/manage-news' },
  { title: 'จัดการแบนเนอร์', icon: 'view_carousel', link: '/manage-banners' },
  { title: 'จัดการวิดีโอ', icon: 'video_library', link: '/manage-videos' },
  // ซ่อน 4 เมนูนี้ไว้ก่อนชั่วคราวเพื่อนำไปปรึกษากับทีม
  // { title: 'สมาชิก', icon: 'person', link: '/members' },
  // { title: 'ตารางเก็บขยะ', icon: 'calendar_today', link: '/admin/schedule' },
  // { title: 'รายงาน', icon: 'bar_chart', link: '/reports' },
  { title: 'ประเภทขยะ', icon: 'local_shipping', link: '/waste-types' },
  { title: 'หมู่บ้าน', icon: 'add_home', link: '/village' },
  { title: 'กรรมการหมู่บ้าน', icon: 'groups', link: '/admin/committees' },
  { title: 'ผู้รับซื้อ', icon: 'storefront', link: '/admin/buyers' },
  { title: 'สมาชิก', icon: 'person', link: '/admin/members' },
  { title: 'รอบรับซื้อขยะ', icon: 'event_available', link: '/admin/rounds' },
];

const systemAdminMenu: MenuProps[] = [
  { title: 'ผู้ใช้งานระบบ', icon: 'manage_accounts', link: '/admin/users' },
  { title: 'ประเภทสมาชิก', icon: 'card_membership', link: '/admin/member-types' },
  // ซ่อนชั่วคราวเนื่องจากเปลี่ยนไปใช้ Supabase PostgreSQL
  // { title: 'สำรองข้อมูล', icon: 'backup', link: '/admin/backup' },
  { title: 'บันทึกระบบ', icon: 'security', link: '/admin/logs' },
];

// Members get no drawer - this list only names their pages in the header.
const userMenu: MenuProps[] = [
  { title: 'หน้าหลักสมาชิก', icon: 'grid_view', link: '/dashboard' },
  { title: 'แจ้งขายขยะ', icon: 'add_task', link: '/sell-request' },
  { title: 'คำขอขายขยะ', icon: 'fact_check', link: '/sell-request-history' },
  { title: 'ตารางรับซื้อ', icon: 'calendar_today', link: '/schedule' },
  { title: 'ประวัติและเงินสะสม', icon: 'history', link: '/history' },
];

// Monitoring menu for the supervising municipality - read-only.
const municipalityMenu: MenuProps[] = [
  { title: 'แดชบอร์ดภาพรวม', icon: 'grid_view', link: '/municipality' },
  { title: 'ติดตามสมาชิก', icon: 'group', link: '/municipality/members' },
  { title: 'ผลการดำเนินงาน', icon: 'insights', link: '/municipality/operations' },
  { title: 'ติดตามกองทุน', icon: 'savings', link: '/municipality/fund' },
  { title: 'รายงาน', icon: 'bar_chart', link: '/municipality/reports' },
  { title: 'รายงานการเสียชีวิต', icon: 'volunteer_activism', link: '/municipality/funeral' },
  { title: 'ออกรายงาน PDF', icon: 'picture_as_pdf', link: '/municipality/pdf-report' },
];

const committeeMenu: MenuProps[] = [
  { title: 'แดชบอร์ดภาพรวม', icon: 'grid_view', link: '/committee' },
  { title: 'รอบรับซื้อขยะ', icon: 'event_available', link: '/committee/rounds' },
  { title: 'คำขอขายขยะ', icon: 'assignment', link: '/committee/sell-requests' },
  { title: 'แสดงเส้นทางการรับซื้อ', icon: 'route', link: '/committee/route-plan' },
  { title: 'จัดการสมาชิก', icon: 'group', link: '/committee/members' },
  { title: 'เพิ่มสมาชิก', icon: 'person_add', link: '/committee/add-member' },
];

const buyerMenu: MenuProps[] = [
  { title: 'แผนที่รับซื้อขยะ', icon: 'route', link: '/buyer/route-plan' },
  { title: 'ประเภทขยะและราคา', icon: 'local_shipping', link: '/buyer/waste-types' },
];

const menuList = computed(() =>
  role === 'admin'
    ? adminMenu
    : role === 'municipality'
      ? municipalityMenu
      : role === 'committee'
        ? committeeMenu
        : role === 'buyer'
          ? buyerMenu
          : userMenu,
);
const roleLabel = computed(() =>
  role === 'admin'
    ? 'admin'
    : role === 'municipality'
      ? 'municipality'
      : role === 'committee'
        ? 'committee'
        : role === 'buyer'
          ? 'buyer'
          : 'member',
);
const roleInitial = computed(() =>
  role === 'admin'
    ? 'A'
    : role === 'municipality'
      ? 'ท'
      : role === 'committee'
        ? 'ก'
        : role === 'buyer'
          ? 'ร'
          : 'M',
);
const avatarUrl = computed(() => authStore.user?.avatarUrl ?? null);
// Falls back to the generic role initial until the session fetch (router guard)
// populates authStore.user.
const avatarLetter = computed(() => {
  const name = authStore.user?.fullName?.trim() || authStore.user?.username?.trim() || '';
  return name ? name.charAt(0).toUpperCase() : roleInitial.value;
});

function goToProfile() {
  if (route.path !== '/profile') void router.push('/profile');
}
const roleDisplayName = computed(() =>
  role === 'admin'
    ? 'ผู้ดูแลระบบ'
    : role === 'municipality'
      ? 'เจ้าหน้าที่เทศบาล'
      : role === 'committee'
        ? 'กรรมการธนาคารขยะ'
        : role === 'buyer'
          ? 'ผู้รับซื้อขยะ'
          : 'สมาชิก',
);
const menuSections = computed<MenuSection[]>(() => {
  if (role === 'admin') {
    return [
      { label: 'Menu', items: adminMenu.slice(0, 2) },
      { label: 'Customization', items: adminMenu.slice(2) },
      { label: 'System Settings', items: systemAdminMenu },
    ];
  }

  if (role === 'municipality') {
    return [{ label: 'Menu', items: municipalityMenu }];
  }

  if (role === 'committee') {
    return [{ label: 'Menu', items: committeeMenu }];
  }

  if (role === 'buyer') {
    return [{ label: 'Menu', items: buyerMenu }];
  }

  return [{ label: 'Menu', items: userMenu }];
});

const pageTitle = computed(() => {
  const currentMenu = menuList.value.find((menu) => isMenuActive(menu.link));
  return currentMenu ? currentMenu.title : 'ระบบธนาคารขยะ';
});

// A page one level deep from a home page: members off /dashboard, committee off
// /committee, municipality off /municipality.
const showsHomeLink = computed(
  () =>
    (isMember && route.path !== '/dashboard') ||
    (isCommittee && route.path !== '/committee') ||
    (isMunicipality && route.path !== '/municipality'),
);

const homeLink = computed(() =>
  isMember ? '/dashboard' : isMunicipality ? '/municipality' : '/committee',
);

// Next to the back arrow the toolbar says where the arrow goes, not where you
// already are - the page's own hero already carries its name.
const toolbarTitle = computed(() => (showsHomeLink.value ? 'กลับหน้าหลัก' : pageTitle.value));

function toggleLeftDrawer() {
  if (role === 'admin' && $q.screen.gt.sm) {
    drawerMini.value = !drawerMini.value;
  } else {
    leftDrawerOpen.value = !leftDrawerOpen.value;
  }
}

// Dashboard links are a prefix of their sibling menu links - match them exactly
// so the two entries never light up together.
const exactMatchLinks = ['/admin', '/municipality', '/committee'];

function isMenuActive(link: string) {
  if (exactMatchLinks.includes(link)) return route.path === link;
  return route.path === link || route.path.startsWith(`${link}/`);
}

function logout() {
  showLogoutDialog.value = true;
}

function focusLogoutConfirm() {
  void nextTick(() => {
    window.setTimeout(() => {
      const confirmElement = logoutConfirmButton.value?.$el;

      if (confirmElement) {
        confirmElement.focus();
        return;
      }

      logoutConfirmButton.value?.focus?.();
    }, 60);
  });
}

function closeLogoutDialog() {
  showLogoutDialog.value = false;
}

function confirmLogout() {
  showLogoutDialog.value = false;
  authStore.logout();
  void router.replace('/');
}

function handleLogoutDialogKeydown(event: KeyboardEvent) {
  if (!showLogoutDialog.value || event.key !== 'Enter' || event.repeat) return;

  event.preventDefault();
  confirmLogout();
}

watch(showLogoutDialog, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleLogoutDialogKeydown, true);
    return;
  }

  document.removeEventListener('keydown', handleLogoutDialogKeydown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleLogoutDialogKeydown, true);
});
</script>

<style lang="scss">
.app-shell {
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(circle at 0 0, rgba(194, 232, 199, 0.72), transparent 34%),
    linear-gradient(135deg, #edf8ed 0%, #f8fbf7 56%, #eef7ed 100%);

  &.is-admin .muni-page {
    background: transparent !important;
  }
}

.app-header {
  color: #17452e;
  background: rgba(248, 251, 247, 0.82);
  border-bottom: 1px solid rgba(8, 127, 73, 0.08);
  backdrop-filter: blur(16px);
}

// A blurred fixed header is re-rendered on every scroll frame - too heavy for
// phones, so they get a near-solid header instead.
@media (max-width: 1023px) {
  .app-header {
    background: rgba(248, 251, 247, 0.97);
    backdrop-filter: none;
  }
}

.app-toolbar {
  min-height: 68px;
  padding: 0 24px;
}

.menu-toggle {
  color: #087f49;
}

.notification-bell {
  margin-right: 10px;
}

.page-title {
  color: #183f2b;
  /* Shrinks on narrow screens so long titles (e.g. "หน้าหลักสมาชิก") aren't
     clipped by the toolbar's ellipsis. */
  font-size: clamp(15px, 3.6vw, 20px);
  font-weight: 900;
}

/* The title doubles as the back arrow's label, so it takes the tap too. */
.home-link {
  color: inherit;
  text-decoration: none;
}

.header-avatar,
.profile-avatar {
  color: #ffffff;
  background: linear-gradient(135deg, #159757, #17c13f);
  font-weight: 900;
  cursor: pointer;
  overflow: hidden;
}

.profile-row {
  cursor: pointer;
}

.account-menu .q-menu__content,
.account-menu.q-menu {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(8, 62, 38, 0.18);
}

.account-menu-list {
  min-width: 220px;
  padding: 4px 0;
}

.account-menu-header {
  padding: 14px 16px 10px;
}

.account-menu-name {
  overflow: hidden;
  color: #18271f;
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-menu-role {
  margin-top: 2px;
  color: #8a9a90;
  font-size: 11px;
  font-weight: 700;
}

.app-sidebar {
  padding: 18px 10px 18px 20px;
  background: transparent !important;
}

.sidebar-card {
  height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #26352d;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(8, 127, 73, 0.08);
  border-radius: 8px;
  box-shadow: 0 22px 48px rgba(29, 91, 52, 0.08);
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: 18px 18px 12px;
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  min-width: 38px;
  place-items: center;
  overflow: hidden;
  background: #ffffff;
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(0, 102, 58, 0.14);
}

.brand-mark img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.brand-text,
.section-label,
.menu-text-section,
.profile-copy,
.logout-btn {
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.2s ease, width 0.2s ease, margin 0.2s ease, padding 0.2s ease;
}

.brand-text {
  /* Restored default block behavior */
}

/* Sized so the full name fits on one line in the 280px drawer. */
.brand-name {
  color: #111f18;
  font-size: 12px;
  font-weight: 950;
  line-height: 1.1;
}

.brand-subtitle {
  margin-top: 3px;
  color: #8a9a90;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px;
}

/* Custom Scrollbar for Sidebar */
.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}
.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 102, 58, 0.15);
  border-radius: 4px;
}
.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 102, 58, 0.3);
}

.menu-section {
  margin-top: 16px;
}

.section-label {
  margin: 0 0 6px 8px;
  color: #b3bdb7;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.menu-list {
  display: grid;
  gap: 4px;
}

.sidebar-item {
  min-height: 42px;
  padding: 0 12px;
  color: #3e4c45;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 800;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.sidebar-item:hover {
  color: #087f49;
  background: #f3faf3;
}

.menu-icon-section {
  min-width: 32px;
  padding-right: 12px;
  color: #a4afa8;
}

.active-menu-item {
  color: #087f49 !important;
  background: #edf8ee !important;
  transform: translateX(2px);
}

.active-menu-item .menu-icon-section {
  color: #13b84f;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 74px;
  padding: 12px 16px 16px;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.profile-name {
  overflow: hidden;
  color: #18271f;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-role {
  color: #8a9a90;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.logout-btn {
  color: #9aa8a0;
}

.q-card.logout-dialog-card,
.logout-dialog-card {
  width: min(420px, calc(100vw - 32px));
  padding: 34px 30px 26px;
  overflow: hidden;
  text-align: center;
  border: 1px solid rgba(8, 127, 73, 0.12);
  border-radius: 20px;
  background: radial-gradient(circle at 50% 0, rgba(219, 244, 223, 0.86), transparent 46%), #ffffff;
  box-shadow: 0 28px 80px rgba(0, 72, 40, 0.24);
}

.logout-dialog-title {
  color: #06492d;
  font-size: 26px;
  font-weight: 950;
  line-height: 1.2;
}

.logout-dialog-message {
  margin-top: 8px;
  color: #5c7769;
  font-size: 15px;
  font-weight: 700;
}

.logout-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 26px 0 0;
}

.logout-cancel-btn,
.logout-confirm-btn {
  min-height: 46px;
  border-radius: 10px;
  font-weight: 900;
}

.logout-cancel-btn {
  color: #087f49;
  background: #f3faf3;
}

.logout-confirm-btn {
  color: #ffffff;
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  box-shadow: 0 14px 28px rgba(185, 28, 28, 0.22);
}

.app-page-container {
  background: transparent;
}

.app-sidebar.is-mini-drawer {
  padding: 16px 8px;
}

.sidebar-card.is-mini-sidebar {
  align-items: center;
  width: 52px;
  margin: 0 auto;
}

.sidebar-card.is-mini-sidebar .brand-row {
  min-height: 58px;
  justify-content: center;
  padding: 12px 0 8px;
  gap: 0;
}

.sidebar-card.is-mini-sidebar .brand-mark {
  width: 34px;
  height: 34px;
  min-width: 34px;
}

.sidebar-card.is-mini-sidebar .brand-text,
.sidebar-card.is-mini-sidebar .section-label,
.sidebar-card.is-mini-sidebar .profile-copy,
.sidebar-card.is-mini-sidebar .menu-text-section {
  opacity: 0;
  width: 0 !important;
  min-width: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  flex: none !important;
  pointer-events: none;
}

.sidebar-card.is-mini-sidebar .logout-btn {
  display: none !important;
}

.sidebar-card.is-mini-sidebar .sidebar-scroll {
  width: 100%;
  padding: 8px 0;
}

.sidebar-card.is-mini-sidebar .menu-section {
  margin-top: 6px;
}

.sidebar-card.is-mini-sidebar .menu-list {
  gap: 12px;
}

.sidebar-card.is-mini-sidebar .sidebar-item {
  width: 38px;
  min-height: 38px;
  justify-content: center;
  padding: 0;
  margin: 0 auto;
  border-radius: 8px;
}

.sidebar-card.is-mini-sidebar .menu-icon-section {
  min-width: 0;
  padding: 0;
}

.sidebar-card.is-mini-sidebar .menu-icon-section.q-item__section--avatar {
  min-width: 0;
  padding-right: 0;
}

.sidebar-card.is-mini-sidebar .active-menu-item {
  transform: none;
}

.sidebar-card.is-mini-sidebar .profile-row {
  width: 100%;
  min-height: 62px;
  justify-content: center;
  padding: 8px 0 14px;
  gap: 0;
}

@media (max-width: 1023px) {
  .app-sidebar {
    padding: 12px;
  }

  .sidebar-card {
    height: calc(100vh - 24px);
  }
}

/* Tighter toolbar on phones so the title has more room before it truncates. */
@media (max-width: 599px) {
  .app-toolbar {
    padding: 0 12px;
  }
}
</style>
