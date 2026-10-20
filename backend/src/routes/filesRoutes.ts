import { Router } from 'express';
import * as filesController from '../controllers/filesController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const filesRoutes = Router();

// No requireAuth: these links are opened by <a href>/<img src>, which send no
// bearer token, so the signed and expiring query string does the authorizing.
filesRoutes.get('/:bucket/:name', asyncHandler(filesController.downloadPrivate));
// Member documents are filed per document type, e.g. /member-documents/citizen-id/<file>.
filesRoutes.get('/:bucket/:folder/:name', asyncHandler(filesController.downloadPrivate));
