import dotenv from 'dotenv';

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    masterUrl: process.env.MASTER_DATABASE_URL,
    // TENANT_DATABASE_URL is used only for prisma generate/migrate; runtime uses Tenant.databaseUrl
    tenantDefaultUrl: process.env.TENANT_DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-refresh-in-production',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 100), // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 100),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
};

export default config;
