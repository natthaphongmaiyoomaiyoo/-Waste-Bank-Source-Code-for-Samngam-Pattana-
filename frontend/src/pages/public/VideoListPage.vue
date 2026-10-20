<template>
  <q-layout view="hHh lpR fFf" class="list-layout">
    <q-page-container>
      <q-page class="list-page">
        <div class="list-shell">
          <q-btn flat no-caps icon="arrow_back" label="กลับหน้าแรก" class="back-btn" to="/" />

          <SectionHeader icon="play_circle" title="วิดีโอการคัดแยกขยะทั้งหมด" />

          <div v-if="loading && !videos.length" class="video-grid">
            <q-skeleton v-for="n in 3" :key="n" type="rect" class="video-skeleton" animation="wave" />
          </div>

          <q-card v-else-if="error && !videos.length" flat class="empty-state">
            <q-icon name="cloud_off" size="52px" />
            <div class="text-h6 text-weight-bold q-mt-md">ไม่สามารถโหลดข้อมูลวิดีโอได้</div>
            <div class="text-grey-7">กรุณาตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</div>
            <q-btn
              unelevated
              no-caps
              icon="refresh"
              label="โหลดใหม่"
              class="retry-btn q-mt-md"
              @click="load"
            />
          </q-card>

          <div v-else-if="videos.length" class="video-grid">
            <VideoCard
              v-for="video in videos"
              :key="video.id"
              :video="video"
              :playing="playingId === video.id"
              @play="playingId = video.id"
            />
          </div>

          <q-card v-else flat class="empty-state">
            <q-icon name="videocam_off" size="52px" />
            <div class="text-h6 text-weight-bold q-mt-md">ยังไม่มีวิดีโอในขณะนี้</div>
            <div class="text-grey-7">รอติดตามสื่อความรู้การคัดแยกขยะได้ที่หน้านี้</div>
          </q-card>
        </div>
      </q-page>
    </q-page-container>

    <AppFooter />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import AppFooter from 'components/AppFooter.vue';
import SectionHeader from 'components/SectionHeader.vue';
import VideoCard from 'components/VideoCard.vue';
import { useVideoStore } from 'src/stores/videoStore';

const videoStore = useVideoStore();
const { loading, error } = storeToRefs(videoStore);

// Same safety net as VideoSection: the store is shared with the admin page,
// which loads unpublished videos too.
const videos = computed(() => videoStore.items.filter((item) => item.isActive));

// Only one player at a time - starting another card swaps the previous back to its poster.
const playingId = ref<number | null>(null);

function load() {
  void videoStore.fetchVideos({ activeOnly: true });
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

.video-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 24px;
}

.video-skeleton {
  aspect-ratio: 16 / 9;
  height: auto;
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

  .video-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }
}

@media (max-width: 640px) {
  .list-shell {
    padding: 20px 18px 50px;
  }

  .video-grid {
    grid-template-columns: 1fr;
  }
}
</style>
