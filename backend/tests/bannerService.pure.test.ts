import { describe, expect, it } from 'vitest';
import { assertSameBanners, normalizeBannerText } from '../src/services/bannerService.js';

// The rules around banner text and slideshow order that need no database.
describe('normalizeBannerText', () => {
  it('trims both lines and keeps them', () => {
    expect(normalizeBannerText({ textIntro: '  ยินดีต้อนรับสู่ ', textMain: 'กองทุนธนาคารขยะ' })).toEqual({
      textIntro: 'ยินดีต้อนรับสู่',
      textMain: 'กองทุนธนาคารขยะ',
    });
  });

  it('turns blank, null and missing lines into no line (clears the text)', () => {
    expect(normalizeBannerText({ textIntro: '   ', textMain: null })).toEqual({ textIntro: null, textMain: null });
    expect(normalizeBannerText({})).toEqual({ textIntro: null, textMain: null });
  });
});

describe('assertSameBanners', () => {
  it('accepts every banner exactly once, in any order', () => {
    expect(() => assertSameBanners([1, 2, 3], [3, 1, 2])).not.toThrow();
  });

  it('refuses a stale, partial or duplicated order', () => {
    expect(() => assertSameBanners([1, 2, 3], [1, 2])).toThrow('รายการแบนเนอร์เปลี่ยนไปแล้ว');
    expect(() => assertSameBanners([1, 2, 3], [1, 2, 4])).toThrow();
    expect(() => assertSameBanners([1, 2, 3], [1, 1, 2])).toThrow();
  });
});
