import './src/config/env.js';
import pg from 'pg';

// Configure node-pg to keep BIGINT (OID 20) as string to prevent 64-bit integer precision loss
pg.types.setTypeParser(20, (val) => val);

/**
 * Knex database configuration file supporting development, testing, and production environments.
 */
const connection = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'devflow_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const config = {
  development: {
    client: 'pg',
    connection,
    pool: {
      min: Number(process.env.DB_POOL_MIN) || 2,
      max: Number(process.env.DB_POOL_MAX) || 10,
      acquireTimeoutMillis: 10000,
    },
    debug: false,
  },

  test: {
    client: 'pg',
    connection: process.env.TEST_DATABASE_URL || connection,
    pool: {
      min: 1,
      max: 5,
    },
  },

  production: {
    client: 'pg',
    connection,
    pool: {
      min: Number(process.env.DB_POOL_MIN) || 2,
      max: Number(process.env.DB_POOL_MAX) || 20,
      acquireTimeoutMillis: 10000,
    },
  },
};

export default config;
