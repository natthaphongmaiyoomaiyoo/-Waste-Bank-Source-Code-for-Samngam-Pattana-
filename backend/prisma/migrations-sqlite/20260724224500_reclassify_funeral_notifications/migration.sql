-- Existing death-event notifications used the generic "fund" type. Reclassify
-- them once so every member sees the new funeral popup and can dismiss it.
UPDATE "notification"
SET
  "notification_type" = 'funeral',
  "is_read" = false
WHERE
  "notification_type" = 'fund'
  AND "title" = 'หักเงินสมทบฌาปนกิจ';
