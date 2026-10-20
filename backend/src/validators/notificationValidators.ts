import { z } from 'zod';

// Opening the bell marks every notification it shows as read in one request.
export const markNotificationsReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
