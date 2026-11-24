import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from devflow-backend root or current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';

export const env = {
  NODE_ENV,

  PORT: Number(process.env.PORT) || 5000,
  APP_URL: process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`,
  FRONTEND_URL,
  CLIENT_URL: FRONTEND_URL,

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 5432,
  DB_NAME: process.env.DB_NAME || 'devflow_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: process.env.DB_SSL === 'true',
  DB_POOL_MIN: Number(process.env.DB_POOL_MIN) || 2,
  DB_POOL_MAX: Number(process.env.DB_POOL_MAX) || 10,

  // JWT & Security
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REMEMBER_EXPIRES_IN: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  JWT_RESET_EXPIRES_IN: process.env.JWT_RESET_EXPIRES_IN || '1h',
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME || 'devflow_token',

  // Email (Nodemailer for password recovery)
  EMAIL_HOST: process.env.EMAIL_HOST || '',
  EMAIL_PORT: Number(process.env.EMAIL_PORT) || 587,
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'DevFlow Support <no-reply@devflow.app>',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  AUTH_RATE_LIMIT_MAX_REQUESTS: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 20,

  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  isDevelopment: NODE_ENV === 'development',
};

/**
 * Validates required environment variables during startup.
 */
export function validateEnv() {
  const missing = [];

  if (!env.JWT_SECRET || env.JWT_SECRET.trim().length < 16) {
    missing.push('JWT_SECRET (must be at least 16 characters)');
  }

  if (!env.DATABASE_URL) {
    if (!env.DB_HOST) missing.push('DB_HOST');
    if (!env.DB_NAME) missing.push('DB_NAME');
    if (!env.DB_USER) missing.push('DB_USER');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid required environment variables: ${missing.join(', ')}. Please check your .env file.`
    );
  }
}

// Validate immediately on module load (skip strict failure only if test env provides fallback)
if (env.isTest && !env.JWT_SECRET) {
  env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long';
}
validateEnv();

export default env;
