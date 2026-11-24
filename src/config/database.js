import env from './env.js';
import knex from 'knex';
import pg from 'pg';
import logger from './logger.js';

// Configure node-pg to keep BIGINT (OID 20) as string in JS to prevent IEEE-754 precision loss
pg.types.setTypeParser(20, (val) => (val === null ? null : String(val)));

// Determine connection settings based on DATABASE_URL or individual parameters
const connectionConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    };

/**
 * Reusable Knex.js instance configured for PostgreSQL
 */
export const db = knex({
  client: 'pg',
  connection: connectionConfig,
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    acquireTimeoutMillis: 10000,
    afterCreate: (conn, done) => {
      // Set timezone to UTC for consistent date-time handling
      conn.query('SET timezone="UTC";', (err) => {
        if (err) {
          logger.error('Failed to set database timezone to UTC', { error: err.message });
          done(err, conn);
        } else {
          done(null, conn);
        }
      });
    },
  },
  acquireConnectionTimeout: 10000,
});

/**
 * Verifies active database connectivity by executing a lightweight ping query.
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
export async function checkDatabaseConnection() {
  const start = Date.now();
  try {
    await db.raw('SELECT 1 AS ping');
    const latencyMs = Date.now() - start;
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    logger.error('Database connection check failed', {
      error: err.message,
      code: err.code,
    });
    return { ok: false, latencyMs, error: 'Database unavailable' };
  }
}

/**
 * Gracefully shuts down the Knex connection pool.
 */
export async function closeDatabaseConnection() {
  try {
    await db.destroy();
    logger.info('Database connection pool closed successfully');
  } catch (err) {
    logger.error('Error closing database connection pool', { error: err.message });
  }
}

export default db;
