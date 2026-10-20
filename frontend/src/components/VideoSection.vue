<template>
  <section class="video-section">
    <SectionHeader icon="play_circle" title="วิดีโอการคัดแยกขยะ" view-all-to="/videos" />

    <!-- Loading (first load only - background refreshes keep the current card visible) -->
    <div v-if="loading && !videos.length" class="video-loading">
      <q-skeleton type="rect" class="video-skeleton-media" animation="wave" />
      <q-skeleton type="text" width="35%" class="q-mt-md" />
      <q-skeleton type="text" width="65%" />
    </div>

    <q-card v-else-if="error && !videos.length" flat class="video-empty-state">
      <q-icon name="cloud_off" size="52px" />
      <div class="text-h6 text-weight-bold q-mt-md">ไม่สามารถโหลดข้อมูลวิดีโอได้</div>
      <div class="text-grey-7">กรุณาตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</div>
      <q-btn
        unelevated
        no-caps
        icon="refresh"
        label="โหลดใหม่"
        class="video-retry-btn q-mt-md"
        @click="reload"
      />
    </q-card>

    <q-card v-else-if="!videos.length" flat class="video-empty-state">
      <q-icon name="videocam_off" size="52px" />
      <div class="text-h6 text-weight-bold q-mt-md">ยังไม่มีวิดีโอในขณะนี้</div>
      <div class="text-grey-7">รอติดตามสื่อความรู้การคัดแยกขยะได้ที่หน้านี้</div>
    </q-card>

    <!-- Same slider as the news section; a card opens its video in a player dialog. -->
    <MediaCarousel
      v-else
      :items="videoSlides"
      label="วิดีโอการคัดแยกขยะ"
      item-name="วิดีโอ"
      wide
      :hold="isPlayerOpen"
      @select="openPlayer"
    />

    <q-dialog v-model="isPlayerOpen" @hide="playingId = null">
      <div v-if="playingVideo" class="video-player">
        <q-btn
          v-close-popup
          round
          unelevated
          icon="close"
          class="video-player-close"
          aria-label="ปิดวิดีโอ"
        />
        <VideoCard :video="playingVideo" :playing="true" />
      </div>
    </q-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useVideoStore } from 'src/stores/videoStore';
import MediaCarousel from 'components/MediaCarousel.vue';
import type { CarouselSlide } from 'components/mediaCarousel';
import SectionHeader from 'components/SectionHeader.vue';
import VideoCard from 'components/VideoCard.vue';
import { formatVideoDate, videoThumbnailUrl } from 'src/utils/videoMedia';

const videoStore = useVideoStore();
const { loading, error } = storeToRefs(videoStore);

// Server already filters with ?active=1, but the store is shared with the admin
// page (which loads everything), so filter again here as a safety net.
const videos = computed(() => videoStore.items.filter((item) => item.isActive));

const videoSlides = computed<CarouselSlide[]>(() =>
  videos.value.map((video) => ({
    id: video.id,
    image: videoThumbnailUrl(video),
    videoUrl: video.videoUrl,
    label: [formatVideoDate(video.postedAt), video.category].filter(Boolean).join(' · '),
    title: video.title,
    action: 'ดูวิดีโอ',
    actionIcon: 'play_arrow',
    play: true,
  })),
);

const isPlayerOpen = ref(false);
const playingId = ref<number | null>(null);
const playingVideo = computed(
  () => videos.value.find((item) => item.id === playingId.value) ?? null,
);

function openPlayer(id: number) {
  playingId.value = id;
  isPlayerOpen.value = true;
}

function reload() {
  void videoStore.fetchVideos({ activeOnly: true });
}

// Admin changes in another tab show up when the visitor comes back to this one.
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') reload();
}

onMounted(() => {
  reload();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

// A refresh can drop the playing video (admin unpublished/deleted it) - close the player.
watch(playingVideo, (video) => {
  if (!video) isPlayerOpen.value = false;
});
</script>

<style scoped>
.video-section {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 0 28px 70px;
}

.video-loading {
  overflow: hidden;
}

.video-skeleton-media {
  aspect-ratio: 16 / 9;
  height: auto;
  border-radius: 20px;
}

.video-empty-state {
  padding: 56px 24px;
  text-align: center;
  color: #087f49;
  background: white;
  border: 1px solid #e3ece2;
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0, 82, 45, 0.06);
}

.video-retry-btn {
  min-height: 42px;
  border-radius: 999px;
  padding: 0 22px;
  color: white;
  background: #006f42;
  font-weight: 800;
}

.video-player {
  position: relative;
  width: min(960px, 92vw);
  /* Quasar caps dialog content at 560px. */
  max-width: none !important;
}

.video-player-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  color: white;
  background: rgba(0, 0, 0, 0.55);
}

@media (max-width: 1100px) {
  .video-section {
    padding-inline: 24px;
  }
}

@media (max-width: 640px) {
  .video-section {
    padding-inline: 18px;
  }
}
</style>
