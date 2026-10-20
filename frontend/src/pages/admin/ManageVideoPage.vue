<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="video_library" />
          </div>
          <div class="hero-copy">
            <h1>จัดการวิดีโอคัดแยกขยะ</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เพิ่มวิดีโอใหม่"
            class="hero-add-btn"
            @click="openAddDialog"
          />
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายการวิดีโอคัดแยกขยะ"
          :caption="`ทั้งหมด ${filteredVideoList.length.toLocaleString()} รายการ`"
        >
          <template #filters>
            <div class="filter-row">
              <MidFilterBar
                v-model:search="search"
                search-label="ค้นหาชื่อวิดีโอ หรือคำอธิบาย"
                title="ตัวกรองวิดีโอ"
                :active="activeFilters"
                @clear="clearFilter"
                @clear-all="clearAllFilters"
              >
                <q-select
                  v-model="filterCategory"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="หมวดหมู่ขยะ"
                  :options="categoryFilterOptions"
                />
                <q-select
                  v-model="filterType"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="ประเภทวิดีโอ"
                  :options="[
                    { label: 'YouTube', value: 'youtube' },
                    { label: 'ไฟล์อัปโหลด (MP4)', value: 'file' },
                  ]"
                />
                <q-select
                  v-model="filterStatus"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="สถานะเผยแพร่"
                  :options="[
                    { label: 'เผยแพร่', value: 'active' },
                    { label: 'ซ่อน', value: 'inactive' },
                  ]"
                />
              </MidFilterBar>
            </div>
          </template>
        </AdminPanelHeader>

        <q-table
          flat
          row-key="id"
          class="muni-table"
          :grid="true"
          :rows="filteredVideoList"
          :columns="columns"
          :loading="videoStore.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="[6, 9, 12, 18, 24]"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>

          <template #item="props">
            <div class="q-pa-sm col-12 col-sm-6 col-md-4">
              <q-card class="video-card flat bordered" style="border-radius: 12px; height: 100%; display: flex; flex-direction: column; overflow: hidden;">
                <!-- 16:9 Video Preview Section -->
                <div class="video-card-media-wrapper" @click="openPlayModal(props.row)">
                  <!-- 1. YouTube Thumbnail (หรือภาพ Cover ถ้ามี) -->
                  <img
                    v-if="(isYouTubeUrl(props.row.videoUrl) || props.row.coverUrl) && !failedVideoIds[props.row.id]"
                    :src="videoThumbnailUrl(props.row) || ''"
                    alt=""
                    class="video-card-thumb"
                    loading="lazy"
                    @error="markVideoFailed(props.row.id)"
                  />

                  <!-- 2. MP4 Video Preview (ดึงเฟรมวินาทีที่ 0.5 มาเป็นภาพนิ่งอัตโนมัติ) -->
                  <video
                    v-else-if="props.row.videoUrl && !failedVideoIds[props.row.id]"
                    :src="`${getVideoFullUrl(props.row.videoUrl)}#t=0.5`"
                    preload="metadata"
                    muted
                    playsinline
                    class="video-card-thumb pointer-events-none"
                    @error="markVideoFailed(props.row.id)"
                  />

                  <!-- 3. Fallback & Placeholder เมื่อโหลดภาพไม่สำเร็จหรือไม่มีไฟล์ -->
                  <div v-else class="video-card-thumb-fallback">
                    <div class="fallback-icon-wrap">
                      <q-icon name="movie" size="36px" />
                    </div>
                  </div>

                  <!-- Play button overlay -->
                  <div class="video-play-overlay">
                    <div class="video-play-btn">
                      <q-icon name="play_arrow" size="28px" />
                    </div>
                  </div>

                  <!-- Badges on top corners -->
                  <div class="video-badges-row">
                    <q-badge
                      color="teal-9"
                      class="q-py-xs q-px-sm text-weight-bold shadow-1"
                      style="background: rgba(13, 148, 136, 0.92); backdrop-filter: blur(4px); border-radius: 6px;"
                    >
                      {{ props.row.category || 'ทั่วไป' }}
                    </q-badge>

                    <q-badge
                      v-if="isYouTubeUrl(props.row.videoUrl)"
                      color="red-9"
                      class="q-py-xs q-px-sm text-weight-bold shadow-1 row items-center"
                      style="background: rgba(220, 38, 38, 0.92); backdrop-filter: blur(4px); border-radius: 6px; gap: 4px;"
                    >
                      <q-icon name="smart_display" size="13px" />
                      YouTube
                    </q-badge>
                    <q-badge
                      v-else
                      color="positive"
                      class="q-py-xs q-px-sm text-weight-bold shadow-1 row items-center"
                      style="background: rgba(16, 185, 129, 0.92); backdrop-filter: blur(4px); border-radius: 6px; gap: 4px;"
                    >
                      <q-icon name="movie" size="13px" />
                      MP4
                    </q-badge>
                  </div>
                </div>

                <!-- Middle Content -->
                <q-card-section class="q-pa-md col-grow">
                  <div
                    class="text-subtitle1 text-weight-bold ellipsis-2-lines q-mb-xs"
                    style="line-height: 1.35; color: #16352a;"
                    :title="props.row.title"
                  >
                    {{ props.row.title }}
                  </div>
                  <div class="row items-center text-caption text-grey-6 q-mb-xs" style="gap: 4px;">
                    <q-icon name="event" size="14px" />
                    <span>{{ formatThaiDate(props.row.postedAt) }}</span>
                  </div>
                  <p
                    v-if="props.row.description"
                    class="text-caption text-grey-7 ellipsis-2-lines q-mb-none q-mt-xs"
                    style="line-height: 1.5;"
                  >
                    {{ props.row.description }}
                  </p>
                </q-card-section>

                <q-separator />

                <!-- Footer matching VillagePage -->
                <q-card-actions class="q-px-md q-py-xs bg-grey-1 row items-center justify-between">
                  <div class="row items-center">
                    <q-toggle
                      :model-value="props.row.isActive"
                      color="positive"
                      dense
                      size="sm"
                      :label="props.row.isActive ? 'เผยแพร่' : 'ซ่อน'"
                      :class="['text-caption text-weight-bold', props.row.isActive ? 'text-positive' : 'text-grey-7']"
                      @update:model-value="(val) => void toggleActive(props.row, val === true)"
                    >
                      <q-tooltip>{{ props.row.isActive ? 'กำลังเผยแพร่บนหน้าแรก - กดเพื่อซ่อน' : 'ซ่อนอยู่ - กดเพื่อเผยแพร่' }}</q-tooltip>
                    </q-toggle>
                  </div>

                  <div class="row items-center" style="gap: 4px;">
                    <q-btn
                      flat
                      dense
                      round
                      icon="edit"
                      color="primary"
                      size="sm"
                      @click="editVideo(props.row)"
                    >
                      <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      dense
                      round
                      icon="delete"
                      color="red-7"
                      size="sm"
                      @click="deleteVideo(props.row.id)"
                    >
                      <q-tooltip>ลบวิดีโอ</q-tooltip>
                    </q-btn>
                  </div>
                </q-card-actions>
              </q-card>
            </div>
          </template>

          <template #no-data>
            <div class="full-width column flex-center q-py-xl text-grey-6">
              <q-icon name="videocam_off" size="52px" class="q-mb-sm text-grey-4" />
              <div class="text-subtitle1 text-weight-bold">ไม่พบข้อมูลวิดีโอ</div>
              <div class="text-caption text-grey-6">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง</div>
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Dialog Add/Edit Video -->
    <q-dialog v-model="isDialogOpen" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEditing ? 'edit' : 'video_call'" />
            </div>
            {{ isEditing ? 'แก้ไขวิดีโอ' : 'เพิ่มวิดีโอใหม่' }}
          </div>
          <q-btn flat dense round icon="close" v-close-popup :disable="isSaving" />
        </div>

        <div class="dialog-body">
          <div class="form-grid q-mb-sm">
            <MidDateField
              v-model="formData.date"
              class="span-6"
              label="วันที่เผยแพร่ *"
              required
              buddhist-year
            />
            <q-select
              v-model="formData.category"
              outlined
              dense
              emit-value
              map-options
              class="span-6"
              label="หมวดหมู่ประเภทขยะ *"
              :options="categoryOptions"
            />
            <q-input v-model="formData.title" label="หัวข้อวิดีโอ *" outlined dense class="span-12" />
          </div>

          <div class="q-mb-md">
            <div class="field-label">รูปแบบวิดีโอ *</div>
            <q-btn-toggle
              v-model="videoType"
              spread
              no-caps
              unelevated
              toggle-color="positive"
              color="grey-2"
              text-color="grey-9"
              class="video-type-toggle"
              :options="[
                { label: 'ลิงก์ YouTube', value: 'link', icon: 'smart_display' },
                { label: 'อัปโหลดไฟล์วิดีโอ (MP4)', value: 'file', icon: 'video_file' },
              ]"
            />
          </div>

          <q-input
            v-if="videoType === 'link'"
            v-model="formData.videoUrl"
            label="ลิงก์วิดีโอ (YouTube URL) *"
            outlined
            dense
            placeholder="https://www.youtube.com/watch?v=..."
            class="q-mb-md"
            :disable="isSaving"
          >
            <template #append>
              <q-icon name="smart_display" color="red" />
            </template>
          </q-input>

          <div v-else class="q-mb-md">
            <!-- แสดงข้อมูลไฟล์วิดีโอเดิมเมื่ออยู่ในโหมดแก้ไข -->
            <div
              v-if="isEditing && existingVideoUrl && !videoFile"
              class="existing-video-card q-pa-sm q-mb-sm"
            >
              <div class="row items-center justify-between no-wrap">
                <div class="row items-center no-wrap ellipsis" style="gap: 8px;">
                  <q-icon name="check_circle" color="positive" size="20px" />
                  <div class="ellipsis">
                    <div class="text-caption text-weight-bold text-positive">มีไฟล์วิดีโอเดิมอยู่ในระบบแล้ว</div>
                    <div class="text-caption text-grey-7 ellipsis">หากไม่ต้องการเปลี่ยนไฟล์ สามารถกดบันทึกได้ทันที</div>
                  </div>
                </div>
                <q-btn
                  flat
                  dense
                  no-caps
                  color="positive"
                  icon="play_circle"
                  label="ดูวิดีโอเดิม"
                  class="q-ml-sm"
                  @click="previewExistingVideo"
                />
              </div>
            </div>

            <q-file
              v-model="videoFile"
              :label="isEditing && existingVideoUrl ? 'เลือกไฟล์ใหม่เพื่อแทนที่ไฟล์เดิม (หากต้องการ)' : 'เลือกไฟล์วิดีโอ (.mp4, .webm, .mov) *'"
              outlined
              dense
              clearable
              accept="video/mp4,video/webm,video/quicktime,video/ogg"
              :disable="isSaving"
              @update:model-value="onVideoFileSelected"
            >
              <template #prepend>
                <q-icon name="movie" color="primary" />
              </template>
              <template #hint>
                รองรับไฟล์ MP4, WEBM, MOV ขนาดไม่เกิน 50MB
              </template>
            </q-file>
          </div>

          <q-input
            v-model="formData.description"
            label="คำอธิบาย / รายละเอียด"
            type="textarea"
            rows="3"
            outlined
            dense
            class="q-mb-md"
            :disable="isSaving"
          />

          <q-toggle
            v-model="formData.isActive"
            color="positive"
            label="เผยแพร่บนหน้าแรกทันที"
            class="q-mb-sm"
            :disable="isSaving"
          />

          <!-- Upload Progress Bar (แสดงขณะกำลังอัปโหลด) -->
          <div v-if="isUploading" class="upload-progress-container q-mt-sm q-pa-sm">
            <div class="row items-center justify-between q-mb-xs">
              <div class="row items-center text-caption text-weight-bold text-positive" style="gap: 6px;">
                <q-spinner-dots size="16px" color="positive" />
                <span>{{ uploadPercent < 100 ? 'กำลังอัปโหลดไฟล์วิดีโอ...' : 'อัปโหลดเสร็จสิ้น กำลังบันทึกข้อมูล...' }}</span>
              </div>
              <div class="text-caption text-weight-bold text-grey-8">
                {{ uploadPercent }}% ({{ uploadLoadedMB }} MB / {{ uploadTotalMB }} MB)
              </div>
            </div>
            <q-linear-progress
              :value="uploadPercent / 100"
              rounded
              size="10px"
              color="positive"
              track-color="green-1"
            />
            <div class="row justify-end q-mt-xs">
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                color="negative"
                icon="close"
                label="ยกเลิกการอัปโหลด"
                @click="cancelUpload"
              />
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" v-close-popup :disable="isSaving" />
          <q-btn
            unelevated
            no-caps
            color="positive"
            icon="save"
            :label="saveButtonLabel"
            :loading="isSaving"
            @click="saveVideo"
          />
        </div>
      </q-card>
    </q-dialog>

    <!-- Modal เล่นวิดีโอ (YouTube & MP4) -->
    <q-dialog v-model="playModalOpen">
      <q-card style="width: 760px; max-width: 95vw; background: #111; border-radius: 16px; overflow: hidden; color: white;">
        <div class="row items-center justify-between q-px-md q-py-sm" style="background: #1a1a1a; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div class="row items-center no-wrap ellipsis" style="gap: 8px;">
            <q-icon
              :name="isYouTubeUrl(playingVideo?.videoUrl) ? 'smart_display' : 'movie'"
              :color="isYouTubeUrl(playingVideo?.videoUrl) ? 'red' : 'positive'"
              size="22px"
            />
            <span class="text-weight-bold text-subtitle2 ellipsis">{{ playingVideo?.title }}</span>
          </div>
          <div class="row items-center" style="gap: 4px;">
            <q-btn
              v-if="isYouTubeUrl(playingVideo?.videoUrl)"
              flat
              dense
              round
              icon="open_in_new"
              color="white"
              :href="getVideoFullUrl(playingVideo?.videoUrl)"
              target="_blank"
            >
              <q-tooltip>เปิดใน YouTube</q-tooltip>
            </q-btn>
            <q-btn flat round dense icon="close" color="white" v-close-popup />
          </div>
        </div>
        <div style="aspect-ratio: 16/9; background: #000; display: flex; align-items: center; justify-content: center;">
          <iframe
            v-if="playingVideo && isYouTubeUrl(playingVideo.videoUrl)"
            :src="`https://www.youtube.com/embed/${getYouTubeId(playingVideo.videoUrl)}?autoplay=1&rel=0`"
            :title="playingVideo.title"
            style="width: 100%; height: 100%; border: 0;"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
          <video
            v-else-if="playingVideo"
            :src="getVideoFullUrl(playingVideo.videoUrl)"
            controls
            autoplay
            style="width: 100%; height: 100%; object-fit: contain;"
          ></video>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { QTableColumn } from 'quasar';
import { useVideoStore, type VideoItem } from 'src/stores/videoStore';
import {
  MidDateField,
  MidFilterBar,
  MidTablePagination,
  midConfirm,
  midNotify,
  useRememberedPagination,
  type MidActiveFilter,
} from 'components/MID';
import { formatThaiDate } from '../municipality/format';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import {
  isYouTubeUrl,
  getYouTubeId,
  getVideoFullUrl,
  videoThumbnailUrl,
} from 'src/utils/videoMedia';

const videoStore = useVideoStore();

const columns: QTableColumn[] = [
  {
    name: 'date',
    label: 'วันที่',
    field: 'postedAt',
    align: 'left',
    sortable: true,
    format: (val: string) => formatThaiDate(val),
  },
  {
    name: 'title',
    label: 'ชื่อวิดีโอ',
    field: 'title',
    align: 'left',
    sortable: true,
  },
  {
    name: 'category',
    label: 'หมวดหมู่',
    field: 'category',
    align: 'center',
    sortable: true,
  },
  {
    name: 'status',
    label: 'สถานะเผยแพร่',
    field: 'isActive',
    align: 'center',
    sortable: true,
  },
  { name: 'actions', label: 'จัดการ', field: 'actions', align: 'right' },
];

const categoryOptions = [
  { label: 'ทั่วไป / ภาพรวม', value: 'ทั่วไป' },
  { label: 'ขยะพลาสติก (Plastic)', value: 'พลาสติก' },
  { label: 'ขยะกระดาษ (Paper)', value: 'กระดาษ' },
  { label: 'ขยะแก้ว/ขวดแก้ว (Glass)', value: 'แก้ว' },
  { label: 'ขยะโลหะ/กระป๋อง (Metal)', value: 'โลหะ' },
  { label: 'ขยะอันตราย (Hazardous)', value: 'ขยะอันตราย' },
];
const categoryFilterOptions = categoryOptions;

// Search & Filter State
const search = ref('');
const filterCategory = ref<string | null>(null);
const filterType = ref<'youtube' | 'file' | null>(null);
const filterStatus = ref<'active' | 'inactive' | null>(null);

const activeFilters = computed<MidActiveFilter[]>(() => {
  const list: MidActiveFilter[] = [];
  if (filterCategory.value) {
    list.push({
      key: 'category',
      label: 'หมวดหมู่',
      value: filterCategory.value,
    });
  }
  if (filterType.value) {
    list.push({
      key: 'type',
      label: 'ประเภท',
      value: filterType.value === 'youtube' ? 'YouTube' : 'ไฟล์อัปโหลด (MP4)',
    });
  }
  if (filterStatus.value) {
    list.push({
      key: 'status',
      label: 'สถานะ',
      value: filterStatus.value === 'active' ? 'เผยแพร่' : 'ซ่อน',
    });
  }
  return list;
});

function clearFilter(key: string) {
  if (key === 'category') filterCategory.value = null;
  if (key === 'type') filterType.value = null;
  if (key === 'status') filterStatus.value = null;
}

function clearAllFilters() {
  filterCategory.value = null;
  filterType.value = null;
  filterStatus.value = null;
  search.value = '';
}

const filteredVideoList = computed(() => {
  let list = videoStore.items;

  // Search filter
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.category && v.category.toLowerCase().includes(q)),
    );
  }

  // Category filter
  if (filterCategory.value) {
    list = list.filter((v) => (v.category || 'ทั่วไป') === filterCategory.value);
  }

  // Type filter
  if (filterType.value === 'youtube') {
    list = list.filter((v) => isYouTubeUrl(v.videoUrl));
  } else if (filterType.value === 'file') {
    list = list.filter((v) => !isYouTubeUrl(v.videoUrl));
  }

  // Status filter
  if (filterStatus.value === 'active') {
    list = list.filter((v) => v.isActive);
  } else if (filterStatus.value === 'inactive') {
    list = list.filter((v) => !v.isActive);
  }

  return list;
});

const pagination = useRememberedPagination('admin-videos', {
  sortBy: 'date',
  descending: true,
  page: 1,
  rowsPerPage: 9,
});

const isDialogOpen = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);

const videoType = ref<'link' | 'file'>('link');
const videoFile = ref<File | null>(null);
const existingVideoUrl = ref('');

// Playback Modal State (สำหรับไฟล์ MP4)
const playModalOpen = ref(false);
const playingVideo = ref<VideoItem | null>(null);

// Fallback tracking สำหรับวิดีโอ/รูปภาพที่โหลดไม่สำเร็จ
const failedVideoIds = ref<Record<number, boolean>>({});

function markVideoFailed(id: number) {
  failedVideoIds.value[id] = true;
}

function openPlayModal(row: VideoItem) {
  playingVideo.value = row;
  playModalOpen.value = true;
}

function previewExistingVideo() {
  if (existingVideoUrl.value) {
    playingVideo.value = {
      id: formData.value.id,
      title: formData.value.title || 'วิดีโอเดิม',
      videoUrl: existingVideoUrl.value,
      category: formData.value.category,
      isActive: formData.value.isActive,
      postedAt: dayToPostedAt(formData.value.date),
    };
    playModalOpen.value = true;
  }
}

// Upload Progress & Cancellation State
const isUploading = ref(false);
const uploadPercent = ref(0);
const uploadLoadedMB = ref('0');
const uploadTotalMB = ref('0');
let abortController: AbortController | null = null;

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function onVideoFileSelected(file: File | null | undefined) {
  if (!file) return;
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    midNotify({
      type: 'warning',
      message: `ขนาดไฟล์ (${sizeMB} MB) เกินกำหนด 50 MB! กรุณาเลือกไฟล์ใหม่`,
    });
    videoFile.value = null;
  }
}

function cancelUpload() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isSaving.value = false;
  isUploading.value = false;
  uploadPercent.value = 0;
  midNotify({ type: 'info', message: 'ยกเลิกการอัปโหลดแล้ว' });
}

const saveButtonLabel = computed(() => {
  if (isUploading.value) {
    return uploadPercent.value < 100
      ? `กำลังอัปโหลด ${uploadPercent.value}%`
      : 'กำลังประมวลผล...';
  }
  if (isSaving.value) return 'กำลังบันทึก...';
  return isEditing.value ? 'บันทึกการแก้ไข' : 'เพิ่มวิดีโอ';
});

const formData = ref({
  id: 0,
  date: '',
  title: '',
  category: 'ทั่วไป',
  videoUrl: '',
  description: '',
  isActive: true,
});

onMounted(() => {
  void videoStore.fetchVideos();
});

function openAddDialog() {
  isEditing.value = false;
  videoType.value = 'link';
  videoFile.value = null;
  existingVideoUrl.value = '';
  isUploading.value = false;
  uploadPercent.value = 0;
  const today = new Date();
  const d = String(today.getDate()).padStart(2, '0');
  const m = String(today.getMonth() + 1).padStart(2, '0');
  formData.value = {
    id: 0,
    date: `${today.getFullYear()}-${m}-${d}`,
    title: '',
    category: 'ทั่วไป',
    videoUrl: '',
    description: '',
    isActive: true,
  };
  isDialogOpen.value = true;
}

function editVideo(row: VideoItem) {
  isEditing.value = true;
  videoFile.value = null;
  isUploading.value = false;
  uploadPercent.value = 0;

  const isYoutube = isYouTubeUrl(row.videoUrl);
  videoType.value = isYoutube ? 'link' : 'file';
  existingVideoUrl.value = isYoutube ? '' : row.videoUrl;

  formData.value = {
    id: row.id,
    date: isoDay(row.postedAt),
    title: row.title,
    category: row.category || 'ทั่วไป',
    // ถ้าเป็น YouTube ให้ใส่ URL เดิม แต่ถ้าเป็นไฟล์อัปโหลด ไม่ต้องใส่ในช่อง URL ของ YouTube
    videoUrl: isYoutube ? row.videoUrl : '',
    description: row.description || '',
    isActive: row.isActive,
  };
  isDialogOpen.value = true;
}

async function toggleActive(row: VideoItem, value: boolean) {
  try {
    await videoStore.updateVideo(row.id, { isActive: value });
    midNotify({
      type: 'success',
      message: value ? 'เผยแพร่วิดีโอบนหน้าแรกแล้ว' : 'ซ่อนวิดีโอจากหน้าแรกแล้ว',
    });
  } catch (err: unknown) {
    console.error(err);
    midNotify({ type: 'error', message: 'ไม่สามารถเปลี่ยนสถานะเผยแพร่ได้' });
  }
}

async function deleteVideo(id: number) {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: 'คุณต้องการลบวิดีโอนี้ใช่หรือไม่?',
    tone: 'danger',
    confirmLabel: 'ลบวิดีโอ',
  });
  if (!confirmed) return;
  try {
    await videoStore.deleteVideo(id);
    midNotify({ type: 'success', message: 'ลบวิดีโอเรียบร้อยแล้ว' });
  } catch (err: unknown) {
    console.error(err);
    midNotify({ type: 'error', message: 'ไม่สามารถลบวิดีโอได้' });
  }
}

function isoDay(postedAt: string): string {
  return postedAt.slice(0, 10);
}

function dayToPostedAt(day: string): string {
  return `${day}T00:00:00.000Z`;
}

async function saveVideo() {
  if (!formData.value.title.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุหัวข้อวิดีโอ' });
    return;
  }

  if (videoType.value === 'link' && !formData.value.videoUrl.trim()) {
    midNotify({ type: 'warning', message: 'กรุณาระบุลิงก์วิดีโอ YouTube' });
    return;
  }

  if (videoType.value === 'link' && !isYouTubeUrl(formData.value.videoUrl.trim())) {
    midNotify({ type: 'warning', message: 'ลิงก์วิดีโอต้องเป็น URL ของ YouTube ที่ถูกต้อง' });
    return;
  }

  if (videoType.value === 'file' && !videoFile.value && (!isEditing.value || !existingVideoUrl.value)) {
    midNotify({ type: 'warning', message: 'กรุณาเลือกไฟล์วิดีโอ (MP4)' });
    return;
  }

  isSaving.value = true;
  isUploading.value = Boolean(videoType.value === 'file' && videoFile.value);
  uploadPercent.value = 0;
  uploadLoadedMB.value = '0';
  uploadTotalMB.value = '0';

  let currentAbortController: AbortController | null = null;
  if (isUploading.value) {
    currentAbortController = new AbortController();
    abortController = currentAbortController;
  }

  try {
    if (videoType.value === 'file' && videoFile.value) {
      const data = new FormData();
      data.append('title', formData.value.title.trim());
      data.append('category', formData.value.category);
      data.append('video', videoFile.value);
      data.append('isActive', String(formData.value.isActive));
      if (formData.value.description.trim()) {
        data.append('description', formData.value.description.trim());
      }
      if (formData.value.date) {
        data.append('postedAt', dayToPostedAt(formData.value.date));
      }

      const options = {
        signal: currentAbortController?.signal,
        onProgress: (percent: number, loaded: number, total: number) => {
          uploadPercent.value = percent;
          uploadLoadedMB.value = (loaded / (1024 * 1024)).toFixed(1);
          uploadTotalMB.value = (total / (1024 * 1024)).toFixed(1);
        },
      };

      if (isEditing.value) {
        await videoStore.updateVideo(formData.value.id, data, options);
      } else {
        await videoStore.addVideo(data, options);
      }
    } else {
      const payload: {
        title: string;
        category: string;
        description?: string | undefined;
        isActive: boolean;
        postedAt?: string | undefined;
        videoUrl?: string | undefined;
      } = {
        title: formData.value.title.trim(),
        category: formData.value.category,
        description: formData.value.description.trim() || undefined,
        isActive: formData.value.isActive,
        postedAt: formData.value.date ? dayToPostedAt(formData.value.date) : undefined,
      };

      if (videoType.value === 'link') {
        payload.videoUrl = formData.value.videoUrl.trim();
      }

      if (isEditing.value) {
        await videoStore.updateVideo(formData.value.id, payload);
      } else {
        await videoStore.addVideo(payload as { title: string; videoUrl: string });
      }
    }

    midNotify({
      type: 'success',
      message: isEditing.value ? 'แก้ไขวิดีโอเรียบร้อยแล้ว' : 'เพิ่มวิดีโอเรียบร้อยแล้ว',
    });
    isDialogOpen.value = false;
  } catch (err: unknown) {
    if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError') {
      return;
    }
    console.error(err);
    midNotify({ type: 'error', message: 'ไม่สามารถบันทึกวิดีโอได้' });
  } finally {
    isSaving.value = false;
    isUploading.value = false;
    abortController = null;
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

.filter-row {
  padding: 18px 28px;
}

@media (max-width: 599px) {
  .filter-row {
    padding: 12px 16px;
  }
}

.video-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);

    .video-play-btn {
      transform: scale(1.1);
      background: #087f49;
    }

    .video-card-thumb {
      transform: scale(1.04);
    }
  }
}

.video-card-media-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0b1a13;
  overflow: hidden;
  cursor: pointer;
}

.pointer-events-none {
  pointer-events: none;
}

.video-card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  pointer-events: none;
}

.video-card-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(16, 185, 129, 0.22) 0%, rgba(15, 28, 22, 0.96) 75%), #0c1c14;

  .fallback-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  }
}

.video-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.35);
  }
}

.video-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(11, 122, 71, 0.92);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease, background 0.2s ease;
}

.video-badges-row {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.ellipsis-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.field-label {
  margin-bottom: 6px;
  color: #5f6f66;
  font-size: 13px;
  font-weight: 600;
}

.video-type-toggle {
  border: 1px solid #dfe9e2;
  border-radius: 12px;
  overflow: hidden;
}

.existing-video-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}

.upload-progress-container {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 10px;
}
</style>
