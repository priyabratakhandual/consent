import { PrismaClient as TenantPrismaClient } from '../generated/tenant/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Cache tenant clients by URL to avoid opening too many connections
const tenantClientsByUrl = new Map();
const MAX_CACHED_CLIENTS = 50;

/**
 * Get a Prisma client for a tenant's isolated database.
 * @param {string} databaseUrl - Full PostgreSQL connection URL for the tenant DB
 * @returns {import('../generated/tenant/index.js').PrismaClient}
 */
export function getTenantClient(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('Tenant database URL is required');
  }
  if (tenantClientsByUrl.has(databaseUrl)) {
    return tenantClientsByUrl.get(databaseUrl);
  }
  // Limit cache size; evict oldest (simple FIFO by clearing when over limit)
  if (tenantClientsByUrl.size >= MAX_CACHED_CLIENTS) {
    const firstKey = tenantClientsByUrl.keys().next().value;
    if (firstKey) {
      const old = tenantClientsByUrl.get(firstKey);
      old?.$disconnect().catch(() => {});
      tenantClientsByUrl.delete(firstKey);
    }
  }
  const client = new TenantPrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
    log: config.env === 'development' ? ['error', 'warn'] : ['error'],
  });
  tenantClientsByUrl.set(databaseUrl, client);
  return client;
}

/**
 * Get tenant client by tenantId. Fetches Tenant from master to get databaseUrl.
 * @param {import('../generated/master/index.js').PrismaClient} masterPrisma
 * @param {string} tenantId
 * @returns {Promise<import('../generated/tenant/index.js').PrismaClient>}
 */
export async function getTenantClientByTenantId(masterPrisma, tenantId) {
  const tenant = await masterPrisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant || tenant.status !== 'active') {
    throw new Error(`Tenant not found or inactive: ${tenantId}`);
  }
  return getTenantClient(tenant.databaseUrl);
}

/**
 * Disconnect all cached tenant clients (e.g. on graceful shutdown).
 */
export async function disconnectAllTenantClients() {
  const promises = Array.from(tenantClientsByUrl.values()).map((c) =>
    c.$disconnect().catch((err) => logger.warn('Tenant client disconnect error', { message: err.message }))
  );
  await Promise.all(promises);
  tenantClientsByUrl.clear();
  logger.info('All tenant DB clients disconnected');
}

export default getTenantClient;
