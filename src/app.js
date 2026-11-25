import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import env from './config/env.js';
import requestLogger from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import apiRouter from './routes/index.routes.js';

export const app = express();

// Trust proxy if deployed behind reverse proxy (e.g., Cloud Run, Nginx)
app.set('trust proxy', 1);

// HTTP Security Headers (allow cross-origin resource loading for uploaded company logos/avatars)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Cross-Origin Resource Sharing (CORS)
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'];
    if (allowedOrigins.includes(origin) || !env.isProduction) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Tenant-Slug'],
};
app.use(cors(corsOptions));

// HTTP Request Logging
app.use(requestLogger);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Controlled static file serving for uploaded company logos and task attachments
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), 'uploads'), {
    maxAge: '1d',
    index: false,
  })
);

// Global Rate Limiting for API routes
app.use('/api', apiLimiter);

// Mount unified API router on BOTH /api/v1 (legacy/versioned) and /api (SaaS spec)
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Root index info
app.get('/', (req, res) => {
  res.json({
    name: 'Team Task Board Multi-Tenant SaaS API',
    description: 'Multi-tenant project management and dynamic RBAC backend',
    status: 'online',
    version: '2.0.0',
    api: '/api',
    apiV1: '/api/v1',
    health: '/api/health',
  });
});

// 404 Catch-All Middleware for unhandled routes
app.use(notFound);

// Centralized Error-Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
