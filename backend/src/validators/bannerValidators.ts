import { z } from 'zod';

// PATCH /banners/:id - the text over one banner. Blank or null clears a line;
// clearing both removes the text from that banner.
const bannerTextLine = z.string().trim().max(80).nullable().optional();

export const updateBannerTextSchema = z.object({
  textIntro: bannerTextLine,
  textMain: bannerTextLine,
});
export type UpdateBannerTextInput = z.infer<typeof updateBannerTextSchema>;

// PUT /banners/order - every banner id, in the order the slideshow shows them.
export const reorderBannersSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
});
