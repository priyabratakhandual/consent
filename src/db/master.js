import { PrismaClient } from '../generated/master/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

if (!config.database?.masterUrl) {
  logger.warn('MASTER_DATABASE_URL not set; master DB will not connect until env is set');
}

const globalForMaster = globalThis;

export const masterDb =
  globalForMaster.masterDb ??
  new PrismaClient({
    log: config.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (config.env !== 'production') {
  globalForMaster.masterDb = masterDb;
}

export async function connectMaster() {
  await masterDb.$connect();
  logger.info('Master database connected');
}

export async function disconnectMaster() {
  await masterDb.$disconnect();
  logger.info('Master database disconnected');
}

export default masterDb;
