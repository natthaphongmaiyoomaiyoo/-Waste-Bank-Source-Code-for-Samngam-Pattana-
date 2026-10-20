import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DOCUMENT_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, 'application/pdf']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', ...IMAGE_MIME_TYPES]);

function makeUpload(options: { allowedMimeTypes: Set<string>; maxFileSizeBytes: number; badTypeMessage: string }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxFileSizeBytes, files: 6, fields: 30 },
    fileFilter: (_req, file, cb) => {
      if (!options.allowedMimeTypes.has(file.mimetype)) return cb(ApiError.badRequest(options.badTypeMessage));
      cb(null, true);
    },
  });
}

const imageUpload = makeUpload({ allowedMimeTypes: IMAGE_MIME_TYPES, maxFileSizeBytes: 2 * 1024 * 1024, badTypeMessage: 'Only JPEG, PNG, WEBP, or GIF images are allowed' });
const documentUpload = makeUpload({ allowedMimeTypes: DOCUMENT_MIME_TYPES, maxFileSizeBytes: 5 * 1024 * 1024, badTypeMessage: 'Only PDF, JPEG, PNG, WEBP, or GIF documents are allowed' });
const videoUpload = makeUpload({ allowedMimeTypes: VIDEO_MIME_TYPES, maxFileSizeBytes: 50 * 1024 * 1024, badTypeMessage: 'Only MP4, WEBM, OGG, MOV videos or image covers are allowed' });

export const uploadNewsImage = imageUpload.single('image');
export const uploadBannerImage = imageUpload.single('image');
export const uploadAvatarImage = imageUpload.single('avatar');
export const uploadMemberDocument = documentUpload.single('document');
export const uploadDeathCertificate = documentUpload.single('deathCertificate');
export const uploadSaleDocument = documentUpload.single('document');
export const MAX_SALE_DOCUMENTS = 6;
export const uploadSaleDocuments = documentUpload.array('documents', MAX_SALE_DOCUMENTS);
export const uploadVideoMedia = videoUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

// memoryStorage does not persist anything before service validation.
export function discardUploads(_files: Express.Multer.File[] | undefined) {}
