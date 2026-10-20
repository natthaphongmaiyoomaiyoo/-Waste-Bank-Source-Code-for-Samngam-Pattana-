import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export type StorageBucket = keyof typeof env.storageBuckets;
type PrivateBucket = 'memberDocuments' | 'saleDocuments';
const PRIVATE_BUCKETS: readonly PrivateBucket[] = ['memberDocuments', 'saleDocuments'];
// Only these are served as static files under /uploads; private buckets never are.
export const PUBLIC_BUCKETS = ['news', 'avatars', 'videos'] as const satisfies readonly StorageBucket[];
// Same lifetime as the Supabase signed URLs used in remote mode.
const PRIVATE_URL_TTL_SECONDS = 600;
// Member documents are filed in one subfolder per document type; anything
// else (including types the UI may add later) goes to "other".
const MEMBER_DOCUMENT_FOLDERS: Record<string, string> = {
  citizen_id: 'citizen-id',
  household_registration: 'household-registration',
  guarantor: 'guarantor',
  death_certificate: 'death-certificate',
};
const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const localRoot = env.storageLocalRoot
  ? path.resolve(env.storageLocalRoot)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
// Derived from JWT_SECRET under a fixed label so local storage needs no extra
// secret; rotating JWT_SECRET only invalidates links that expire in minutes.
const privateUrlKey = crypto.createHmac('sha256', env.jwtSecret).update('wastebank:private-file-url').digest();
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
};
let client: SupabaseClient | undefined;

function supabase(): SupabaseClient | undefined {
  if (!env.supabaseStorageRemote) return undefined;
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return undefined;
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function bucketName(bucket: StorageBucket): string { return env.storageBuckets[bucket]; }

// Directory holding a bucket's files when storage is local.
export function localBucketDirectory(bucket: StorageBucket): string { return path.join(localRoot, bucketName(bucket)); }

export function memberDocumentFolder(documentType: string): string {
  return MEMBER_DOCUMENT_FOLDERS[documentType] ?? 'other';
}

// An object path is a file name, optionally under one subfolder ("citizen-id/x.pdf").
function isSafeObjectPath(objectPath: string): boolean {
  const parts = objectPath.split('/');
  return parts.length <= 2 && parts.every((part) => SAFE_SEGMENT.test(part));
}

function signPrivatePath(slug: string, objectPath: string, expires: number): string {
  return crypto.createHmac('sha256', privateUrlKey).update(`${slug}/${objectPath}\n${expires}`).digest('base64url');
}

function cleanObjectPath(bucket: StorageBucket, value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const legacy = bucket === 'memberDocuments' ? 'member-documents' : bucket === 'saleDocuments' ? 'sale-documents' : bucket;
  for (const prefix of new Set([bucketName(bucket), legacy])) {
    if (normalized.startsWith(`${prefix}/`)) return normalized.slice(prefix.length + 1);
  }
  return normalized;
}

function isExternalUrl(value: string): boolean { return /^https?:\/\//i.test(value); }

export async function storeUpload(bucket: StorageBucket, file: Express.Multer.File, folder?: string): Promise<string> {
  if (!file.buffer) throw new Error('Upload buffer is missing');
  if (folder !== undefined && !SAFE_SEGMENT.test(folder)) throw new Error('Invalid storage folder');
  // The server controls the stored filename and derives its extension from the
  // validated MIME type; an untrusted original filename never reaches storage.
  const extension = MIME_EXTENSIONS[file.mimetype];
  if (!extension) throw new Error('Unsupported upload MIME type');
  const fileName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
  const objectPath = folder ? `${folder}/${fileName}` : fileName;
  const remote = supabase();
  if (remote) {
    const { error } = await remote.storage.from(bucketName(bucket)).upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  } else {
    const directory = path.join(localBucketDirectory(bucket), folder ?? '');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, fileName), file.buffer, { flag: 'wx' });
  }
  return objectPath;
}

export async function deleteStoredObject(bucket: StorageBucket, storedPath: string | null | undefined): Promise<void> {
  if (!storedPath || isExternalUrl(storedPath)) return;
  const objectPath = cleanObjectPath(bucket, storedPath);
  const remote = supabase();
  if (remote) {
    const { error } = await remote.storage.from(bucketName(bucket)).remove([objectPath]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  } else {
    const relative = isSafeObjectPath(objectPath) ? objectPath : path.basename(objectPath);
    await fs.rm(path.join(localBucketDirectory(bucket), relative), { force: true });
  }
}

export function publicFileUrl(bucket: StorageBucket, storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  if (isExternalUrl(storedPath)) return storedPath;
  const objectPath = cleanObjectPath(bucket, storedPath);
  const remote = supabase();
  if (remote) return remote.storage.from(bucketName(bucket)).getPublicUrl(objectPath).data.publicUrl;
  return `${env.publicBaseUrl.replace(/\/$/, '')}/uploads/${bucketName(bucket)}/${objectPath}`;
}

export async function privateFileUrl(bucket: PrivateBucket, storedPath: string): Promise<string> {
  const objectPath = cleanObjectPath(bucket, storedPath);
  const remote = supabase();
  if (!remote) {
    // Local private files are not under /uploads; this link works only until it expires.
    const slug = bucketName(bucket);
    const expires = Math.floor(Date.now() / 1000) + PRIVATE_URL_TTL_SECONDS;
    const query = new URLSearchParams({ expires: String(expires), signature: signPrivatePath(slug, objectPath, expires) });
    const urlPath = objectPath.split('/').map(encodeURIComponent).join('/');
    return `${env.publicBaseUrl.replace(/\/$/, '')}/api/files/${slug}/${urlPath}?${query}`;
  }
  const { data, error } = await remote.storage.from(bucketName(bucket)).createSignedUrl(objectPath, PRIVATE_URL_TTL_SECONDS);
  if (error) throw new Error(`Storage signed URL failed: ${error.message}`);
  return data.signedUrl;
}

// Checks a link made by privateFileUrl and returns the file's path on disk.
export function resolveSignedPrivateFile(slug: string, objectPath: string, expires: unknown, signature: unknown): string {
  const bucket = PRIVATE_BUCKETS.find((candidate) => bucketName(candidate) === slug);
  if (!bucket || supabase() || !isSafeObjectPath(objectPath)) throw ApiError.notFound('File not found');
  if (typeof expires !== 'string' || !/^\d{1,12}$/.test(expires) || typeof signature !== 'string') {
    throw ApiError.forbidden('Invalid file link');
  }
  const expected = Buffer.from(signPrivatePath(slug, objectPath, Number(expires)));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw ApiError.forbidden('Invalid file link');
  if (Number(expires) < Math.floor(Date.now() / 1000)) throw ApiError.forbidden('File link has expired');
  return path.join(localBucketDirectory(bucket), objectPath);
}
