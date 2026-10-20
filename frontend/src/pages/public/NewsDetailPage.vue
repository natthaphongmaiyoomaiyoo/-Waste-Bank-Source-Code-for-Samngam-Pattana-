<template>
  <q-layout view="hHh lpR fFf" class="detail-layout">
    <q-page-container>
      <q-page class="detail-page">
        <div class="detail-shell">
          <q-btn flat no-caps icon="arrow_back" label="กลับหน้าข่าวสาร" class="back-btn" to="/" />

          <template v-if="news">
            <!-- The whole photo at its own shape; a tall poster is capped in height
                 and its blurred colours fill the sides. -->
            <div class="detail-hero">
              <div
                class="detail-hero-backdrop"
                :style="{ backgroundImage: `url(${JSON.stringify(news.image)})` }"
              ></div>
              <img :src="news.image" :alt="news.title" />
            </div>

            <article class="detail-article">
              <div class="detail-date">
                <q-icon name="event" size="16px" />
                {{ formatThaiDate(news.date) }}
              </div>
              <h1 class="detail-title">{{ news.title }}</h1>
              <p class="detail-body">{{ news.details }}</p>
            </article>
          </template>

          <q-card v-else flat class="detail-empty">
            <q-icon name="campaign" size="52px" />
            <div class="text-h6 text-weight-bold q-mt-md">ไม่พบข่าวที่คุณต้องการ</div>
            <div class="text-grey-7">ข่าวนี้อาจถูกลบหรือไม่มีอยู่ในระบบแล้ว</div>
            <q-btn unelevated no-caps label="กลับหน้าข่าวสาร" class="detail-empty-btn q-mt-lg" to="/" />
          </q-card>
        </div>
      </q-page>
    </q-page-container>

    <AppFooter />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppFooter from 'components/AppFooter.vue';
import { useNewsStore, formatThaiDate } from 'src/stores/newsStore';

const route = useRoute();
const newsStore = useNewsStore();

onMounted(() => {
  void newsStore.fetchNews({ visibleOnly: true });
});

const news = computed(() => {
  const id = Number(route.params.id);
  return Number.isNaN(id) ? null : newsStore.getById(id);
});
</script>

<style scoped>
.detail-layout {
  background: #f6fbf6;
}

.detail-page {
  min-height: 100vh;
  padding: 28px 20px 70px;
  background: #ffffff;
}

.detail-shell {
  width: min(820px, 100%);
  margin: 0 auto;
}

.back-btn {
  margin-bottom: 20px;
  color: #087f49;
  font-weight: 800;
}

.detail-hero {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  background: #0f2a1c;
  box-shadow: 0 20px 48px rgba(0, 82, 45, 0.12);
  isolation: isolate;
}

.detail-hero-backdrop {
  position: absolute;
  inset: -40px;
  z-index: -1;
  background-position: center;
  background-size: cover;
  filter: blur(32px) saturate(1.1);
}

.detail-hero img {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(75vh, 820px);
  object-fit: contain;
}

.detail-article {
  padding: 32px 4px 0;
}

.detail-date {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #087f49;
  font-size: 13.5px;
  font-weight: 800;
}

.detail-title {
  margin: 14px 0 22px;
  color: #0b2c1c;
  font-size: clamp(24px, 3.4vw, 36px);
  font-weight: 950;
  line-height: 1.28;
}

.detail-body {
  max-width: 680px;
  margin: 0;
  color: #3c453f;
  font-size: 16px;
  line-height: 1.9;
  white-space: pre-line;
}

.detail-empty {
  padding: 64px 24px;
  text-align: center;
  color: #087f49;
  background: white;
  border: 1px solid #e3ece2;
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0, 82, 45, 0.06);
}

.detail-empty-btn {
  min-height: 44px;
  padding: 0 22px;
  color: white;
  background: #087f49;
  border-radius: 999px;
  font-weight: 900;
}

@media (max-width: 640px) {
  .detail-page {
    padding: 20px 16px 50px;
  }

  .detail-hero {
    border-radius: 16px;
  }

  .detail-article {
    padding: 24px 0 0;
  }
}
</style>
