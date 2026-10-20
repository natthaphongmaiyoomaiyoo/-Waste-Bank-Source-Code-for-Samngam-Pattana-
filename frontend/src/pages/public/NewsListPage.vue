<template>
  <q-layout view="hHh lpR fFf" class="list-layout">
    <q-page-container>
      <q-page class="list-page">
        <div class="list-shell">
          <q-btn flat no-caps icon="arrow_back" label="กลับหน้าแรก" class="back-btn" to="/" />

          <SectionHeader icon="newspaper" title="ข่าวสารและกิจกรรมทั้งหมด" />

          <div v-if="newsStore.loading && !newsStore.items.length" class="news-grid">
            <q-skeleton v-for="n in 3" :key="n" type="rect" class="news-skeleton" animation="wave" />
          </div>

          <q-card v-else-if="newsStore.error && !newsStore.items.length" flat class="empty-state">
            <q-icon name="cloud_off" size="52px" />
            <div class="text-h6 text-weight-bold q-mt-md">{{ newsStore.error }}</div>
            <q-btn
              unelevated
              no-caps
              icon="refresh"
              label="โหลดใหม่"
              class="retry-btn q-mt-md"
              @click="load"
            />
          </q-card>

          <div v-else-if="newsStore.items.length" class="news-grid">
            <NewsCard
              v-for="(news, index) in newsStore.items"
              :key="news.id"
              :news="news"
              :icon="cardIcons[index % cardIcons.length] || 'eco'"
            />
          </div>

          <q-card v-else flat class="empty-state">
            <q-icon name="campaign" size="52px" />
            <div class="text-h6 text-weight-bold q-mt-md">ยังไม่มีข่าวสารในขณะนี้</div>
            <div class="text-grey-7">รอติดตามประกาศจากธนาคารขยะชุมชนได้ที่หน้านี้</div>
          </q-card>
        </div>
      </q-page>
    </q-page-container>

    <AppFooter />
  </q-layout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AppFooter from 'components/AppFooter.vue';
import NewsCard from 'components/NewsCard.vue';
import SectionHeader from 'components/SectionHeader.vue';
import { HOME_CARD_ICONS } from 'src/data/homeContent';
import { useNewsStore } from 'src/stores/newsStore';

const newsStore = useNewsStore();
const cardIcons = HOME_CARD_ICONS;

function load() {
  void newsStore.fetchNews({ visibleOnly: true });
}

onMounted(load);
</script>

<style scoped>
.list-layout {
  background: #f6fbf6;
}

.list-page {
  min-height: 100vh;
  background: #ffffff;
}

.list-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 28px 28px 70px;
}

.back-btn {
  color: #087f49;
  font-weight: 800;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.news-skeleton {
  height: 440px;
  border-radius: 20px;
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

.retry-btn {
  min-height: 42px;
  border-radius: 999px;
  padding: 0 22px;
  color: white;
  background: #006f42;
  font-weight: 800;
}

@media (max-width: 1100px) {
  .list-shell {
    padding-inline: 24px;
  }

  .news-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }
}

@media (max-width: 640px) {
  .list-shell {
    padding: 20px 18px 50px;
  }

  .news-grid {
    grid-template-columns: 1fr;
  }
}
</style>
