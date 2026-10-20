import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { systemLogMiddleware } from './middleware/systemLogMiddleware.js';
import { localBucketDirectory, PUBLIC_BUCKETS } from './services/storageService.js';
import { ApiError } from './utils/ApiError.js';

export const app = express();
if (env.nodeEnv === 'production') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    // A rejected origin is a client/config problem, not a server crash: log the
    // origin (so CORS_ORIGIN can be fixed) and answer 403 instead of a 500 stack trace.
    console.warn(`[cors] blocked origin ${origin} (allowed: ${env.corsOrigins.join(', ')})`);
    callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
  },
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public uploads are static assets, not API JSON - mounted outside /api, from
// the same directories storageService writes to. Private buckets are left out
// on purpose: they are reachable only through signed /api/files links.
for (const bucket of PUBLIC_BUCKETS) {
  app.use(`/uploads/${env.storageBuckets[bucket]}`, express.static(localBucketDirectory(bucket)));
}

// Log all mutating API requests (POST/PUT/PATCH/DELETE) to system_log.
app.use('/api', systemLogMiddleware);

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
