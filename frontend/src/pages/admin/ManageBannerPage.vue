<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero dashboard-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="view_carousel" />
          </div>
          <div class="hero-copy">
            <h1>จัดการแบนเนอร์หน้าข่าวสาร</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="เพิ่มแบนเนอร์"
            class="hero-add-btn"
            @click="openAddDialog"
          />
        </div>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader
          title="แบนเนอร์ทั้งหมด"
          :caption="`${banners.length} รูป · เรียงตามลำดับที่แสดงในสไลด์หน้าข่าวสาร · ลากการ์ดเพื่อสลับลำดับ`"
        />

        <div v-if="bannerStore.loading && !banners.length" class="loading-wrap">
          <q-spinner color="positive" size="36px" />
        </div>

        <!-- Cards are dragged to reorder (SortableJS, see onSortEnd); the order is
             saved as soon as a card is dropped. -->
        <div v-else-if="banners.length" ref="gridEl" class="banner-grid">
          <div v-for="(banner, index) in banners" :key="banner.id" class="banner-card">
            <a
              :href="banner.imageUrl"
              target="_blank"
              rel="noopener"
              class="banner-thumb"
              draggable="false"
            >
              <img
                :src="banner.imageUrl"
                :alt="`แบนเนอร์ลำดับที่ ${index + 1}`"
                draggable="false"
              />
              <!-- The text as it sits on the homepage slide. -->
              <div v-if="hasText(banner)" class="banner-text-overlay">
                <div v-if="banner.textIntro" class="banner-text-intro">
                  {{ banner.textIntro }}
                </div>
                <div v-if="banner.textMain" class="banner-text-main">{{ banner.textMain }}</div>
              </div>
            </a>
            <div class="banner-meta">
              <q-icon name="drag_indicator" class="banner-drag-handle">
                <q-tooltip>ลากการ์ดเพื่อสลับลำดับ</q-tooltip>
              </q-icon>
              <div class="banner-order">ลำดับที่ {{ index + 1 }}</div>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="delete"
                color="red-7"
                class="q-ml-auto"
                :loading="deletingId === banner.id"
                :disable="deletingId !== null"
                @click="confirmDelete(banner)"
              >
                <q-tooltip>ลบแบนเนอร์</q-tooltip>
              </q-btn>
            </div>
            <div class="banner-text-row">
              <div :class="['banner-text-summary', { 'is-empty': !hasText(banner) }]">
                {{ hasText(banner) ? textSummary(banner) : 'ยังไม่มีข้อความบนแบนเนอร์' }}
              </div>
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                :icon="hasText(banner) ? 'edit' : 'add'"
                :label="hasText(banner) ? 'แก้ไขข้อความ' : 'เพิ่มข้อความ'"
                @click="openTextDialog(banner, index)"
              />
              <q-btn
                v-if="hasText(banner)"
                flat
                dense
                no-caps
                size="sm"
                color="red-7"
                icon="format_clear"
                label="ลบข้อความ"
                :loading="clearingId === banner.id"
                :disable="clearingId !== null"
                @click="confirmClearText(banner)"
              />
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <q-icon name="view_carousel" size="32px" />
          <template v-if="bannerStore.error">{{ bannerStore.error }}</template>
          <template v-else>
            ยังไม่มีแบนเนอร์
            <div class="text-caption">หน้าข่าวสารจะแสดงรูปตั้งต้นของระบบจนกว่าจะเพิ่มแบนเนอร์</div>
          </template>
        </div>
      </q-card>
    </div>

    <q-dialog v-model="isDialogOpen" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon name="add_photo_alternate" />
            </div>
            เพิ่มแบนเนอร์
          </div>
          <q-btn flat dense round icon="close" v-close-popup :disable="isSaving" />
        </div>

        <div class="dialog-body">
          <div
            class="upload-dropzone"
            :class="{ 'dropzone-active': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="fileInput?.pickFiles()"
          >
            <q-file
              ref="fileInput"
              v-model="imageFile"
              class="hidden"
              :accept="ACCEPTED_TYPES.join(',')"
              @update:model-value="isDragging = false"
            />
            <div v-if="!imagePreview" class="text-center text-grey-6 q-pa-lg">
              <q-icon name="cloud_upload" size="48px" color="positive" class="q-mb-sm" />
              <div class="text-subtitle1">ลากไฟล์รูปภาพมาวางที่นี่ หรือคลิกเพื่ออัปโหลด</div>
              <div class="text-caption">แนะนำรูปแนวนอน ประมาณ 1920×800 px (JPG, PNG, WEBP)</div>
            </div>

            <div v-else class="text-center q-pa-sm">
              <img :src="imagePreview" alt="ตัวอย่างแบนเนอร์" class="upload-preview" />
              <div class="q-mt-sm">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="negative"
                  icon="delete"
                  label="เลือกรูปใหม่"
                  :disable="isSaving"
                  @click.stop="imageFile = null"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn flat no-caps label="ยกเลิก" :disable="isSaving" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="positive"
            icon="upload"
            label="อัปโหลด"
            :loading="isSaving"
            :disable="isSaving"
            @click="saveBanner"
          />
        </div>
      </q-card>
    </q-dialog>

    <!-- ============ Text over one banner ============ -->
    <MidDialog
      v-model="textDialogOpen"
      size="sm"
      tone="info"
      icon="title"
      badge="ข้อความบนแบนเนอร์"
      :title="`แบนเนอร์ลำดับที่ ${textBannerOrder}`"
      caption="เว้นว่างทั้งสองบรรทัดถ้าไม่ต้องการข้อความ"
      :persistent="textSaving"
    >
      <div v-if="textBanner" class="text-preview">
        <img :src="textBanner.imageUrl" alt="" />
        <div v-if="textIntro.trim() || textMain.trim()" class="banner-text-overlay">
          <div v-if="textIntro.trim()" class="banner-text-intro">{{ textIntro }}</div>
          <div v-if="textMain.trim()" class="banner-text-main">{{ textMain }}</div>
        </div>
      </div>
      <q-input
        v-model="textIntro"
        outlined
        dense
        maxlength="80"
        counter
        label="บรรทัดที่ 1"
        class="q-mt-md"
      />
      <q-input
        v-model="textMain"
        outlined
        dense
        maxlength="80"
        counter
        label="บรรทัดที่ 2"
      />
      <template #actions>
        <MidButton
          variant="secondary"
          label="ยกเลิก"
          :disable="textSaving"
          @click="textDialogOpen = false"
        />
        <MidButton icon="save" label="บันทึกข้อความ" :loading="textSaving" @click="saveText" />
      </template>
    </MidDialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { QFile } from 'quasar';
import Sortable from 'sortablejs';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import { useBannerStore, type Banner } from 'src/stores/bannerStore';
import { compressImage } from 'src/utils/imageCompress';
import { MidButton, MidDialog, midConfirm, midNotify } from 'components/MID';
import { apiErrorMessage } from 'src/utils/apiError';

// Matches the backend's image upload filter and size cap (middleware/upload.ts).
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const bannerStore = useBannerStore();
const banners = computed(() => bannerStore.items);

const isDialogOpen = ref(false);
const isSaving = ref(false);
const deletingId = ref<number | null>(null);
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const isDragging = ref(false);
const fileInput = ref<InstanceType<typeof QFile> | null>(null);

onMounted(() => {
  void bannerStore.fetchBanners();
});

watch(imageFile, (file) => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value);
  imagePreview.value = file ? URL.createObjectURL(file) : '';
});

onBeforeUnmount(() => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value);
  sortable?.destroy();
});

// --- Order: drag a card, the new order is saved on drop ---------------------------
const gridEl = ref<HTMLElement | null>(null);
const savingOrder = ref(false);
let sortable: Sortable | null = null;

// The grid only exists while there are banners, so the drag set-up follows it.
watch(gridEl, (el) => {
  sortable?.destroy();
  sortable = el
    ? Sortable.create(el, {
        animation: 180,
        ghostClass: 'banner-card--ghost',
        chosenClass: 'banner-card--chosen',
        // Buttons stay clickable. On a touch screen a card drags only after a
        // short press, so swiping still scrolls the page.
        filter: '.q-btn',
        preventOnFilter: false,
        delay: 180,
        delayOnTouchOnly: true,
        onEnd: onSortEnd,
      })
    : null;
});

watch(savingOrder, (busy) => sortable?.option('disabled', busy));

function onSortEnd(event: Sortable.SortableEvent) {
  const { oldIndex, newIndex, item, from } = event;
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
  // Sortable moved the element itself; put it back and let Vue re-render the
  // cards from the new order, so the DOM and the list never disagree.
  from.removeChild(item);
  from.insertBefore(item, from.children[oldIndex] ?? null);
  const ids = banners.value.map((banner) => banner.id);
  const [moved] = ids.splice(oldIndex, 1);
  if (moved === undefined) return;
  ids.splice(newIndex, 0, moved);
  void saveOrder(ids);
}

async function saveOrder(ids: number[]) {
  savingOrder.value = true;
  try {
    await bannerStore.reorderBanners(ids);
    midNotify({ type: 'success', message: 'บันทึกลำดับแบนเนอร์แล้ว' });
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกลำดับไม่สำเร็จ') });
  } finally {
    savingOrder.value = false;
  }
}

// --- Text over a banner: up to two lines ------------------------------------------
function hasText(banner: Banner): boolean {
  return Boolean(banner.textIntro || banner.textMain);
}

function textSummary(banner: Banner): string {
  return [banner.textIntro, banner.textMain].filter(Boolean).join(' · ');
}

const textDialogOpen = ref(false);
const textSaving = ref(false);
const textBanner = ref<Banner | null>(null);
const textBannerOrder = ref(0);
const textIntro = ref('');
const textMain = ref('');
const clearingId = ref<number | null>(null);

function openTextDialog(banner: Banner, index: number) {
  textBanner.value = banner;
  textBannerOrder.value = index + 1;
  textIntro.value = banner.textIntro ?? '';
  textMain.value = banner.textMain ?? '';
  textDialogOpen.value = true;
}

async function saveText() {
  const banner = textBanner.value;
  if (!banner || textSaving.value) return;
  textSaving.value = true;
  try {
    await bannerStore.updateBannerText(banner.id, {
      textIntro: textIntro.value.trim() || null,
      textMain: textMain.value.trim() || null,
    });
    midNotify({ type: 'success', message: 'บันทึกข้อความบนแบนเนอร์แล้ว' });
    textDialogOpen.value = false;
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกข้อความไม่สำเร็จ') });
  } finally {
    textSaving.value = false;
  }
}

async function confirmClearText(banner: Banner) {
  const confirmed = await midConfirm({
    title: 'ลบข้อความบนแบนเนอร์?',
    message: 'รูปแบนเนอร์ยังอยู่ เฉพาะข้อความบนรูปนี้จะถูกลบ',
    tone: 'danger',
    confirmLabel: 'ลบข้อความ',
  });
  if (!confirmed) return;
  clearingId.value = banner.id;
  try {
    await bannerStore.updateBannerText(banner.id, { textIntro: null, textMain: null });
    midNotify({ type: 'success', message: 'ลบข้อความเรียบร้อยแล้ว' });
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ลบข้อความไม่สำเร็จ') });
  } finally {
    clearingId.value = null;
  }
}

function openAddDialog() {
  imageFile.value = null;
  isDialogOpen.value = true;
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  if (ACCEPTED_TYPES.includes(file.type)) {
    imageFile.value = file;
  } else {
    midNotify({ type: 'warning', message: 'กรุณาอัปโหลดไฟล์รูปภาพ JPG, PNG, WEBP หรือ GIF เท่านั้น' });
  }
}

async function saveBanner() {
  if (!imageFile.value) {
    midNotify({ type: 'warning', message: 'กรุณาเลือกรูปแบนเนอร์' });
    return;
  }

  isSaving.value = true;
  try {
    // Banners span the full page width, so keep far more detail than the
    // 1280px/0.6 default meant for sale-evidence photos.
    const file = await compressImage(imageFile.value, { maxEdge: 2560, quality: 0.85 });
    if (file.size > MAX_UPLOAD_BYTES) {
      midNotify({ type: 'warning', message: 'ไฟล์รูปใหญ่เกิน 2MB กรุณาเลือกรูปที่เล็กลง' });
      return;
    }
    await bannerStore.addBanner(file);
    midNotify({ type: 'success', message: 'เพิ่มแบนเนอร์เรียบร้อย' });
    isDialogOpen.value = false;
  } catch {
    midNotify({ type: 'error', message: 'เพิ่มแบนเนอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    isSaving.value = false;
  }
}

async function confirmDelete(banner: Banner) {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: 'คุณต้องการลบแบนเนอร์นี้ใช่หรือไม่?',
    tone: 'danger',
    confirmLabel: 'ลบแบนเนอร์',
  });
  if (confirmed) await deleteBanner(banner.id);
}

async function deleteBanner(id: number) {
  deletingId.value = id;
  try {
    await bannerStore.removeBanner(id);
    midNotify({ type: 'success', message: 'ลบแบนเนอร์เรียบร้อยแล้ว' });
  } catch {
    midNotify({ type: 'error', message: 'ลบแบนเนอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    deletingId.value = null;
  }
}
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.dashboard-hero {
  min-height: 148px;
  display: flex;
  align-items: center;
}

.banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
  padding: 20px 26px 26px;
}

.banner-card {
  border: 1px solid #e3ece6;
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  cursor: grab;
  transition: box-shadow 0.2s ease;
}

// Where the dragged card will land, and the card being dragged.
.banner-card--ghost {
  opacity: 0.35;
}

.banner-card--chosen {
  box-shadow: 0 14px 32px rgba(22, 83, 57, 0.22);
}

.banner-card:hover {
  box-shadow: 0 8px 22px rgba(22, 83, 57, 0.1);
}

// Same fallback ratio as the homepage hero (FristPage .hero-section), so the
// thumbnail crops roughly the way the slideshow will on a wide screen.
.banner-thumb {
  position: relative;
  display: block;
  aspect-ratio: 2.4 / 1;
  background: #eef5f0;
}

.banner-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 6px 12px;
}

.banner-order {
  color: #0e2d1e;
  font-weight: 700;
}

.banner-drag-handle {
  color: #9aa9a0;
  font-size: 20px;
}

// The banner's text over the thumbnail, laid out like the homepage slide: on
// the left, white, over a soft dark wash.
.banner-text-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 7% 0 6%;
  color: #ffffff;
  background: linear-gradient(96deg, rgba(3, 30, 17, 0.55), rgba(3, 30, 17, 0.1) 70%, transparent);
  pointer-events: none;
}

// Both lines the same size, as on the homepage.
.banner-text-intro,
.banner-text-main {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.15;
}

.banner-text-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  padding: 0 10px 12px 16px;
}

.banner-text-summary {
  flex: 1 1 140px;
  min-width: 0;
  overflow: hidden;
  color: #3d5246;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-empty {
    color: #9aa9a0;
    font-weight: 500;
  }
}

.text-preview {
  position: relative;
  overflow: hidden;
  aspect-ratio: 2.4 / 1;
  border-radius: 12px;
  background: #eef5f0;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.upload-dropzone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  background-color: #fafafa;
  transition: all 0.3s ease;
  cursor: pointer;
}

.upload-dropzone:hover,
.dropzone-active {
  border-color: #21ba45;
  background-color: #f1fdf3;
}

.upload-preview {
  display: block;
  max-width: 100%;
  max-height: 220px;
  margin: 0 auto;
  border-radius: 8px;
  object-fit: contain;
}

@media (max-width: 720px) {
  .banner-grid {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
</style>
