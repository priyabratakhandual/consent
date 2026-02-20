import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { connectMaster, disconnectMaster } from './db/master.js';
import { disconnectAllTenantClients } from './db/tenant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure logs directory exists for file transports
async function ensureLogsDir() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
    logger.info('Created logs directory', { path: logsDir });
  }
}

// Global exception handlers – log and exit gracefully
function setupExceptionHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason), promise });
    process.exit(1);
  });
}

async function start() {
  setupExceptionHandlers();
  await ensureLogsDir();

  if (config.database?.masterUrl) {
    try {
      await connectMaster();
    } catch (err) {
      logger.error('Master database connection failed', { message: err.message });
      process.exit(1);
    }
  }

  const server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`, {
      env: config.env,
      port: config.port,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      try {
        await disconnectAllTenantClients();
        await disconnectMaster();
      } catch (e) {
        logger.warn('Shutdown disconnect error', { message: e?.message });
      }
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server', { message: err.message, stack: err.stack });
  process.exit(1);
});
