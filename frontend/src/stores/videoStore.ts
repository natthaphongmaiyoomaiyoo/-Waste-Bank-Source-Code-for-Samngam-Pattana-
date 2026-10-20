import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from 'src/boot/axios';

export interface VideoItem {
  id: number;
  title: string;
  description?: string | null;
  videoUrl: string;
  coverUrl?: string | null;
  category?: string | null;
  isActive: boolean;
  postedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoUploadOptions {
  onProgress?: ((percent: number, loaded: number, total: number) => void) | undefined;
  signal?: AbortSignal | undefined;
}

export const useVideoStore = defineStore('video', () => {
  const items = ref<VideoItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // activeOnly: true = ดึงเฉพาะวิดีโอที่เผยแพร่และอยู่ในช่วง video.visibleDays (หน้าสาธารณะ) / false = ทั้งหมด (หน้าจัดการของแอดมิน)
  const fetchVideos = async (options?: { activeOnly?: boolean }) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get<{ success: boolean; data: VideoItem[] }>('/videos', {
        params: options?.activeOnly ? { active: '1' } : {},
      });
      items.value = res.data.data;
    } catch (e: unknown) {
      error.value = 'ไม่สามารถโหลดข้อมูลวิดีโอได้';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  const addVideo = async (
    payload: FormData | {
      title: string;
      description?: string | undefined;
      videoUrl?: string | undefined;
      category?: string | undefined;
      isActive?: boolean | undefined;
      postedAt?: string | undefined;
    },
    options?: VideoUploadOptions,
  ) => {
    loading.value = true;
    try {
      const config: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
      } = {};
      if (payload instanceof FormData) {
        config.headers = { 'Content-Type': 'multipart/form-data' };
      }
      if (options?.signal) {
        config.signal = options.signal;
      }
      if (options?.onProgress) {
        config.onUploadProgress = (e) => {
          if (e.total && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded * 100) / e.total));
            options.onProgress?.(percent, e.loaded, e.total);
          }
        };
      }
      const res = await api.post('/videos', payload, config);
      const responseData = res.data as { success: boolean; data: VideoItem };
      items.value.unshift(responseData.data);
      return responseData.data;
    } finally {
      loading.value = false;
    }
  };

  const updateVideo = async (
    id: number,
    payload: FormData | {
      title?: string | undefined;
      description?: string | undefined;
      videoUrl?: string | undefined;
      category?: string | undefined;
      isActive?: boolean | undefined;
      postedAt?: string | undefined;
    },
    options?: VideoUploadOptions,
  ) => {
    loading.value = true;
    try {
      const config: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
      } = {};
      if (payload instanceof FormData) {
        config.headers = { 'Content-Type': 'multipart/form-data' };
      }
      if (options?.signal) {
        config.signal = options.signal;
      }
      if (options?.onProgress) {
        config.onUploadProgress = (e) => {
          if (e.total && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded * 100) / e.total));
            options.onProgress?.(percent, e.loaded, e.total);
          }
        };
      }
      const res = await api.put(`/videos/${id}`, payload, config);
      const responseData = res.data as { success: boolean; data: VideoItem };
      const idx = items.value.findIndex((v) => v.id === id);
      if (idx !== -1) {
        items.value[idx] = responseData.data;
      }
      return responseData.data;
    } finally {
      loading.value = false;
    }
  };

  const deleteVideo = async (id: number) => {
    loading.value = true;
    try {
      await api.delete(`/videos/${id}`);
      items.value = items.value.filter((v) => v.id !== id);
    } finally {
      loading.value = false;
    }
  };

  return {
    items,
    loading,
    error,
    fetchVideos,
    addVideo,
    updateVideo,
    deleteVideo,
  };
});
