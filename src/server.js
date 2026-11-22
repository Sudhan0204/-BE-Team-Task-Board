import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import { checkDatabaseConnection, closeDatabaseConnection } from './config/database.js';

let server;

async function startServer() {
  try {
    // 1. Verify database connection before binding port
    logger.info(`Starting DevFlow Backend in [${env.NODE_ENV}] mode...`);
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.ok) {
      logger.info(`PostgreSQL database connected successfully (latency: ${dbStatus.latencyMs}ms)`);
    } else {
      logger.warn(
        `PostgreSQL database connection check failed or database is currently unreachable. Server will still start and retry on incoming requests.`
      );
    }

    // 2. Start HTTP server
    server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`DevFlow API server running at http://localhost:${env.PORT}`);
      logger.info(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (err) {
    logger.error('Failed to start DevFlow server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      await closeDatabaseConnection();
      logger.info('Graceful shutdown completed. Exiting process.');
      process.exit(0);
    });

    // Force exit if shutdown hangs beyond 10 seconds
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    await closeDatabaseConnection();
    process.exit(0);
  }
}

// Register process signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown', {
    error: err.message,
    stack: err.stack,
  });
  // Clean exit on fatal uncaught exception
  shutdown('uncaughtException');
});

startServer();
