import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  // 127.0.0.1 in production behind nginx; unset listens on every interface.
  host: process.env.HOST,
  databaseUrl: required('DATABASE_URL'),
  directUrl: required('DIRECT_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:9000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  // Defaults to the existing remote behavior. Tests explicitly disable it in
  // tests/setupEnv.ts so credentials from a developer's .env are never used.
  supabaseStorageRemote: process.env.SUPABASE_STORAGE_REMOTE !== 'false',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  storageLocalRoot: process.env.STORAGE_LOCAL_ROOT,
  storageBuckets: {
    news: process.env.SUPABASE_STORAGE_BUCKET_NEWS ?? 'news',
    avatars: process.env.SUPABASE_STORAGE_BUCKET_AVATARS ?? 'avatars',
    videos: process.env.SUPABASE_STORAGE_BUCKET_VIDEOS ?? 'videos',
    memberDocuments: process.env.SUPABASE_STORAGE_BUCKET_MEMBER_DOCUMENTS ?? 'member-documents',
    saleDocuments: process.env.SUPABASE_STORAGE_BUCKET_SALE_DOCUMENTS ?? 'sale-documents',
  },
};

const hasSupabaseUrl = Boolean(env.supabaseUrl);
const hasSupabaseKey = Boolean(env.supabaseServiceRoleKey);
if (hasSupabaseUrl !== hasSupabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together');
}
if (env.nodeEnv === 'production' && env.supabaseStorageRemote && !hasSupabaseUrl) {
  throw new Error('Supabase Storage configuration is required in production unless SUPABASE_STORAGE_REMOTE=false');
}
// Local storage in production must name its directory, so uploads never land
// inside the deployed code folder and get wiped by the next deploy.
if (env.nodeEnv === 'production' && !env.supabaseStorageRemote && !env.storageLocalRoot) {
  throw new Error('STORAGE_LOCAL_ROOT is required in production when SUPABASE_STORAGE_REMOTE=false');
}
if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}
