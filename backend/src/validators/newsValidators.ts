import { z } from 'zod';

export const createNewsSchema = z.object({
  title: z.string().min(1, 'title is required'),
  details: z.string().min(1, 'details is required'),
  postedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'postedAt must be a valid date'),
});
export type CreateNewsInput = z.infer<typeof createNewsSchema>;

export const updateNewsSchema = createNewsSchema.partial();
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;
