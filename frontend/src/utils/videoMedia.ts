import { api } from 'src/boot/axios';
import type { VideoItem } from 'src/stores/videoStore';

// Same rules as VideoCard.vue. Uploaded files live under <backend origin>/uploads/,
// next to the /api base.
const uploadsBase = (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');

export function isRemoteUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match?.[1] ?? null;
}

export function isYouTubeUrl(url: string | null | undefined): boolean {
  return Boolean(getYouTubeId(url));
}

export function isVideoFile(url: string | null | undefined): boolean {
  return Boolean(url) && !isYouTubeUrl(url);
}

export function getVideoFullUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (isRemoteUrl(url)) return url;
  return `${uploadsBase}/uploads/${url}`;
}

// The admin's cover image, else YouTube's own thumbnail, else none.
export function videoThumbnailUrl(video: VideoItem): string | null {
  const cover = video.coverUrl;
  if (cover) return isRemoteUrl(cover) ? cover : `${uploadsBase}/uploads/${cover}`;
  const youTubeId = getYouTubeId(video.videoUrl);
  return youTubeId ? `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg` : null;
}

// postedAt is an ISO timestamp, shown on the Thai calendar day, e.g. "16 ก.ย. 2569".
export function formatVideoDate(postedAt: string): string {
  return new Date(postedAt).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

