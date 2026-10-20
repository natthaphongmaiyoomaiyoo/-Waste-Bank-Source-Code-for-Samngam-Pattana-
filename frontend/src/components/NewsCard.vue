<template>
  <router-link :to="`/news/${news.id}`" class="news-card">
    <div class="news-card-media">
      <!-- The whole photo shows; its own blurred colours fill the rest of the frame. -->
      <div
        class="news-card-backdrop"
        :style="{ backgroundImage: `url(${JSON.stringify(news.image)})` }"
      ></div>
      <q-img :src="news.image" ratio="4/3" fit="contain" class="news-image" />
      <div class="news-card-chip">
        <q-icon :name="icon" />
      </div>
    </div>
    <div class="news-card-body">
      <div class="news-card-date">
        <q-icon name="event" size="13px" class="q-mr-xs" />
        {{ formatThaiDate(news.date) }}
      </div>
      <h3 class="news-card-title">{{ news.title }}</h3>
      <p class="news-card-excerpt">{{ news.details }}</p>
      <div class="news-card-link">
        อ่านเพิ่มเติม
        <q-icon name="arrow_forward" size="14px" />
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import type { NewsItem } from 'src/data/news';
import { formatThaiDate } from 'src/stores/newsStore';

defineProps<{
  news: NewsItem;
  icon: string;
}>();
</script>

<style scoped>
.news-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 20px;
  box-shadow: 0 14px 34px rgba(0, 82, 45, 0.08);
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.news-card:hover {
  border-color: #9ad4a4;
  box-shadow: 0 20px 44px rgba(0, 82, 45, 0.14);
  transform: translateY(-3px);
}

.news-card-media {
  position: relative;
  min-height: 270px;
  overflow: hidden;
}

.news-card-backdrop {
  position: absolute;
  inset: -30px;
  background-position: center;
  background-size: cover;
  filter: blur(24px) saturate(1.1);
}

.news-image {
  width: 100%;
  height: 100%;
}

.news-card-chip {
  position: absolute;
  z-index: 1;
  top: 14px;
  left: 14px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #087f49;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 999px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.news-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 20px 22px 22px;
}

.news-card-date {
  display: flex;
  align-items: center;
  color: #7c877f;
  font-size: 12.5px;
  font-weight: 800;
}

.news-card-title {
  display: -webkit-box;
  margin: 10px 0 8px;
  overflow: hidden;
  color: #0b2c1c;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.news-card-excerpt {
  display: -webkit-box;
  flex: 1;
  margin: 0 0 16px;
  overflow: hidden;
  color: #64756b;
  font-size: 13.5px;
  line-height: 1.62;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.news-card-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  color: #087f49;
  font-size: 13px;
  font-weight: 900;
}
</style>
