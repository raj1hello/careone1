import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

// Ephemeral fallback secrets for local dev if not provided via environment
const runtimeFallbackSecret = crypto
  .createHash('sha256')
  .update(process.cwd() + '_careone_dev_jwt')
  .digest('hex');

const runtimeFallbackRefreshSecret = crypto
  .createHash('sha256')
  .update(process.cwd() + '_careone_dev_refresh')
  .digest('hex');

export const ENV = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || runtimeFallbackSecret,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || runtimeFallbackRefreshSecret,
  ACCESS_TOKEN_TTL: '30m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  DATABASE_PATH:
    process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'careone.db'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
};
