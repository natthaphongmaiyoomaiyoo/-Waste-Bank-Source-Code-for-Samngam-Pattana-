import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  deleteStoredObject,
  localBucketDirectory,
  memberDocumentFolder,
  privateFileUrl,
  resolveSignedPrivateFile,
  storeUpload,
} from '../src/services/storageService.js';
import { ApiError } from '../src/utils/ApiError.js';

// Local storage (what setupEnv forces) hands out signed, expiring links for
// member and sale documents instead of public /uploads paths.

function parse(url: string) {
  const parsed = new URL(url);
  const [, api, files, bucket, ...rest] = parsed.pathname.split('/');
  return {
    prefix: `/${api}/${files}`,
    bucket: bucket!,
    name: rest.map(decodeURIComponent).join('/'),
    expires: parsed.searchParams.get('expires') ?? undefined,
    signature: parsed.searchParams.get('signature') ?? undefined,
  };
}

function statusOf(run: () => unknown): number | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ApiError ? error.statusCode : -1;
  }
  return undefined;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('storageService private file links (local storage)', () => {
  it('signs a link that resolves to the file inside its bucket directory', async () => {
    const link = parse(await privateFileUrl('saleDocuments', 'sale-documents/bill.jpg'));

    expect(link.prefix).toBe('/api/files');
    expect(link.bucket).toBe('sale-documents');
    expect(link.name).toBe('bill.jpg');
    expect(resolveSignedPrivateFile(link.bucket, link.name, link.expires, link.signature)).toBe(
      path.join(localBucketDirectory('saleDocuments'), 'bill.jpg'),
    );
  });

  it('rejects a link once it is more than 10 minutes old', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    const link = parse(await privateFileUrl('memberDocuments', 'id-card.pdf'));

    vi.setSystemTime(new Date('2026-10-11T10:09:59Z'));
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, link.name, link.expires, link.signature))).toBeUndefined();

    vi.setSystemTime(new Date('2026-10-11T10:10:01Z'));
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, link.name, link.expires, link.signature))).toBe(403);
  });

  it('rejects a tampered signature, a pushed-back expiry, or another file name', async () => {
    const link = parse(await privateFileUrl('memberDocuments', 'id-card.pdf'));
    const later = String(Number(link.expires) + 3600);

    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, link.name, link.expires, `${link.signature}x`))).toBe(403);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, link.name, later, link.signature))).toBe(403);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, 'other.pdf', link.expires, link.signature))).toBe(403);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, link.name, undefined, undefined))).toBe(403);
  });

  it('serves only private buckets and only plain file names', async () => {
    const link = parse(await privateFileUrl('memberDocuments', 'id-card.pdf'));

    expect(statusOf(() => resolveSignedPrivateFile('news', link.name, link.expires, link.signature))).toBe(404);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, '../id-card.pdf', link.expires, link.signature))).toBe(404);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, '.env', link.expires, link.signature))).toBe(404);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, 'citizen-id/../id-card.pdf', link.expires, link.signature))).toBe(404);
    expect(statusOf(() => resolveSignedPrivateFile(link.bucket, 'a/b/id-card.pdf', link.expires, link.signature))).toBe(404);
  });
});

describe('storageService member document folders (local storage)', () => {
  it('files each document type in its own folder, unknown types in "other"', () => {
    expect(memberDocumentFolder('citizen_id')).toBe('citizen-id');
    expect(memberDocumentFolder('household_registration')).toBe('household-registration');
    expect(memberDocumentFolder('guarantor')).toBe('guarantor');
    expect(memberDocumentFolder('death_certificate')).toBe('death-certificate');
    expect(memberDocumentFolder('other')).toBe('other');
    expect(memberDocumentFolder('something-new')).toBe('other');
  });

  it('stores, links to and deletes a document inside its type folder', async () => {
    const file = { buffer: Buffer.from('%PDF-1.4'), mimetype: 'application/pdf' } as Express.Multer.File;
    const objectPath = await storeUpload('memberDocuments', file, memberDocumentFolder('death_certificate'));
    const onDisk = path.join(localBucketDirectory('memberDocuments'), objectPath);

    expect(objectPath).toMatch(/^death-certificate\/\d+-[0-9a-f]{24}\.pdf$/);
    expect(await fs.readFile(onDisk, 'utf8')).toBe('%PDF-1.4');

    const link = parse(await privateFileUrl('memberDocuments', objectPath));
    expect(link.name).toBe(objectPath);
    expect(resolveSignedPrivateFile(link.bucket, link.name, link.expires, link.signature)).toBe(onDisk);

    await deleteStoredObject('memberDocuments', objectPath);
    await expect(fs.access(onDisk)).rejects.toThrow();
  });

  it('keeps resolving documents stored before folders existed', async () => {
    const link = parse(await privateFileUrl('memberDocuments', 'member-documents/legacy-doc.pdf'));

    expect(link.name).toBe('legacy-doc.pdf');
    expect(resolveSignedPrivateFile(link.bucket, link.name, link.expires, link.signature)).toBe(
      path.join(localBucketDirectory('memberDocuments'), 'legacy-doc.pdf'),
    );
  });
});
