import type { Request, Response } from 'express';
import { resolveSignedPrivateFile } from '../services/storageService.js';
import { ApiError } from '../utils/ApiError.js';

// Serves a private document (member / sale documents) from local storage. The
// link itself is the credential: it comes from privateFileUrl and expires.
export async function downloadPrivate(req: Request, res: Response) {
  const { bucket, folder, name } = req.params;
  const filePath = resolveSignedPrivateFile(
    String(bucket),
    folder ? `${folder}/${name}` : String(name),
    req.query.expires,
    req.query.signature,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  await new Promise<void>((resolve, reject) => {
    res.sendFile(filePath, (error?: Error & { code?: string }) => {
      if (!error) return resolve();
      reject(error.code === 'ENOENT' ? ApiError.notFound('File not found') : error);
    });
  });
}
