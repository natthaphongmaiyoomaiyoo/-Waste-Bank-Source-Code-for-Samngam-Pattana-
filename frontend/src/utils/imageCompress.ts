// ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
//
// รูปจากมือถือรุ่นใหม่ใบละ 3-8 MB ซึ่งเกินความจำเป็นสำหรับหลักฐานการรับซื้อ
// (แค่ต้องอ่านหน้าปัดตาชั่ง/เห็นกองขยะได้ก็พอ) ย่อด้านยาวลงเหลือ 1280 px และ
// เข้ารหัสใหม่เป็น JPEG คุณภาพ 0.6 จะได้ไฟล์ราว 150-250 KB คือประหยัดพื้นที่
// เก็บข้อมูลราว 90-95% และประหยัดเน็ตของกรรมการตอนอัปโหลดด้วย
//
// backend ยังจำกัดขนาดไฟล์ไว้อีกชั้น (middleware/upload.ts) เผื่อกรณีที่ไม่ได้
// ผ่านทางนี้

const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_QUALITY = 0.6;

export interface CompressImageOptions {
  // ความยาวด้านที่ยาวที่สุดหลังย่อ (px) - อัตราส่วนภาพคงเดิม
  maxEdge?: number;
  // 0-1 ยิ่งต่ำยิ่งเบลอและไฟล์เล็ก
  quality?: number;
}

export function isCompressibleImage(file: File): boolean {
  // GIF อาจเป็นภาพเคลื่อนไหว วาดลง canvas แล้วจะเหลือเฟรมเดียว จึงไม่แตะ
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

// คืนไฟล์ที่ย่อแล้ว หรือไฟล์เดิมถ้าย่อไม่ได้/ย่อแล้วไม่เล็กลง
// ไม่ throw - ถ้าเบราว์เซอร์ทำไม่ได้ก็ให้อัปโหลดของเดิมไป ดีกว่าอัปโหลดไม่ได้เลย
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    // รูปเล็ก/รูปที่บีบอัดดีอยู่แล้ว การเข้ารหัสใหม่อาจได้ไฟล์ใหญ่ขึ้น - เก็บของเดิม
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toJpegName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function toJpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'photo';
  return `${base}.jpg`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
