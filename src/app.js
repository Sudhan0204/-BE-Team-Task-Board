import express from 'express';
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

// HTTP Security Headers
app.use(helmet());

// Cross-Origin Resource Sharing (CORS)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'];
    if (allowedOrigins.includes(origin) || !env.isProduction) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};
app.use(cors(corsOptions));

// HTTP Request Logging
app.use(requestLogger);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiting for API routes
app.use('/api', apiLimiter);

// Mount API v1 router
app.use('/api/v1', apiRouter);

// Root index redirect/info
app.get('/', (req, res) => {
  res.json({
    name: 'DevFlow Backend Service',
    description: 'REST API backend for DevFlow task management system',
    status: 'online',
    version: '1.0.0',
    apiV1: '/api/v1',
    health: '/api/v1/health',
  });
});

// 404 Catch-All Middleware for unhandled routes
app.use(notFound);

// Centralized Error-Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
