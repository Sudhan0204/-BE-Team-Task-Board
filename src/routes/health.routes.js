import { Router } from 'express';
import { checkDatabaseConnection } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import env from '../config/env.js';

const router = Router();

/**
 * GET /api/v1/health
 * Returns service status and verifies active PostgreSQL database connectivity.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const dbCheck = await checkDatabaseConnection();
    const memory = process.memoryUsage();

    const healthData = {
      status: dbCheck.ok ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      services: {
        api: {
          status: 'up',
        },
        database: {
          status: dbCheck.ok ? 'connected' : 'disconnected',
          latencyMs: dbCheck.latencyMs,
          engine: 'PostgreSQL',
          name: env.DB_NAME,
        },
      },
      system: {
        nodeVersion: process.version,
        memoryUsageMb: {
          rss: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
          heapUsed: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotal: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        },
      },
    };

    const httpStatus = dbCheck.ok ? 200 : 503;
    return res.status(httpStatus).json({
      success: dbCheck.ok,
      message: dbCheck.ok ? 'DevFlow API is healthy and operational' : 'Database connectivity check failed',
      data: healthData,
    });
  })
);

export default router;
