<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="edit_document" />
          </div>
          <div class="hero-copy">
            <h1>จัดการข่าวสารหน้าแรก</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เพิ่มข่าวใหม่"
            class="hero-add-btn"
            @click="openAddDialog"
          />
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="รายการข่าวสารทั้งหมด"
          :caption="`ทั้งหมด ${filteredNewsList.length.toLocaleString()} รายการ`"
          v-model:search="search"
          search-placeholder="ค้นหาหัวข้อ หรือ รายละเอียด"
        />

        <q-table
          :rows="filteredNewsList"
          :columns="columns"
          row-key="id"
          flat
          class="muni-table"
          :grid="true"
          v-model:pagination="pagination"
          :rows-per-page-options="[8, 12, 16, 24]"
          :loading="newsStore.loading"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>

          <template #item="props">
            <div class="q-pa-sm col-12 col-sm-6 col-md-4 col-lg-3">
              <q-card class="news-card flat bordered">
                <!-- ส่วนบน: รูปภาพหน้าปกข่าว 16:9 -->
                <div
                  class="news-card-media-wrapper group"
                  @click="props.row.image && !failedImageIds[props.row.id] ? openImagePreview(props.row.image) : null"
                >
                  <img
                    v-if="props.row.image && !failedImageIds[props.row.id]"
                    :src="props.row.image"
                    :alt="props.row.title"
                    class="news-card-thumb"
                    loading="lazy"
                    @error="markImageFailed(props.row.id)"
                  />
                  <!-- Fallback เมื่อไม่มีรูปภาพหรือโหลดรูปไม่สำเร็จ -->
                  <div v-else class="news-card-thumb-fallback">
                    <div class="fallback-icon-wrap">
                      <q-icon name="newspaper" size="36px" color="teal-7" />
                    </div>
                  </div>

                  <!-- Date badge overlay -->
                  <div class="news-date-badge">
                    <q-icon name="event" size="13px" class="q-mr-xs" />
                    <span>{{ formatThaiDate(props.row.date) }}</span>
                  </div>
                </div>

                <!-- ส่วนกลาง: Card Body เนื้อหาข่าว -->
                <q-card-section class="q-pa-md col-grow news-card-body">
                  <div class="row items-center text-caption text-grey-6 q-mb-xs" style="gap: 4px;">
                    <q-icon name="schedule" size="13px" />
                    <span>{{ formatThaiDate(props.row.date) }}</span>
                  </div>

                  <div
                    class="news-card-title text-subtitle1 text-weight-bold q-mb-xs"
                    :title="props.row.title"
                  >
                    {{ props.row.title }}
                  </div>

                  <p
                    v-if="props.row.details"
                    class="news-card-desc text-caption text-grey-7 q-mb-none"
                    :title="props.row.details"
                  >
                    {{ props.row.details }}
                  </p>
                  <p v-else class="text-caption text-grey-5 italic q-mb-none">
                    ไม่มีรายละเอียดเพิ่มเติม
                  </p>
                </q-card-section>

                <q-separator />

                <!-- ส่วนท้าย: Card Footer ชิดขอบล่าง -->
                <q-card-actions class="q-px-md q-py-xs bg-grey-1 row items-center justify-end" style="gap: 4px;">
                  <q-btn
                    flat
                    dense
                    round
                    icon="edit"
                    color="primary"
                    size="sm"
                    @click="editNews(props.row)"
                  >
                    <q-tooltip>แก้ไขข่าวสาร</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    round
                    icon="delete"
                    color="red-7"
                    size="sm"
                    @click="deleteNews(props.row.id)"
                  >
                    <q-tooltip>ลบข่าวสาร</q-tooltip>
                  </q-btn>
                </q-card-actions>
              </q-card>
            </div>
          </template>

          <template #no-data>
            <div class="full-width empty-state q-py-xl text-center text-grey-6">
              <q-icon name="newspaper" size="48px" class="q-mb-sm text-grey-4" />
              <div class="text-subtitle1 text-weight-medium">
                {{ search ? 'ไม่พบข่าวสารที่ตรงกับคำค้นหา' : 'ยังไม่มีข้อมูลข่าวสารในระบบ' }}
              </div>
              <div v-if="search" class="text-caption text-grey-5 q-mt-xs">
                ลองตรวจสอบคำสะกด หรือล้างคำค้นหา
              </div>
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <q-dialog v-model="isDialogOpen" persistent>
      <q-card class="admin-dialog dialog-md news-dialog">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEditing ? 'edit' : 'post_add'" />
            </div>
            {{ isEditing ? 'แก้ไขข่าวสาร' : 'เพิ่มข่าวใหม่' }}
          </div>
          <q-btn flat dense round icon="close" v-close-popup :disable="isSaving" />
        </div>

        <div class="dialog-body">
          <div class="form-grid q-mb-sm">
            <MidDateField
              v-model="formDate"
              class="span-6"
              label="วันที่ *"
              required
              buddhist-year
            />
            <q-input v-model="formData.title" label="หัวข้อข่าว *" outlined dense class="span-12" />
            <q-input
              v-model="formData.details"
              label="รายละเอียดแบบย่อ"
              type="textarea"
              outlined
              dense
              class="span-12"
              autogrow
            />
          </div>

          <div class="text-subtitle2 q-mb-xs text-grey-8">
            รูปภาพหน้าปก <span class="text-negative">*</span>
          </div>
          <div
            class="upload-dropzone q-mb-md"
            :class="{ 'dropzone-active': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="fileInput?.$el?.click()"
          >
            <q-file
              ref="fileInput"
              v-model="imageFile"
              class="hidden"
              accept="image/*"
              @update:model-value="isDragging = false"
            />
            <div v-if="!imagePreview && !formData.image" class="text-center text-grey-6 q-pa-lg">
              <q-icon name="cloud_upload" size="48px" color="positive" class="q-mb-sm" />
              <div class="text-subtitle1">ลากไฟล์รูปภาพมาวางที่นี่ หรือคลิกเพื่ออัปโหลด</div>
              <div class="text-caption">ขนาดไฟล์ไม่เกิน 2MB (JPG, PNG)</div>
            </div>
            
            <div v-else class="text-center">
              <div class="text-caption text-grey-7 q-mb-xs">รูปภาพหน้าปก:</div>
              <q-img
                :src="imagePreview || formData.image"
                style="max-height: 200px; max-width: 100%; border-radius: 8px; object-fit: contain;"
              />
              <div class="q-mt-sm">
                <q-btn flat dense color="negative" icon="delete" label="ลบรูปภาพ" @click.stop="imageFile = null; formData.image = ''; imagePreview = ''" />
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline no-caps label="ยกเลิก" color="grey-7" :disable="isSaving" v-close-popup />
          <q-btn unelevated no-caps color="positive" icon="save" label="บันทึกข้อมูล" :loading="isSaving" :disable="isSaving" @click="saveNews" />
        </div>
      </q-card>
    </q-dialog>

    <!-- Image Preview Lightbox Dialog -->
    <q-dialog v-model="showImageModal">
      <q-card class="bg-transparent" flat style="max-width: 90vw; max-height: 90vh;">
        <div class="relative-position">
          <q-btn
            icon="close"
            flat
            round
            dense
            color="white"
            class="absolute-top-right z-top q-ma-sm"
            style="background: rgba(0, 0, 0, 0.5);"
            v-close-popup
          />
          <img
            v-if="previewImageUrl"
            :src="previewImageUrl"
            alt="Preview"
            style="max-width: 90vw; max-height: 85vh; border-radius: 12px; object-fit: contain; display: block; box-shadow: 0 16px 40px rgba(0,0,0,0.4);"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import type { QTableColumn } from 'quasar';
import { QFile } from 'quasar';
import { api } from 'src/boot/axios';
import { useNewsStore, formatThaiDate } from 'src/stores/newsStore';
import type { NewsItem } from 'src/data/news';
import {
  MidDateField,
  MidTablePagination,
  midConfirm,
  midNotify,
  useRememberedPagination,
} from 'components/MID';

const newsStore = useNewsStore();
const search = ref('');

const failedImageIds = ref<Record<number, boolean>>({});
function markImageFailed(id: number) {
  failedImageIds.value[id] = true;
}

const previewImageUrl = ref<string | null>(null);
const showImageModal = ref(false);
function openImagePreview(url: string) {
  if (!url) return;
  previewImageUrl.value = url;
  showImageModal.value = true;
}

const columns: QTableColumn[] = [
  {
    name: 'date',
    label: 'วันที่',
    field: 'date',
    align: 'left',
    sortable: true,
    format: (val: string) => formatThaiDate(val),
    sort: (a: string, b: string) => {
      const getDateValue = (dateStr: string) => {
        if (!dateStr) return 0;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return 0;
        const day = Number(parts[0]) || 0;
        const month = Number(parts[1]) || 0;
        const year = Number(parts[2]) || 0;
        return year * 10000 + month * 100 + day;
      };
      return getDateValue(a) - getDateValue(b);
    },
  },
  { name: 'image', label: 'รูปภาพ', field: 'image', align: 'center' },
  {
    name: 'title',
    label: 'หัวข้อข่าว',
    field: 'title',
    align: 'left',
  },
  {
    name: 'details',
    label: 'รายละเอียด',
    field: 'details',
    align: 'left',
  },
  { name: 'actions', label: 'จัดการ', field: 'actions', align: 'right' },
];

const filteredNewsList = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return newsStore.items;
  return newsStore.items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      (item.details && item.details.toLowerCase().includes(q))
  );
});

const pagination = useRememberedPagination('admin-news', {
  sortBy: 'date',
  descending: true,
  page: 1,
  rowsPerPage: 12,
});
const isDialogOpen = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);
const formData = ref<NewsItem>({ id: 0, date: '', title: '', details: '', image: '' });
// The dialog's date as MidDateField's ISO "YYYY-MM-DD"; NewsItem.date stays DD/MM/YYYY (ค.ศ.).
const formDate = ref('');

const imageFile = ref<File | null>(null);
const imagePreview = ref<string>('');
const isDragging = ref(false);
const fileInput = ref<InstanceType<typeof QFile> | null>(null);

function onDrop(e: DragEvent) {
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      imageFile.value = file;
    } else {
      midNotify({ type: 'warning', message: 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น' });
    }
  }
}

watch(imageFile, (newFile) => {
  if (newFile) {
    imagePreview.value = URL.createObjectURL(newFile);
  } else {
    imagePreview.value = '';
  }
});

onMounted(() => {
  void newsStore.fetchNews();
});

// NewsItem.date (DD/MM/YYYY, ค.ศ.) -> "YYYY-MM-DD" for MidDateField
function ddmmyyyyToIsoDate(dateStr: string): string {
  const [d, m, y] = dateStr.split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function openAddDialog() {
  isEditing.value = false;
  formData.value = { id: 0, date: '', title: '', details: '', image: '' };
  formDate.value = '';
  imageFile.value = null;
  imagePreview.value = '';
  isDialogOpen.value = true;
}

// function fillMockData() {
//   openAddDialog();
//   formData.value = {
//     id: 0,
//     date: '10/08/2026',
//     title: 'โครงการคัดแยกขยะเพื่อชุมชน',
//     details: 'ขอเชิญชวนชาวบ้านทุกท่านร่วมกันคัดแยกขยะในครัวเรือนเพื่อสร้างรายได้และรักษาสิ่งแวดล้อม',
//     image: ''
//   };
// }

function editNews(row: NewsItem) {
  isEditing.value = true;
  formData.value = { ...row };
  formDate.value = ddmmyyyyToIsoDate(row.date);
  imageFile.value = null;
  imagePreview.value = '';
  isDialogOpen.value = true;
}

async function deleteNews(id: number) {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: 'คุณต้องการลบข่าวสารนี้ใช่หรือไม่?',
    tone: 'danger',
    confirmLabel: 'ลบข่าวสาร',
  });
  if (!confirmed) return;
  try {
    await api.delete(`/news/${id}`);
    await newsStore.fetchNews();
    midNotify({ type: 'success', message: 'ลบข่าวสารเรียบร้อยแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ลบข่าวสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
}

async function saveNews() {
  if (!formData.value.title || !formDate.value) {
    midNotify({ type: 'warning', message: 'กรุณากรอกวันที่และหัวข้อข่าว' });
    return;
  }
  if (!isEditing.value && !imageFile.value) {
    midNotify({ type: 'warning', message: 'กรุณาอัปโหลดรูปภาพหน้าปก' });
    return;
  }

  const body = new FormData();
  body.append('title', formData.value.title);
  body.append('details', formData.value.details);
  // Midnight UTC, the same instant the store reads back as this day (see newsStore).
  body.append('postedAt', `${formDate.value}T00:00:00.000Z`);
  if (imageFile.value) body.append('image', imageFile.value);

  isSaving.value = true;
  try {
    if (isEditing.value) {
      await api.put(`/news/${formData.value.id}`, body);
      midNotify({ type: 'success', message: 'แก้ไขข่าวสารเรียบร้อย' });
    } else {
      await api.post('/news', body);
      midNotify({ type: 'success', message: 'เพิ่มข่าวสารใหม่เรียบร้อย' });
    }
    await newsStore.fetchNews();
    isDialogOpen.value = false;
  } catch {
    midNotify({ type: 'error', message: 'บันทึกข่าวสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use './theme' as *;

.upload-dropzone {
  border: 2px dashed #cfe3d5;
  border-radius: 14px;
  background-color: #f7fbf8;
  transition: all 0.3s ease;
  cursor: pointer;
}

.upload-dropzone:hover,
.dropzone-active {
  border-color: #0b7a47;
  background-color: #eef8f1;
}

// Keeps บันทึกข้อมูล on screen on a real phone: 100vh there includes the strip
// behind the browser bars, so a card sized from it ran past the visible screen
// and the clipped footer took the save button with it. The card now stops at the
// visible height (dvh) and only the body scrolls.
.news-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);

  .dialog-head,
  .dialog-footer {
    flex-shrink: 0;
  }

  .dialog-body {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
  }
}

/* --- News Card Grid Styles --- */
.news-card {
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(8, 127, 73, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
    border-color: rgba(8, 127, 73, 0.25);

    .news-card-thumb {
      transform: scale(1.05);
    }
  }
}

.news-card-media-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #f1f5f3;
  overflow: hidden;
  cursor: pointer;
}

.news-card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
  display: block;
}

.news-card-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef8f2 0%, #dcfce7 100%);
}

.fallback-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(11, 122, 71, 0.12);
}

.news-date-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(11, 79, 54, 0.85);
  backdrop-filter: blur(4px);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.news-card-body {
  display: flex;
  flex-direction: column;
}

.news-card-title {
  color: #16352a;
  line-height: 1.35;
  font-size: 15px;
  font-weight: 700;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card-desc {
  color: #5c6c64;
  line-height: 1.5;
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
