import type { ApplicationStatus } from 'src/stores/memberApplicationStore';

export interface HeroWelcomeContent {
  headline: string;
  headlineIntro: string;
}

export interface ImpactItem {
  icon: string;
  title: string;
  caption: string;
}

export interface VillageOption {
  label: string;
  value: string;
}

export const HERO_SLIDE_IMAGES = [
  '/icons/anou1.png',
  '/icons/anou4.png',
  '/icons/anou3.png',
  '/icons/anou2.png',
];

export const HERO_WELCOME_CONTENT: HeroWelcomeContent = {
  headline: 'ยินดีต้อนรับสู่กองทุนธนาคารขยะ',
  headlineIntro: 'ยินดีต้อนรับสู่',
};

export const HOME_CARD_ICONS = ['eco', 'groups', 'favorite'];

export const HOME_IMPACT_ITEMS: ImpactItem[] = [
  { icon: 'recycling', title: 'รีไซเคิลขยะ', caption: 'ลดโลกร้อน' },
  { icon: 'favorite', title: 'สะสมแต้มบุญ', caption: 'ช่วยเหลือสังคม' },
  { icon: 'groups', title: 'สร้างอนาคตที่ดี', caption: 'ให้ชุมชนของเรา' },
];

export const HOME_VILLAGE_OPTIONS: VillageOption[] = [
  { label: 'หมู่บ้านที่ 1', value: 'v1' },
  { label: 'หมู่บ้านที่ 2', value: 'v2' },
  { label: 'หมู่บ้านที่ 3', value: 'v3' },
  { label: 'หมู่บ้านที่ 4', value: 'v4' },
];

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; color: string; progress: number }
> = {
  pending: { label: 'รอตรวจสอบ', color: 'orange', progress: 0.35 },
  reviewing: { label: 'กำลังตรวจเอกสาร', color: 'blue', progress: 0.62 },
  approved: { label: 'อนุมัติแล้ว', color: 'positive', progress: 1 },
  rejected: { label: 'ไม่อนุมัติ', color: 'negative', progress: 1 },
};

export const APPLICATION_STATUS_EMPTY_MESSAGE =
  'กรอกเลขอ้างอิงหรือเลขบัตรประชาชนเพื่อดูสถานะการสมัคร';
