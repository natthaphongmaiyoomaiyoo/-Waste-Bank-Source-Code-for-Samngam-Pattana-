<template>
  <q-layout view="hHh lpR fFf" class="landing-layout">
    <q-header class="top-header">
      <q-toolbar class="top-toolbar">
        <div class="brand">
          <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" class="brand-logo" />
          <div class="brand-name">กองทุนธนาคารขยะ</div>
        </div>

        <div class="header-actions">
          <q-btn
            outline
            no-caps
            icon="support_agent"
            label="ติดต่อผู้ดูแลระบบ"
            aria-label="ติดต่อผู้ดูแลระบบ"
            class="register-btn"
            href="mailto:admin@wastebank.local"
          />
          <q-btn
            unelevated
            no-caps
            icon="person"
            label="เข้าสู่ระบบ"
            aria-label="เข้าสู่ระบบ"
            class="login-btn"
            @click="isLoginDialogOpen = true"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="landing-page">
        <section class="hero-section" :style="heroStyle">
          <div class="hero-slide-stack">
            <div
              v-for="(image, index) in slideImages"
              :key="image"
              :class="['hero-slide-image', { 'is-active': index === activeSlideIndex }]"
            >
              <div class="hero-slide-backdrop" :style="{ backgroundImage: `url(${image})` }"></div>
              <img
                :src="image"
                alt="ข่าวเด่นธนาคารขยะ"
                class="hero-slide-fg"
                @load="onHeroImageLoad($event, index)"
              />
            </div>
          </div>

          <div class="hero-scrim"></div>

          <!-- The text the admin set on the active banner; the next slide's text
               clears and types in afresh. -->
          <transition name="hero-welcome-fade">
            <div v-if="activeSlideText" class="hero-welcome">
              <h1 class="hero-welcome-headline" :aria-label="heroWelcomeHeadline">
                <span aria-hidden="true" class="hero-welcome-line">
                  {{ typedHeroWelcomeHeadlineIntro }}
                </span>
                <span aria-hidden="true" class="hero-welcome-line hero-welcome-line-main">
                  {{ typedHeroWelcomeHeadlineMain }}
                  <span
                    v-if="showHeroTypingCaret"
                    aria-hidden="true"
                    class="hero-welcome-caret"
                  ></span>
                </span>
              </h1>
            </div>
          </transition>

          <div v-if="slideImages.length > 1" class="hero-dots">
            <button
              v-for="(image, index) in slideImages"
              :key="image"
              type="button"
              :class="['hero-dot', { 'is-active': index === activeSlideIndex }]"
              :aria-label="`สไลด์ที่ ${index + 1}`"
              @click="goToSlide(index)"
            ></button>
          </div>
        </section>

        <section class="impact-section">
          <div class="impact-grid">
            <div v-for="item in impactItems" :key="item.title" class="impact-card">
              <div class="impact-icon">
                <q-icon :name="item.icon" />
              </div>
              <div class="impact-text">
                <div class="impact-title">{{ item.title }}</div>
                <div class="impact-caption">{{ item.caption }}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="news-list" class="news-section">
          <SectionHeader icon="newspaper" title="ข่าวสารและกิจกรรมล่าสุด" view-all-to="/news" />

          <MediaCarousel
            v-if="newsSlides.length"
            :items="newsSlides"
            label="ข่าวสารและกิจกรรมล่าสุด"
            item-name="ข่าว"
          />

          <q-card v-else flat class="empty-state">
            <q-icon name="campaign" size="52px" />
            <div class="text-h6 text-weight-bold q-mt-md">ยังไม่มีข่าวสารในขณะนี้</div>
            <div class="text-grey-7">รอติดตามประกาศจากธนาคารขยะชุมชนได้ที่หน้านี้</div>
          </q-card>
        </section>

        <VideoSection />

        <AppFooter />

        <LoginDialog v-model="isLoginDialogOpen" />

        <q-dialog
          v-model="isRegisterDialogOpen"
          persistent
          class="login-modal-dialog"
          transition-show="scale"
          transition-hide="fade"
          @show="handleRegisterDialogShow"
        >
          <q-card class="register-dialog-card">
            <div class="login-visual register-visual">
              <img src="/icons/hero-recycle.png" alt="สมัครสมาชิกธนาคารขยะรีไซเคิล" />
              <div class="login-visual-shade"></div>
              <div class="login-visual-text">
                <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" />
                <div>
                  <div class="login-visual-title">สมัครสมาชิก</div>
                  <div class="login-visual-caption">
                    ส่งข้อมูลและเอกสาร เพื่อเข้าร่วมธนาคารขยะชุมชน
                  </div>
                </div>
              </div>
            </div>

            <div class="register-form-panel">
              <div class="register-dialog-head">
                <div>
                  <q-badge class="login-dialog-badge">
                    <q-icon name="how_to_reg" />
                    ระบบสมัครสมาชิก
                  </q-badge>
                  <h2>สมัครสมาชิก</h2>
                  <p>กรอกข้อมูลส่วนตัวและแนบเอกสารประกอบการสมัคร</p>
                </div>
                <q-btn flat round dense icon="close" @click="closeRegisterDialog" />
              </div>

              <q-form class="register-form" @submit.prevent="submitRegisterApplication">
                <div class="register-form-grid">
                  <q-input
                    ref="registerNameInput"
                    v-model="registerForm.fullName"
                    outlined
                    rounded
                    dense
                    label="ชื่อ-นามสกุล"
                    class="dialog-input"
                    :rules="[(value) => !!value || 'กรุณากรอกชื่อ-นามสกุล']"
                  />
                  <q-input
                    v-model="registerForm.idCard"
                    outlined
                    rounded
                    dense
                    label="เลขบัตรประชาชน"
                    mask="#-####-#####-##-#"
                    class="dialog-input"
                    :rules="[(value) => !!value || 'กรุณากรอกเลขบัตรประชาชน']"
                  />
                  <MidDateField
                    v-model="registerForm.birthDate"
                    label="วันเกิด"
                    class="dialog-input"
                    required
                    no-future
                  />
                  <q-input
                    v-model="registerForm.phone"
                    outlined
                    rounded
                    dense
                    label="เบอร์โทรศัพท์"
                    mask="###-###-####"
                    class="dialog-input"
                    :rules="[(value) => !!value || 'กรุณากรอกเบอร์โทรศัพท์']"
                  />
                  <q-input
                    v-model="registerForm.email"
                    outlined
                    rounded
                    dense
                    type="email"
                    label="อีเมล (ถ้ามี)"
                    class="dialog-input"
                  />
                  <q-select
                    v-model="registerForm.village"
                    outlined
                    rounded
                    dense
                    emit-value
                    map-options
                    label="หมู่บ้าน"
                    :options="villageOptions"
                    class="dialog-input"
                    :rules="[(value) => !!value || 'กรุณาเลือกหมู่บ้าน']"
                  />
                </div>

                <q-input
                  v-model="registerForm.address"
                  outlined
                  rounded
                  dense
                  type="textarea"
                  rows="2"
                  label="ที่อยู่"
                  class="dialog-input q-mt-sm"
                  :rules="[(value) => !!value || 'กรุณากรอกที่อยู่']"
                />

                <q-file
                  v-model="registerDocuments"
                  outlined
                  rounded
                  dense
                  multiple
                  counter
                  use-chips
                  accept=".pdf,.jpg,.jpeg,.png"
                  label="แนบเอกสารประกอบการสมัคร"
                  class="dialog-input q-mt-sm"
                  :rules="[
                    (value) => (value && value.length > 0) || 'กรุณาแนบเอกสารอย่างน้อย 1 ไฟล์',
                  ]"
                >
                  <template #prepend>
                    <q-icon name="upload_file" />
                  </template>
                </q-file>

                <div class="register-actions">
                  <q-btn
                    flat
                    no-caps
                    label="กลับไปเข้าสู่ระบบ"
                    class="dialog-secondary-btn"
                    @click="switchRegisterToLogin"
                  />
                  <q-btn
                    type="submit"
                    unelevated
                    no-caps
                    icon-right="arrow_forward"
                    label="ส่งใบสมัคร"
                    class="dialog-submit-btn"
                  />
                </div>
                <div class="auth-switch-row register-status-link">
                  <span>มีเลขอ้างอิงแล้ว?</span>
                  <button type="button" @click="openApplicationStatusDialog()">
                    ตรวจสอบสถานะการสมัคร
                  </button>
                </div>
              </q-form>
            </div>
          </q-card>
        </q-dialog>

        <q-dialog
          v-model="isRegisterSuccessOpen"
          persistent
          transition-show="scale"
          transition-hide="fade"
        >
          <q-card class="register-success-card">
            <div class="success-check">
              <q-icon name="check" />
            </div>
            <div class="success-title">ส่งใบสมัครสำเร็จ</div>
            <div class="success-caption">เก็บเลขอ้างอิงนี้ไว้เพื่อตรวจสอบสถานะ</div>
            <div class="register-reference">{{ submittedApplicationRef }}</div>
            <q-card-actions class="register-success-actions">
              <q-btn
                flat
                no-caps
                label="ปิด"
                class="dialog-secondary-btn"
                @click="isRegisterSuccessOpen = false"
              />
              <q-btn
                unelevated
                no-caps
                label="เข้าสู่ระบบ"
                class="dialog-submit-btn"
                @click="openLoginFromSuccess"
              />
            </q-card-actions>
            <div class="auth-switch-row register-status-link">
              <button type="button" @click="openStatusFromSuccess">ตรวจสอบสถานะใบสมัครนี้</button>
            </div>
          </q-card>
        </q-dialog>

        <q-dialog
          v-model="isApplicationStatusDialogOpen"
          transition-show="scale"
          transition-hide="fade"
        >
          <q-card class="application-status-card">
            <div class="status-dialog-head">
              <div>
                <q-badge class="login-dialog-badge">
                  <q-icon name="fact_check" />
                  ตรวจสอบสถานะ
                </q-badge>
                <h2>สถานะการสมัคร</h2>
                <p>กรอกเลขอ้างอิงหรือเลขบัตรประชาชนที่ใช้สมัคร</p>
              </div>
              <q-btn flat round dense icon="close" v-close-popup />
            </div>

            <q-input
              v-model="applicationStatusKeyword"
              outlined
              rounded
              dense
              label="เลขอ้างอิง / เลขบัตรประชาชน"
              class="dialog-input"
              @keyup.enter="checkApplicationStatus"
            >
              <template #prepend>
                <q-icon name="search" />
              </template>
            </q-input>

            <q-btn
              unelevated
              no-caps
              label="ตรวจสอบ"
              icon-right="fact_check"
              class="dialog-submit-btn full-width status-check-btn"
              @click="checkApplicationStatus"
            />

            <div v-if="applicationStatusResult" class="application-status-result">
              <q-badge :class="['application-status-badge', applicationStatusResult.status]">
                {{ applicationStatusMeta[applicationStatusResult.status].label }}
              </q-badge>
              <h3>{{ applicationStatusResult.fullName }}</h3>
              <div class="status-reference">
                เลขอ้างอิง {{ applicationStatusResult.referenceNo }}
              </div>
              <q-linear-progress
                rounded
                size="9px"
                :value="applicationStatusMeta[applicationStatusResult.status].progress"
                :color="applicationStatusMeta[applicationStatusResult.status].color"
                class="q-mt-md"
              />
              <p>{{ applicationStatusResult.note }}</p>
            </div>

            <div v-else class="application-status-empty">
              {{ applicationStatusMessage }}
            </div>
          </q-card>
        </q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useMemberApplicationStore,
  type MemberApplication,
} from 'src/stores/memberApplicationStore';
import { formatThaiDate, useNewsStore } from 'src/stores/newsStore';
import { useBannerStore } from 'src/stores/bannerStore';
import AppFooter from 'components/AppFooter.vue';
import LoginDialog from 'components/LoginDialog.vue';
import MediaCarousel from 'components/MediaCarousel.vue';
import type { CarouselSlide } from 'components/mediaCarousel';
import SectionHeader from 'components/SectionHeader.vue';
import VideoSection from 'components/VideoSection.vue';
import { MidDateField, midNotify } from 'components/MID';
import {
  APPLICATION_STATUS_EMPTY_MESSAGE,
  APPLICATION_STATUS_META,
  HERO_SLIDE_IMAGES,
  HERO_WELCOME_CONTENT,
  HOME_IMPACT_ITEMS,
  HOME_VILLAGE_OPTIONS,
} from 'src/data/homeContent';

const bannerStore = useBannerStore();

// Banners come from the admin's /manage-banners page. Nothing renders until the
// first request settles (so the built-in set never flashes first); the built-in
// set stands in only if that request fails or every banner has been deleted.
// Each slide: its image and the text over it (a first and a second line,
// either may be empty) as set on /manage-banners. The built-in set
// keeps the old welcome text on its last slide.
const slides = computed(() => {
  if (!bannerStore.loaded) return [];
  if (bannerStore.items.length) {
    return bannerStore.items.map((banner) => ({
      image: banner.imageUrl,
      intro: banner.textIntro ?? '',
      main: banner.textMain ?? '',
    }));
  }
  const welcome = HERO_WELCOME_CONTENT;
  return HERO_SLIDE_IMAGES.map((image, index, all) =>
    index === all.length - 1
      ? {
          image,
          intro: welcome.headlineIntro,
          main: welcome.headline.slice(welcome.headlineIntro.length),
        }
      : { image, intro: '', main: '' },
  );
});
const slideImages = computed(() => slides.value.map((slide) => slide.image));

const activeSlideText = computed(() => {
  const slide = slides.value[activeSlideIndex.value];
  return slide && (slide.intro || slide.main) ? { intro: slide.intro, main: slide.main } : null;
});
const heroWelcomeHeadline = computed(() =>
  activeSlideText.value ? activeSlideText.value.intro + activeSlideText.value.main : '',
);

const impactItems = HOME_IMPACT_ITEMS;
const newsStore = useNewsStore();
const isLoginDialogOpen = ref(false);
const isRegisterDialogOpen = ref(false);
const isRegisterSuccessOpen = ref(false);
const isApplicationStatusDialogOpen = ref(false);
const registerNameInput = ref<{ focus: () => void } | null>(null);
const registerDocuments = ref<File[]>([]);
const submittedApplicationRef = ref('');
const applicationStatusKeyword = ref('');
const applicationStatusResult = ref<MemberApplication | null>(null);
const applicationStatusMessage = ref(APPLICATION_STATUS_EMPTY_MESSAGE);
const activeSlideIndex = ref(0);
const typedHeroWelcomeHeadline = ref('');
let heroTimer: number | undefined;
let heroTypingTimer: number | undefined;
const router = useRouter();
const route = useRoute();
const applicationStore = useMemberApplicationStore();

const registerForm = ref({
  fullName: '',
  idCard: '',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  village: '',
  occupation: '',
});

const villageOptions = HOME_VILLAGE_OPTIONS;

const applicationStatusMeta = APPLICATION_STATUS_META;

onMounted(() => {
  startHeroAutoSlide();
  if (activeSlideText.value) startHeroTyping();
  void bannerStore.fetchBanners();
  void newsStore.fetchNews({ visibleOnly: true });
  if (route.query.login === '1') {
    isLoginDialogOpen.value = true;
    void router.replace('/');
  }
});

onBeforeUnmount(() => {
  if (heroTimer) window.clearInterval(heroTimer);
  stopHeroTyping();
});

// The slider shows the newest few; "ดูทั้งหมด" leads to the full list.
const LATEST_NEWS_COUNT = 10;
const newsSlides = computed<CarouselSlide[]>(() =>
  newsStore.items.slice(0, LATEST_NEWS_COUNT).map((news) => ({
    id: news.id,
    image: news.image,
    label: formatThaiDate(news.date),
    title: news.title,
    action: 'อ่านต่อ',
    actionIcon: 'arrow_forward',
    to: `/news/${news.id}`,
  })),
);

// สัดส่วนจริง (กว้าง/สูง) ของแต่ละสไลด์ วัดจากไฟล์รูปตอนโหลดเสร็จ เพื่อให้กรอบ
// แบนเนอร์ปรับความสูงตามรูปที่แอดมินอัปโหลดจริง ไม่ต้องบังคับขนาดรูปตายตัว
const slideRatios = ref<Record<number, number>>({});

function onHeroImageLoad(event: Event, index: number) {
  const img = event.target as HTMLImageElement;
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    slideRatios.value = { ...slideRatios.value, [index]: img.naturalWidth / img.naturalHeight };
  }
}

// A different banner list (first load, or an admin edit since the last visit)
// invalidates the per-index ratios and possibly the active index.
watch(
  () => slideImages.value.join('\n'),
  () => {
    slideRatios.value = {};
    activeSlideIndex.value = 0;
    startHeroAutoSlide();
  },
);

// The typed text splits back into the two lines at the end of the first line.
const typedHeroWelcomeHeadlineIntro = computed(() =>
  typedHeroWelcomeHeadline.value.slice(0, activeSlideText.value?.intro.length ?? 0),
);
const typedHeroWelcomeHeadlineMain = computed(() =>
  typedHeroWelcomeHeadline.value.slice(activeSlideText.value?.intro.length ?? 0),
);
const showHeroTypingCaret = computed(
  () =>
    Boolean(activeSlideText.value) &&
    typedHeroWelcomeHeadline.value.length < heroWelcomeHeadline.value.length,
);

const heroStyle = computed(() => {
  const ratio = slideRatios.value[activeSlideIndex.value];
  if (!ratio) return {};
  return {
    '--hero-ratio': String(ratio),
    // รูปแนวตั้ง/ใกล้จัตุรัสถ้าใช้ cover จะโดนตัดจนเหลือแต่แถบกลาง ให้ถอยไปใช้
    // contain + ฉากหลังเบลอแทน ส่วนรูปแนวนอนปกติใช้ cover ให้เต็มกรอบชนขอบจอ
    '--hero-fit': ratio < 1.2 ? 'contain' : 'cover',
  };
});

function startHeroAutoSlide() {
  if (heroTimer) window.clearInterval(heroTimer);
  if (slideImages.value.length <= 1) return;
  heroTimer = window.setInterval(() => {
    activeSlideIndex.value = (activeSlideIndex.value + 1) % slideImages.value.length;
  }, 8000);
}

function goToSlide(index: number) {
  activeSlideIndex.value = index;
  startHeroAutoSlide();
}

function splitThaiTextUnits(text: string): string[] {
  return text.match(/\p{L}\p{M}*|[\s\S]/gu) ?? Array.from(text);
}

function stopHeroTyping() {
  if (heroTypingTimer) {
    window.clearInterval(heroTypingTimer);
    heroTypingTimer = undefined;
  }
}

function startHeroTyping() {
  stopHeroTyping();
  typedHeroWelcomeHeadline.value = '';

  const units = splitThaiTextUnits(heroWelcomeHeadline.value);
  let index = 0;

  heroTypingTimer = window.setInterval(() => {
    typedHeroWelcomeHeadline.value += units[index] ?? '';
    index += 1;

    if (index >= units.length) {
      stopHeroTyping();
    }
  }, 78);
}

// A new slide (or new text on the same slide) types its own text from the start.
watch(
  () => `${activeSlideIndex.value}|${heroWelcomeHeadline.value}`,
  () => {
    if (activeSlideText.value) {
      startHeroTyping();
      return;
    }

    stopHeroTyping();
    typedHeroWelcomeHeadline.value = '';
  },
);

function handleRegisterDialogShow() {
  void nextTick(() => {
    window.setTimeout(() => registerNameInput.value?.focus(), 80);
  });
}

function openApplicationStatusDialog(keyword = '') {
  if (keyword) {
    applicationStatusKeyword.value = keyword;
  }

  isRegisterDialogOpen.value = false;
  isRegisterSuccessOpen.value = false;
  isApplicationStatusDialogOpen.value = true;

  if (keyword) {
    window.setTimeout(checkApplicationStatus, 80);
  }
}

function switchRegisterToLogin() {
  isRegisterDialogOpen.value = false;
  void nextTick(() => {
    isLoginDialogOpen.value = true;
  });
}

function closeRegisterDialog() {
  isRegisterDialogOpen.value = false;
}

async function submitRegisterApplication() {
  const { fullName, idCard, birthDate, phone, village, address } = registerForm.value;

  if (!fullName || !idCard || !birthDate || !phone || !village || !address) {
    return;
  }

  if (registerDocuments.value.length === 0) {
    return;
  }

  try {
    const application = await applicationStore.submitApplication({
      ...registerForm.value,
      documents: registerDocuments.value.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'unknown',
        uploadedAt: new Date().toISOString(),
      })),
    });

    submittedApplicationRef.value = application.referenceNo;
    resetRegisterForm();
    isRegisterDialogOpen.value = false;
    isRegisterSuccessOpen.value = true;
  } catch {
    midNotify({ type: 'error', message: 'ส่งใบสมัครไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือเลขบัตรประชาชนซ้ำ' });
  }
}

function resetRegisterForm() {
  registerForm.value = {
    fullName: '',
    idCard: '',
    birthDate: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    occupation: '',
  };
  registerDocuments.value = [];
}

function openLoginFromSuccess() {
  isRegisterSuccessOpen.value = false;
  void nextTick(() => {
    isLoginDialogOpen.value = true;
  });
}

function openStatusFromSuccess() {
  openApplicationStatusDialog(submittedApplicationRef.value);
}

function checkApplicationStatus() {
  applicationStatusResult.value = applicationStore.findApplication(applicationStatusKeyword.value);
  applicationStatusMessage.value = applicationStatusResult.value
    ? ''
    : 'ไม่พบใบสมัคร กรุณาตรวจสอบเลขอ้างอิงหรือเลขบัตรประชาชนอีกครั้ง';
}
</script>

<style scoped>
.landing-layout {
  background: #f6fbf6;
}

.top-header {
  background: rgba(255, 255, 255, 0.68);
  color: #063f27;
  border-bottom: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 10px 30px rgba(0, 82, 45, 0.1);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}

/* The blur is re-rendered on every scroll frame - too heavy for phones, so they
   get a near-solid header instead. */
@media (max-width: 1023px) {
  .top-header {
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.top-toolbar {
  min-height: 72px;
  padding: 0 28px;
  gap: 16px;
}

.brand {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-logo {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
}

.brand-name {
  color: #075f38;
  font-size: 22px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

.register-btn,
.login-btn {
  min-height: 40px;
  border-radius: 999px;
  padding: 0 18px;
  font-weight: 800;
}

.register-btn {
  color: #087f49;
  background: rgba(219, 244, 223, 0.58);
}

.login-btn {
  color: white;
  background: #006f42;
  box-shadow: 0 12px 24px rgba(0, 102, 58, 0.18);
}

.landing-page {
  min-height: 100vh;
  background: #ffffff;
}

.hero-section {
  /* Ratio of the ACTIVE slide image, measured from the file itself on load
     (see onHeroImageLoad); 2.4 is only the pre-load fallback. */
  --hero-ratio: 2.4;
  /* Extra height beyond the image-ratio fit: gives the .impact-section cards
     (which float over the hero's bottom edge) room without covering as much
     of the picture, and softens the cover-crop at capped widths. */
  --hero-safe-zone: clamp(28px, 4.5vw, 64px);
  position: relative;
  width: 100%;
  /* The image area's height follows the uploaded image's own aspect ratio, so
     the picture fills the frame edge-to-edge at any screen width or zoom - a
     fixed-height frame can never match every image ratio and always left
     blurred side bars. Bounded so an extreme ratio can't collapse the banner
     (min 180px) and so the banner never dominates the viewport (max 560px or
     64vh); past the cap the vertical slack is cover-cropped instead (see
     .hero-slide-fg). */
  height: calc(clamp(180px, 100vw / var(--hero-ratio), min(560px, 64vh)) + var(--hero-safe-zone));
  overflow: hidden;
  background: #dcefe1;
  transition: height 0.4s ease;
}

.hero-slide-stack {
  position: absolute;
  inset: 0;
}

.hero-slide-image {
  position: absolute;
  inset: 0;
  background: #dcefe1;
  opacity: 0;
  transition: opacity 0.9s ease;
}

.hero-slide-image.is-active {
  opacity: 1;
}

/* Blurred, zoomed copy of the same slide behind the real image - visible only
   where the foreground doesn't cover: while the image loads, for portrait
   uploads that fall back to object-fit: contain, and on small screens. */
.hero-slide-backdrop {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(30px) saturate(1.15) brightness(0.82);
  transform: scale(1.15);
}

/* Same look at a fraction of the cost on phones - blur work grows with radius. */
@media (max-width: 1023px) {
  .hero-slide-backdrop {
    filter: blur(12px) saturate(1.15) brightness(0.82);
    transform: scale(1.08);
  }
}

/* Fills the frame edge-to-edge with no blurred side bars. The frame's height
   already follows the image's own ratio (see .hero-section), so cover only
   crops the vertical slack that appears once the height cap kicks in on wide
   screens - and the crop is biased upward (35%) so titles near the top of
   poster-style images survive before their bottom edge does. Portrait-ish
   uploads get --hero-fit: contain from heroStyle instead, since cover would
   slice them to a thin center strip.
   Absolutely positioned (not width/height:100% on a relative element) because
   percentage heights inside the old grid parent didn't resolve and let the
   image overflow the banner at some widths/zooms. */
.hero-slide-fg {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: var(--hero-fit, cover);
  object-position: 50% 35%;
}

.hero-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  /* A light, purely decorative vignette now that there's no overlay text to support -
     just enough top/bottom/edge depth to keep the banner feeling framed and premium,
     and to give the dots below a touch of contrast against any slide. */
  background:
    linear-gradient(
      180deg,
      rgba(4, 36, 20, 0.14) 0%,
      rgba(4, 36, 20, 0) 20%,
      rgba(4, 36, 20, 0) 76%,
      rgba(2, 24, 14, 0.3) 100%
    ),
    radial-gradient(130% 120% at 50% 0%, rgba(0, 0, 0, 0) 55%, rgba(2, 24, 14, 0.14) 100%);
  pointer-events: none;
}

/* Banner text overlay - rendered while the active slide has text of its own
   (set on /manage-banners), typed in letter by letter on each slide. Text sits directly on the image (no card),
   left-aligned where the artwork leaves clear space. */
.hero-welcome {
  position: absolute;
  z-index: 2;
  inset: 0 auto var(--hero-safe-zone) 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  width: min(760px, 88%);
  padding-left: clamp(20px, 5.5vw, 84px);
  padding-right: clamp(16px, 4vw, 48px);
  color: #ffffff;
  pointer-events: none;
}

/* Localized left-edge darkening so white text stays readable on bright
   artwork without dimming the whole banner; travels with the overlay so
   other slides are untouched. */
.hero-welcome::before {
  content: '';
  position: absolute;
  inset: 0 -22% calc(-1 * var(--hero-safe-zone)) 0;
  z-index: -1;
  background: linear-gradient(
    96deg,
    rgba(3, 30, 17, 0.52) 0%,
    rgba(3, 30, 17, 0.3) 46%,
    rgba(3, 30, 17, 0) 78%
  );
}

.hero-welcome-label {
  margin-bottom: clamp(10px, 1.3vw, 18px);
  font-size: clamp(12px, 1vw, 15px);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 8px rgba(2, 26, 15, 0.42);
  opacity: 0.94;
  text-transform: uppercase;
}

.hero-welcome-headline {
  margin: 0;
  max-width: 100%;
  font-size: clamp(32px, 5vw, 64px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0;
  text-wrap: balance;
  text-shadow: 0 2px 18px rgba(2, 26, 15, 0.52);
  white-space: normal;
  overflow-wrap: anywhere;
}

.hero-welcome-line {
  display: block;
}

/* Admin text can be long: it wraps inside the overlay rather than running off
   the banner. */
.hero-welcome-line-main {
  white-space: normal;
}

.hero-welcome-caret {
  display: inline-block;
  width: clamp(3px, 0.24vw, 5px);
  height: 0.95em;
  margin-left: clamp(3px, 0.4vw, 6px);
  vertical-align: -0.08em;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.26);
  animation: hero-caret-blink 0.9s steps(1) infinite;
}

@keyframes hero-fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hero-caret-blink {
  0%,
  48% {
    opacity: 1;
  }

  52%,
  100% {
    opacity: 0;
  }
}

.hero-welcome-fade-enter-active {
  transition: opacity 0.45s ease;
}

.hero-welcome-fade-leave-active {
  transition: opacity 0.3s ease;
}

.hero-welcome-fade-enter-from,
.hero-welcome-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .hero-welcome-label {
    opacity: 1;
    transform: none;
  }

  .hero-welcome-caret {
    animation: none;
  }
}

.hero-dots {
  position: absolute;
  z-index: 2;
  right: clamp(16px, 4vw, 28px);
  /* Kept clear of the .impact-section cards floating over the hero's bottom edge
     (see .impact-section margin-top below) at every breakpoint. */
  bottom: clamp(48px, 7vw, 72px);
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(4, 36, 20, 0.32);
  border-radius: 999px;
  backdrop-filter: blur(6px);
}

.hero-dot {
  width: 9px;
  height: 9px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition:
    width 0.25s ease,
    background 0.25s ease;
}

.hero-dot.is-active {
  width: 26px;
  background: #ffffff;
}

.news-section {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 40px 28px 70px;
}

.impact-section {
  position: relative;
  z-index: 3;
  width: min(1180px, 100%);
  margin: -24px auto 0;
  padding: 0 28px;
}

.impact-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  align-items: stretch;
}

/* Each of the 3 cards carries its own accent (brand green / merit gold /
   community teal) so the strip doesn't read as one item copy-pasted three
   times, while the icon treatment, shadow language, and card shape stay
   identical across all three for a unified, deliberate feature strip. */
.impact-card:nth-child(1) {
  --impact-accent-1: #12b06a;
  --impact-accent-2: #087a48;
  --impact-glow: rgba(18, 176, 106, 0.16);
}

.impact-card:nth-child(2) {
  --impact-accent-1: #e3ac2f;
  --impact-accent-2: #b9800f;
  --impact-glow: rgba(227, 172, 47, 0.16);
}

.impact-card:nth-child(3) {
  --impact-accent-1: #14b8a6;
  --impact-accent-2: #0f766e;
  --impact-glow: rgba(20, 184, 166, 0.16);
}

.impact-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(16px, 1.8vw, 22px);
  min-height: 128px;
  padding: 27px 26px;
  overflow: hidden;
  background: linear-gradient(168deg, #ffffff 0%, #f8fdf9 100%);
  border: 1px solid rgba(15, 90, 54, 0.09);
  border-radius: 26px;
  box-shadow:
    0 1px 1px rgba(6, 74, 44, 0.04),
    0 10px 22px -12px rgba(6, 74, 44, 0.16),
    0 26px 48px -20px rgba(6, 74, 44, 0.24);
  transition:
    transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
    border-color 0.35s ease;
}

/* Slim top accent rule in the card's own hue - the "distinctive treatment"
   that separates the three without introducing new off-brand colors. */
.impact-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: linear-gradient(90deg, var(--impact-accent-1), var(--impact-accent-2));
}

/* Soft glow bleeding in from the top-right corner, tinted to match the
   accent - adds depth/richness without a heavy decorative graphic. */
.impact-card::after {
  content: '';
  position: absolute;
  top: -40%;
  right: -20%;
  width: 65%;
  height: 140%;
  background: radial-gradient(closest-side, var(--impact-glow), transparent 72%);
  pointer-events: none;
}

.impact-card:hover {
  border-color: rgba(15, 90, 54, 0.16);
  box-shadow:
    0 1px 1px rgba(6, 74, 44, 0.04),
    0 14px 28px -12px rgba(6, 74, 44, 0.2),
    0 34px 60px -18px rgba(6, 74, 44, 0.3);
  transform: translateY(-6px);
}

.impact-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: clamp(64px, 6vw, 78px);
  height: clamp(64px, 6vw, 78px);
  min-width: clamp(64px, 6vw, 78px);
  place-items: center;
  color: #ffffff;
  background: linear-gradient(150deg, var(--impact-accent-1), var(--impact-accent-2));
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 12px 22px -6px var(--impact-glow);
  font-size: clamp(28px, 2.6vw, 34px);
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.impact-card:hover .impact-icon {
  transform: scale(1.06) rotate(-3deg);
}

.impact-text {
  position: relative;
  z-index: 1;
}

.impact-title {
  color: #123524;
  font-size: clamp(17px, 1.7vw, 20px);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.impact-caption {
  margin-top: 4px;
  color: #5c7c6d;
  font-size: clamp(13px, 1.2vw, 14.5px);
  font-weight: 500;
  line-height: 1.45;
}

.empty-state {
  padding: 56px 24px;
  text-align: center;
  color: #087f49;
  background: white;
  border: 1px solid #e3ece2;
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0, 82, 45, 0.06);
}

.site-footer {
  color: white;
  background: linear-gradient(135deg, #06492d, #087f49);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  margin: 0 auto;
  padding: 26px 40px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.footer-logo {
  width: 54px;
  height: 54px;
  object-fit: contain;
  background: white;
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(0, 35, 19, 0.2);
}

.footer-title {
  font-size: 20px;
  font-weight: 950;
}

.footer-caption {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.footer-developer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-left: auto;
}

.footer-partner-logo {
  display: block;
  max-width: 200px;
  height: 92px;
  object-fit: contain;
}

.footer-partner-logo--buu {
  width: 170px;
}

.footer-partner-logo--samngam {
  width: 92px;
}

.footer-partner-logo--chandrakasem {
  width: 74px;
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  width: 100%;
  margin: 0 auto;
  padding: 12px 40px 16px;
  color: rgba(255, 255, 255, 0.68);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 12px;
  font-weight: 700;
}

.footer-social {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-contact-link {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
  transition:
    color 0.18s ease,
    text-decoration-color 0.18s ease;
}

.footer-contact-link:hover {
  color: #ffffff;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.footer-dev-logo {
  height: 130px;
  width: auto;
  object-fit: contain;
  border-radius: 4px;
}

.social-label {
  color: rgba(255, 255, 255, 0.86);
  font-size: 18px;
  font-weight: 900;
}

.social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: white;
  border-radius: 999px;
  font-weight: 950;
  line-height: 1;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}

.social-facebook {
  background: #1877f2;
  font-family: Arial, sans-serif;
  font-size: 29px;
}

.social-tiktok {
  background: #050505;
  font-size: 21px;
}

.social-instagram {
  background: #d62976;
  font-size: 24px;
}

.social-youtube {
  background: #e62117;
}

.youtube-play {
  width: 0;
  height: 0;
  margin-left: 3px;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-left: 12px solid white;
}

.social-line {
  background: #39c35a;
  font-size: 9px;
  letter-spacing: -0.3px;
}

.register-dialog-card {
  position: relative;
  width: min(1080px, calc(100vw - 64px));
  max-width: min(1080px, calc(100vw - 64px));
  max-height: min(720px, 92vh);
  display: grid;
  grid-template-columns: 44% 56%;
  overflow: hidden;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 28px 90px rgba(0, 72, 40, 0.28);
}

.q-card.register-dialog-card {
  max-width: min(1080px, calc(100vw - 64px));
}

:global(.login-modal-dialog .q-dialog__backdrop) {
  background: rgba(7, 25, 17, 0.46);
  backdrop-filter: blur(9px);
  -webkit-backdrop-filter: blur(9px);
}

.login-visual {
  position: relative;
  z-index: 2;
  min-height: 520px;
  overflow: hidden;
  background: #dcefe1;
  transform-origin: left center;
  transition:
    transform 0.82s cubic-bezier(0.76, 0, 0.24, 1),
    border-radius 0.82s cubic-bezier(0.76, 0, 0.24, 1),
    box-shadow 0.82s ease;
  will-change: transform;
}

.login-visual img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.login-visual-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 72, 40, 0.03), rgba(0, 88, 51, 0.82));
}

.login-visual-text {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  width: min(280px, calc(100% - 48px));
  text-align: center;
  color: white;
  transform: translate(-50%, -50%);
}

.login-visual-text img {
  width: 62px;
  height: 62px;
  border-radius: 16px;
  object-fit: cover;
  background: white;
  box-shadow: 0 16px 34px rgba(0, 62, 35, 0.24);
}

.login-visual-title {
  font-size: 26px;
  font-weight: 950;
  line-height: 1.15;
}

.login-visual-caption {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 14px;
}

.register-form-panel {
  min-width: 0;
  max-height: min(720px, 92vh);
  overflow-y: auto;
  padding: clamp(34px, 4vw, 48px);
  background: #ffffff;
  transition:
    opacity 0.28s ease,
    transform 0.36s ease;
}

.register-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.register-dialog-head h2 {
  margin: 16px 0 6px;
  color: #06492d;
  font-size: clamp(34px, 4vw, 46px);
  font-weight: 950;
  line-height: 1;
}

.register-dialog-head p {
  margin: 0;
  color: #5c7769;
  font-weight: 800;
  line-height: 1.6;
}

.register-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.register-actions {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
  margin-top: 22px;
}

.dialog-secondary-btn {
  min-height: 48px;
  border-radius: 999px;
  color: #087f49;
  background: #f3faf3;
  font-weight: 900;
}

.register-success-card {
  width: min(430px, calc(100vw - 32px));
  padding: 34px 30px 26px;
  text-align: center;
  border-radius: 20px;
  background: radial-gradient(circle at 50% 0, rgba(219, 244, 223, 0.86), transparent 46%), #ffffff;
}

.register-reference {
  margin-top: 18px;
  padding: 14px 16px;
  color: #06492d;
  background: #edf8ee;
  border-radius: 12px;
  font-size: 20px;
  font-weight: 950;
}

.register-success-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 24px 0 0;
}

.application-status-card {
  width: min(520px, calc(100vw - 32px));
  padding: 34px 32px 28px;
  border-radius: 20px;
  background: radial-gradient(circle at 50% 0, rgba(219, 244, 223, 0.86), transparent 46%), #ffffff;
  box-shadow: 0 28px 80px rgba(0, 72, 40, 0.24);
}

.status-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.status-dialog-head h2 {
  margin: 16px 0 6px;
  color: #06492d;
  font-size: 34px;
  font-weight: 950;
  line-height: 1;
}

.status-dialog-head p {
  margin: 0;
  color: #5c7769;
  font-weight: 800;
}

.status-check-btn {
  margin-top: 14px;
}

.application-status-result {
  margin-top: 22px;
  padding: 22px;
  border: 1px solid #d6e8db;
  border-radius: 18px;
  background: #f8fbf8;
}

.application-status-result h3 {
  margin: 16px 0 4px;
  color: #06492d;
  font-size: 24px;
  font-weight: 950;
}

.status-reference {
  color: #6d8a7c;
  font-size: 13px;
  font-weight: 900;
}

.application-status-result p {
  margin: 16px 0 0;
  color: #17452e;
  font-weight: 800;
  line-height: 1.6;
}

.application-status-empty {
  margin-top: 18px;
  padding: 18px;
  color: #6d8a7c;
  text-align: center;
  background: #f8fbf8;
  border: 1px dashed #c7ddce;
  border-radius: 14px;
  font-weight: 800;
}

.application-status-badge {
  padding: 7px 12px;
  border-radius: 999px;
  font-weight: 900;
}

.application-status-badge.pending {
  color: #9a5a00;
  background: #fff4d6;
}

.application-status-badge.reviewing {
  color: #075985;
  background: #e0f2fe;
}

.application-status-badge.approved {
  color: #087f49;
  background: #dbf4df;
}

.application-status-badge.rejected {
  color: #b91c1c;
  background: #fee2e2;
}

.register-status-link {
  margin-top: 14px;
}

.auth-switch-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  align-items: center;
  margin-top: 18px;
  color: #5c7769;
  font-size: 13px;
  font-weight: 800;
}

.auth-switch-row button {
  padding: 0;
  color: #087f49;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 950;
}

.auth-switch-row button:hover {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.success-check {
  display: grid;
  width: 88px;
  height: 88px;
  place-items: center;
  color: white;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  border-radius: 999px;
  font-size: 48px;
  box-shadow: 0 18px 34px rgba(0, 102, 58, 0.2);
  animation: success-pop 0.54s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.success-title {
  margin-top: 22px;
  color: #06492d;
  font-size: 30px;
  font-weight: 950;
}

.success-caption {
  margin-top: 8px;
  color: #5c7769;
  font-weight: 800;
}

@keyframes success-pop {
  0% {
    opacity: 0;
    transform: scale(0.45);
  }

  72% {
    transform: scale(1.08);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.login-dialog-card.is-login-leaving .login-visual {
  z-index: 4;
  border-radius: 20px;
  box-shadow: -26px 0 48px rgba(0, 72, 40, 0.22);
  transform: translateX(100%) scaleX(1.09);
}

.login-dialog-card.is-login-leaving .login-form-panel {
  opacity: 0;
  transform: translateX(-22px);
}

.login-dialog-badge {
  gap: 8px;
  padding: 8px 14px;
  color: #087f49;
  background: #dbf4df;
  border-radius: 999px;
  font-weight: 900;
}

:deep(.dialog-input .q-field__control) {
  height: 52px;
  min-width: 0;
  border-radius: 999px;
  background: #f8fbf8;
}

:deep(.dialog-input .q-field__control:before) {
  border-color: #d6e8db;
}

:deep(.dialog-input .q-field__control:hover:before) {
  border-color: #0a8b51;
}

:deep(.dialog-input.q-field--focused .q-field__control:after) {
  border-color: #087f49;
  border-width: 2px;
}

:deep(.dialog-input .q-field__prepend),
:deep(.dialog-input .q-field__append) {
  color: #087f49;
}

.dialog-submit-btn {
  min-height: 56px;
  border-radius: 999px;
  color: white;
  background: linear-gradient(135deg, #0a8b51, #006f42);
  font-size: 16px;
  font-weight: 900;
  box-shadow: 0 18px 34px rgba(0, 102, 58, 0.22);
}

@media (max-width: 1100px) {
  .news-section {
    padding-inline: 24px;
  }

  .impact-section {
    margin-top: -20px;
    padding-inline: 24px;
  }
}

@media (max-width: 900px) {
  .footer-inner {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-developer {
    justify-content: flex-start;
    margin-left: 0;
  }

  .footer-bottom {
    flex-wrap: wrap;
  }

  .impact-section {
    margin-top: -16px;
  }

  .impact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .impact-card {
    min-height: 108px;
    padding: 22px 20px;
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .register-dialog-card {
    grid-template-columns: 1fr;
    width: min(560px, calc(100vw - 28px));
    max-width: min(560px, calc(100vw - 28px));
    min-width: 0;
  }

  .login-visual {
    min-height: 180px;
  }

  .register-form-panel {
    max-height: calc(92vh - 180px);
    padding: 32px 28px 30px;
  }
}

@media (max-width: 640px) {
  .top-toolbar {
    min-height: 64px;
    padding: 0 12px;
  }

  .brand {
    gap: 10px;
  }

  /* Icon-only header buttons leave room for the full name, so wrap it onto a
     second line instead of truncating it to an ellipsis. */
  .brand-name {
    font-size: 17px;
    line-height: 1.25;
    white-space: normal;
  }

  .brand-logo {
    width: 42px;
    height: 42px;
  }

  .header-actions {
    gap: 6px;
  }

  /* Icon-only on phones. !important because Quasar renders the label span with
     its `.block` utility class (display: block !important). */
  .register-btn :deep(.q-btn__content span),
  .login-btn :deep(.q-btn__content span) {
    display: none !important;
  }

  /* Quasar keeps the icon's `.on-left` gap (margin-right: 12px) meant for the
     hidden label, which pushes the icon off-center. */
  .register-btn :deep(.q-icon.on-left),
  .login-btn :deep(.q-icon.on-left) {
    margin-right: 0;
  }

  .register-btn,
  .login-btn {
    min-width: 40px;
    padding: 0;
  }

  .news-section {
    padding-inline: 18px;
  }

  /* Starts below the banner on phones rather than over it, so none of the
     banner is hidden (see .hero-section below). */
  .impact-section {
    margin-top: 0;
    padding-inline: 18px;
  }

  /* Phones: the banner frame takes the banner's own shape, taken from the
     frame's real width (the page is padded here, so 100vw would overshoot), so
     the picture fills it edge to edge with nothing cropped and no bands. The
     180px floor and the desktop safe zone used to make the frame taller than a
     landscape banner, which left blurred bands above and below it. */
  .hero-section {
    --hero-safe-zone: 0px;
    height: auto;
    aspect-ratio: var(--hero-ratio);
    min-height: 120px;
    max-height: min(560px, 64vh);
  }

  /* Nothing overlaps the banner's bottom edge here any more. */
  .hero-dots {
    bottom: 10px;
  }

  .footer-inner {
    padding: 24px 12px;
  }

  .footer-bottom {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px 12px 16px;
  }

  .footer-social {
    gap: 9px;
  }

  .footer-contact-link {
    align-self: flex-end;
    margin-left: 0;
  }

  .social-label {
    width: 100%;
    font-size: 16px;
  }

  .impact-grid {
    grid-template-columns: 1fr;
  }

  .impact-card {
    align-items: center;
    min-height: 0;
    padding: 20px 18px;
    gap: 16px;
  }

  .impact-icon {
    width: 58px;
    height: 58px;
    min-width: 58px;
    font-size: 26px;
    border-radius: 18px;
  }

  .register-dialog-card {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    min-width: 0;
    border-radius: 16px;
  }

  .login-visual {
    display: none;
  }

  .register-form-panel {
    max-height: min(76vh, 620px);
    padding: 30px 22px 26px;
  }

  .register-actions,
  .register-form-grid,
  .register-success-actions {
    grid-template-columns: 1fr;
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 420px) {
  .brand {
    gap: 8px;
  }

  .brand-logo {
    width: 38px;
    height: 38px;
  }

  .brand-name {
    font-size: 15px;
  }

  .register-btn,
  .login-btn {
    min-height: 36px;
    min-width: 36px;
    padding: 0;
  }

  .footer-inner {
    gap: 18px;
    padding: 22px 8px;
  }

  .footer-brand {
    align-items: flex-start;
  }

  .footer-developer {
    align-items: flex-start;
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
  }

  .footer-logo {
    width: 46px;
    height: 46px;
  }

  .footer-partner-logo {
    height: 70px;
  }

  .footer-partner-logo--buu {
    width: 130px;
  }

  .footer-partner-logo--samngam {
    width: 70px;
  }

  .footer-partner-logo--chandrakasem {
    width: 58px;
  }

  .footer-title {
    font-size: 18px;
  }

  .footer-caption {
    font-size: 12px;
  }

  .footer-bottom {
    padding-inline: 8px;
    font-size: 11px;
  }

  .footer-social {
    gap: 7px;
  }

  .social-label {
    font-size: 15px;
  }

  .social-icon {
    width: 32px;
    height: 32px;
  }

  .social-facebook {
    font-size: 26px;
  }

  .social-tiktok {
    font-size: 19px;
  }

  .social-instagram {
    font-size: 21px;
  }

  .youtube-play {
    border-top-width: 6px;
    border-bottom-width: 6px;
    border-left-width: 10px;
  }

  .social-line {
    font-size: 8px;
  }
}
</style>
