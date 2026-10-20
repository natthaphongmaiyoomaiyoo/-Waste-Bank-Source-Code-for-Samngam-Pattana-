<template>
  <article class="video-card">
    <div class="video-card-media">
      <iframe
        v-if="playing && embedUrl"
        :src="embedUrl"
        :title="video.title"
        class="video-card-frame"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>

      <video
        v-else-if="playing"
        :src="fileUrl"
        class="video-card-frame"
        controls
        autoplay
        playsinline
        preload="metadata"
      ></video>

      <!-- Click-to-play facade: only the thumbnail loads with the page; the actual
           player (YouTube iframe / video file) is created when the user presses play. -->
      <button
        v-else
        type="button"
        class="video-card-poster"
        :aria-label="`เล่นวิดีโอ ${video.title}`"
        @click="emit('play')"
      >
        <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="" loading="lazy" />
        <video
          v-else-if="fileUrl"
          :src="`${fileUrl}#t=0.5`"
          preload="metadata"
          muted
          playsinline
          class="video-card-poster-video"
        ></video>
        <div v-else class="video-card-poster-fallback">
          <q-icon name="movie" />
        </div>
        <span class="video-card-play">
          <q-icon name="play_arrow" />
        </span>
      </button>
    </div>

    <div class="video-card-body">
      <div class="video-card-meta">
        <span class="video-card-date">
          <q-icon name="event" size="13px" />
          {{ postedDate }}
        </span>
        <span v-if="video.category" class="video-card-chip">{{ video.category }}</span>
      </div>
      <h3 class="video-card-title">{{ video.title }}</h3>
      <p v-if="video.description" class="video-card-desc">{{ video.description }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { VideoItem } from 'src/stores/videoStore';
import {
  getYouTubeId,
  getVideoFullUrl,
  videoThumbnailUrl,
} from 'src/utils/videoMedia';

const props = defineProps<{
  video: VideoItem;
  playing: boolean;
}>();

const emit = defineEmits<{ (e: 'play'): void }>();

// postedAt is an ISO timestamp (formatThaiDate only understands DD/MM/YYYY), so
// format it directly on the Thai calendar day, e.g. "16 ก.ย. 2569".
const postedDate = computed(() =>
  new Date(props.video.postedAt).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
);

const youTubeId = computed(() => getYouTubeId(props.video.videoUrl));

const embedUrl = computed(() =>
  youTubeId.value
    ? `https://www.youtube.com/embed/${youTubeId.value}?autoplay=1&rel=0&modestbranding=1`
    : null,
);

const fileUrl = computed(() => getVideoFullUrl(props.video.videoUrl));

const thumbnailUrl = computed(() => videoThumbnailUrl(props.video));
</script>

<style scoped>
.video-card {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 20px;
  box-shadow: 0 18px 40px rgba(0, 82, 45, 0.12);
}

.video-card-media {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #06331f;
}

.video-card-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  object-fit: contain;
}

.video-card-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.video-card-poster img,
.video-card-poster video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.video-card-poster-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.55);
  background: linear-gradient(135deg, #0a5a36, #06331f);
  font-size: 64px;
}

.video-card-play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: clamp(58px, 7vw, 76px);
  height: clamp(58px, 7vw, 76px);
  place-items: center;
  color: white;
  background: rgba(8, 127, 73, 0.92);
  border-radius: 999px;
  font-size: clamp(32px, 4vw, 42px);
  box-shadow: 0 16px 34px rgba(0, 40, 22, 0.4);
  transform: translate(-50%, -50%);
  transition:
    transform 0.22s ease,
    background 0.22s ease;
}

.video-card-poster:hover .video-card-play {
  background: #0a8b51;
  transform: translate(-50%, -50%) scale(1.08);
}

.video-card-body {
  padding: 18px 22px 20px;
}

.video-card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.video-card-date {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #7c877f;
  font-size: 12.5px;
  font-weight: 800;
}

.video-card-chip {
  padding: 3px 12px;
  color: #0f766e;
  background: #d8f3ef;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.video-card-title {
  margin: 10px 0 6px;
  color: #0b2c1c;
  font-size: clamp(16px, 1.8vw, 19px);
  font-weight: 900;
  line-height: 1.35;
}

.video-card-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #64756b;
  font-size: 13.5px;
  line-height: 1.62;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style>
