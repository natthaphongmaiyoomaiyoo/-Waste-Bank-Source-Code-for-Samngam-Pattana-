<template>
  <div
    ref="rootEl"
    :class="['media-carousel', { 'is-wide': wide }]"
    role="region"
    aria-roledescription="carousel"
    :aria-label="label"
  >
    <div
      class="carousel-viewport"
      @pointerenter="onPointerEnter"
      @pointerleave="isHovered = false"
      @focusin="onFocusIn"
      @focusout="isFocused = false"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @click.capture="onViewportClick"
    >
      <div
        class="carousel-track"
        :class="{ 'no-transition': !animate }"
        :style="{ '--slide-index': position }"
        @transitionend.self="settle"
      >
        <component
          :is="slide.item.to ? RouterLink : 'button'"
          v-for="(slide, index) in slides"
          :key="slide.key"
          v-bind="slide.item.to ? { to: slide.item.to } : { type: 'button' }"
          :class="['carousel-slide', { 'is-letterboxed': letterboxed[slide.item.id] }]"
          :style="mediaStyle(slide.item.id)"
          :data-slide-id="slide.item.id"
          :aria-hidden="slide.clone ? 'true' : undefined"
          :tabindex="slide.clone ? -1 : undefined"
          @focus="goTo(index)"
          @click="onSlideClick(slide.item)"
        >
          <div
            v-if="slide.item.image"
            class="slide-backdrop"
            :style="{ backgroundImage: `url(${JSON.stringify(slide.item.image)})` }"
          ></div>
          <div :class="['slide-media', { 'slide-media--empty': !slide.item.image && !slide.item.videoUrl }]">
            <!-- 1. รูปภาพปก (News หรือ YouTube หรือ MP4 ที่มีภาพ Cover) -->
            <img
              v-if="slide.item.image"
              :src="slide.item.image"
              alt=""
              class="slide-image"
              @load="onImageLoad(slide.item.id, $event)"
            />
            <!-- 2. ไฟล์วิดีโอ MP4 (ดึงเฟรมวินาทีที่ 0.5 มาเป็นภาพพรีวิวอัตโนมัติ) -->
            <video
              v-else-if="slide.item.videoUrl && !isYouTubeUrl(slide.item.videoUrl)"
              :src="`${getVideoFullUrl(slide.item.videoUrl)}#t=0.5`"
              preload="metadata"
              muted
              playsinline
              class="slide-image pointer-events-none"
            />
            <span v-if="slide.item.play" class="slide-play">
              <q-icon name="play_arrow" />
            </span>
          </div>
          <div class="slide-panel">
            <div class="slide-label">{{ slide.item.label }}</div>
            <h3 class="slide-title">{{ slide.item.title }}</h3>
            <span class="slide-action">
              {{ slide.item.action }}
              <q-icon :name="slide.item.actionIcon" size="15px" />
            </span>
          </div>
        </component>
      </div>
    </div>

    <div v-if="items.length > 1" class="carousel-controls">
      <button
        type="button"
        class="carousel-pause"
        :aria-label="isPaused ? `เล่นสไลด์${itemName}ต่อ` : `หยุดสไลด์${itemName}`"
        @click="isPaused = !isPaused"
      >
        <!-- The ring is the autoplay clock: its fill animation ending moves to the next slide. -->
        <svg viewBox="0 0 36 36" class="pause-ring" aria-hidden="true">
          <circle cx="18" cy="18" r="16" pathLength="100" class="ring-track" />
          <circle
            :key="cycle"
            cx="18"
            cy="18"
            r="16"
            pathLength="100"
            class="ring-progress"
            :style="{ animationPlayState: isRunning ? 'running' : 'paused' }"
            @animationend="next"
          />
        </svg>
        <q-icon :name="isPaused ? 'play_arrow' : 'pause'" class="pause-icon" />
      </button>

      <div class="carousel-arrows">
        <button
          type="button"
          class="carousel-arrow"
          :aria-label="`${itemName}ก่อนหน้า`"
          @click="prev"
        >
          <q-icon name="west" />
        </button>
        <button type="button" class="carousel-arrow" :aria-label="`${itemName}ถัดไป`" @click="next">
          <q-icon name="east" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { CarouselSlide } from './mediaCarousel';
import { isYouTubeUrl, getVideoFullUrl } from 'src/utils/videoMedia';

const props = withDefaults(
  defineProps<{
    items: CarouselSlide[];
    // aria-label of the whole carousel, e.g. the section title.
    label: string;
    // Noun for the control labels: "ข่าว" -> "ข่าวถัดไป", "หยุดสไลด์ข่าว".
    itemName: string;
    // 16:9 media (videos) instead of the default photo frame.
    wide?: boolean;
    // Holds the autoplay while true, e.g. while the parent's player dialog is open.
    hold?: boolean;
  }>(),
  { wide: false, hold: false },
);

const emit = defineEmits<{ select: [id: number] }>();

// Keep in sync with the track's transition-duration below.
const SLIDE_MS = 600;
const SWIPE_MIN_PX = 40;

// The list is repeated so neighbours always peek on both sides; the middle copy
// is the real one and the track snaps back into it after each move.
const copies = computed(() => {
  const n = props.items.length;
  return n > 1 ? 2 * Math.ceil(3 / n) + 1 : 1;
});
const middleCopy = computed(() => Math.floor(copies.value / 2));
const slides = computed(() =>
  Array.from({ length: copies.value }, (_, copy) =>
    props.items.map((item) => ({
      key: `${copy}-${item.id}`,
      item,
      clone: copy !== middleCopy.value,
    })),
  ).flat(),
);

const position = ref(0);
const animate = ref(true);
const isMoving = ref(false);
const cycle = ref(0);
const isPaused = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const isHovered = ref(false);
const isFocused = ref(false);
const isRunning = computed(
  () => !isPaused.value && !isHovered.value && !isFocused.value && !props.hold,
);

let settleTimer: number | undefined;
let touchStart: { x: number; y: number } | null = null;
let swallowClick = false;

function jumpTo(index: number) {
  animate.value = false;
  position.value = index;
  // Let the browser paint the jump before transitions come back on.
  requestAnimationFrame(() => requestAnimationFrame(() => (animate.value = true)));
}

watch(
  () => props.items.map((item) => item.id).join(','),
  () => {
    window.clearTimeout(settleTimer);
    isMoving.value = false;
    jumpTo(middleCopy.value * props.items.length);
    cycle.value += 1;
  },
  { immediate: true },
);

function goTo(index: number) {
  if (isMoving.value || index === position.value || props.items.length < 2) return;
  isMoving.value = true;
  position.value = index;
  cycle.value += 1;
  window.clearTimeout(settleTimer);
  // transitionend never fires if the move is interrupted or the tab is hidden.
  settleTimer = window.setTimeout(settle, SLIDE_MS + 150);
}

function settle() {
  window.clearTimeout(settleTimer);
  if (!isMoving.value) return;
  isMoving.value = false;
  const n = props.items.length;
  const base = middleCopy.value * n;
  const home = base + ((((position.value - base) % n) + n) % n);
  if (home !== position.value) jumpTo(home);
}

function next() {
  goTo(position.value + 1);
}

function prev() {
  goTo(position.value - 1);
}

function onSlideClick(item: CarouselSlide) {
  if (!item.to) emit('select', item.id);
}

function onPointerEnter(event: PointerEvent) {
  // Touch "hover" would stick after a tap and silently stop the autoplay.
  if (event.pointerType === 'mouse') isHovered.value = true;
}

// Only keyboard focus holds the autoplay; a clicked card keeps focus afterwards
// (e.g. when a dialog closes) and would otherwise stop it for good.
function onFocusIn(event: FocusEvent) {
  isFocused.value = (event.target as HTMLElement).matches(':focus-visible');
}

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  swallowClick = false;
}

function onTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0];
  if (!touchStart || !touch) return;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
  swallowClick = true;
  if (dx < 0) next();
  else prev();
}

// A swipe that ends on a card must not also open it.
function onViewportClick(event: MouseEvent) {
  if (!swallowClick) return;
  swallowClick = false;
  event.preventDefault();
  event.stopPropagation();
}

// --- Photo frames (news; videos keep their fixed 16:9 frame) ---------------------
// The frame takes each photo's own shape within limits (see the CSS), so the photo
// fills it with at most a thin edge cropped. Only a shape too far outside those
// limits (a very wide banner) would lose more than MAX_CROP to filling - that one
// is shown whole over its blurred backdrop instead.
const MAX_CROP = 0.2;
const rootEl = ref<HTMLElement | null>(null);
// Natural width / height per slide id, measured as each image loads.
const imageRatios = ref<Record<number, number>>({});
const letterboxed = ref<Record<number, boolean>>({});

function mediaStyle(id: number) {
  const ratio = imageRatios.value[id];
  return !props.wide && ratio ? { '--img-ratio': ratio.toFixed(4) } : undefined;
}

function onImageLoad(id: number, event: Event) {
  if (props.wide) return;
  const img = event.target as HTMLImageElement;
  if (!img.naturalWidth || !img.naturalHeight || imageRatios.value[id]) return;
  imageRatios.value = { ...imageRatios.value, [id]: img.naturalWidth / img.naturalHeight };
  void nextTick(measureFrames);
}

// Compares each photo with the frame it actually got (the limits depend on the
// screen width), so it reruns whenever the carousel is resized.
function measureFrames() {
  const root = rootEl.value;
  if (!root || props.wide) return;
  const next: Record<number, boolean> = {};
  for (const [id, ratio] of Object.entries(imageRatios.value)) {
    const media = root.querySelector<HTMLElement>(`[data-slide-id="${id}"] .slide-media`);
    const box = media?.getBoundingClientRect();
    if (!box?.width || !box.height) continue;
    const frame = box.width / box.height;
    next[Number(id)] = 1 - Math.min(ratio / frame, frame / ratio) > MAX_CROP;
  }
  letterboxed.value = next;
}

let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  if (props.wide || !rootEl.value) return;
  resizeObserver = new ResizeObserver(() => measureFrames());
  resizeObserver.observe(rootEl.value);
});

onBeforeUnmount(() => {
  window.clearTimeout(settleTimer);
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.media-carousel {
  --card-w: min(736px, 62vw);
  --card-h: 344px;
  --gap: 26px;
  /* Media height as a share of its width; 0 = fill the fixed-height card. */
  --media-pad: 0;
  /* Full-bleed, so the neighbouring cards run off both edges of the screen. */
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

.media-carousel.is-wide {
  --card-w: min(880px, 66vw);
  --media-pad: 56.25%;
}

.carousel-viewport {
  overflow: hidden;
  /* clip, not hidden: focusing an off-screen card must not scroll the viewport. */
  overflow: clip;
  padding: 6px 0;
  touch-action: pan-y;
}

.carousel-track {
  display: flex;
  gap: var(--gap);
  transform: translateX(
    calc(50% - var(--card-w) / 2 - var(--slide-index) * (var(--card-w) + var(--gap)))
  );
  transition: transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.carousel-track.no-transition {
  transition: none;
}

/* --- Card: text panel on the image's own blurred colours, image beside it --- */
.carousel-slide {
  /* The photo's width / height (set per slide once it loads). */
  --img-ratio: 1.3333;
  position: relative;
  display: grid;
  flex: 0 0 var(--card-w);
  grid-template-areas: 'panel media';
  /* The photo column follows the photo's shape at the card's height, kept between
     40% and 70% of the card so the text panel always has room. */
  grid-template-columns: minmax(0, 1fr) clamp(40%, calc(var(--card-h) * var(--img-ratio)), 70%);
  height: var(--card-h);
  padding: 0;
  overflow: hidden;
  font: inherit;
  text-align: left;
  text-decoration: none;
  background: #1d2a22;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
  isolation: isolate;
}

.is-wide .carousel-slide {
  grid-template-columns: minmax(0, 1fr) 64%;
  height: auto;
}

.carousel-slide:focus-visible {
  outline: 3px solid #087f49;
  outline-offset: 3px;
}

.slide-backdrop {
  position: absolute;
  inset: -40px;
  z-index: -1;
  background-position: center;
  background-size: cover;
  filter: blur(30px) saturate(1.15);
}

.slide-media {
  position: relative;
  grid-area: media;
  overflow: hidden;
}

/* No image (a video without a cover): a plain green frame for the play badge. */
.slide-media--empty {
  background: linear-gradient(135deg, #0a5a36, #06331f);
}

.slide-media::before {
  content: '';
  display: block;
  padding-top: var(--media-pad);
}

.pointer-events-none {
  pointer-events: none;
}

/* The photo fills its frame (no bands). For videos, cover also trims YouTube's
   letterbox bars. */
.slide-image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
  pointer-events: none;
}

/* A photo too far from any frame shape (measureFrames) shows whole instead, over
   the card's blurred backdrop. */
.is-letterboxed .slide-image {
  object-fit: contain;
}

.carousel-slide:hover .slide-image {
  transform: scale(1.03);
}

.slide-play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  color: white;
  background: rgba(8, 127, 73, 0.92);
  border-radius: 999px;
  font-size: 36px;
  box-shadow: 0 14px 30px rgba(0, 40, 22, 0.4);
  transform: translate(-50%, -50%);
  transition: transform 0.22s ease;
}

.carousel-slide:hover .slide-play {
  transform: translate(-50%, -50%) scale(1.08);
}

.slide-panel {
  position: relative;
  z-index: 1;
  display: flex;
  grid-area: panel;
  flex-direction: column;
  min-width: 0;
  padding: 30px 26px 26px;
  /* A news card is a link, and the app-wide link colour would turn this text green. */
  color: white;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.58));
}

.slide-label {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  opacity: 0.9;
}

.slide-title {
  display: -webkit-box;
  margin: 0 0 18px;
  overflow: hidden;
  font-size: 21px;
  font-weight: 800;
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  line-clamp: 5;
}

.is-wide .slide-title {
  -webkit-line-clamp: 4;
  line-clamp: 4;
}

.slide-action {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  margin-top: auto;
  padding: 8px 18px;
  color: #111;
  background: white;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

/* --- Controls: pause (with autoplay ring) | prev / next ---------------------- */
.carousel-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: var(--card-w);
  margin: 20px auto 0;
}

.carousel-pause {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  place-items: center;
  color: #0b2c1c;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.pause-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track,
.ring-progress {
  fill: none;
  stroke-width: 2.5;
}

.ring-track {
  stroke: #d6e4da;
}

.ring-progress {
  stroke: #087f49;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  stroke-linecap: round;
  animation: ring-fill 6s linear forwards;
}

@keyframes ring-fill {
  to {
    stroke-dashoffset: 0;
  }
}

.pause-icon {
  font-size: 20px;
}

.carousel-arrows {
  display: flex;
  gap: 8px;
}

.carousel-arrow {
  display: grid;
  width: 52px;
  height: 34px;
  padding: 0;
  place-items: center;
  color: #0b2c1c;
  background: transparent;
  border: 1.5px solid #0b2c1c;
  border-radius: 999px;
  font-size: 22px;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}

.carousel-arrow:hover {
  color: white;
  background: #087f49;
  border-color: #087f49;
}

.carousel-pause:focus-visible,
.carousel-arrow:focus-visible {
  outline: 2px solid #087f49;
  outline-offset: 3px;
}

/* Below this a side-by-side card gets too narrow for the title: stack it. */
@media (max-width: 999px) {
  .media-carousel {
    --card-w: min(320px, 72vw);
    --gap: 14px;
    --media-pad: 75%;
  }

  .media-carousel.is-wide {
    --card-w: min(340px, 76vw);
    --media-pad: 56.25%;
  }

  .carousel-slide,
  .is-wide .carousel-slide {
    grid-template-areas:
      'media'
      'panel';
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    height: auto;
  }

  .carousel-slide {
    min-height: 460px;
  }

  /* Stacked news: the photo's height follows its shape, between 16:9 and a 4:5
     portrait poster (videos keep the 16:9 set on .is-wide). */
  .media-carousel:not(.is-wide) .carousel-slide {
    --media-pad: clamp(56.25%, calc(100% / var(--img-ratio)), 125%);
  }

  .is-wide .carousel-slide {
    min-height: 0;
  }

  .slide-panel {
    padding: 22px 22px 24px;
  }

  .slide-label {
    margin-bottom: 10px;
  }

  .slide-title {
    font-size: 18px;
  }

  .slide-title,
  .is-wide .slide-title {
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }

  .slide-play {
    width: 54px;
    height: 54px;
    font-size: 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .carousel-track {
    transition-duration: 0.01ms;
  }
}
</style>
