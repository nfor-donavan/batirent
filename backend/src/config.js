require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/batirent',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicApiUrl: (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ''),
  overdueCron: process.env.OVERDUE_CRON || '0 6 * * *',
  cronTimezone: process.env.CRON_TIMEZONE || 'Africa/Douala',
  enableCron: process.env.ENABLE_CRON !== 'false',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'console',
    webhookUrl: process.env.SMS_WEBHOOK_URL,
    webhookToken: process.env.SMS_WEBHOOK_TOKEN,
  },
};

if (isProd && config.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
