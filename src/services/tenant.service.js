import pg from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import { parsePostgresUrl, buildPostgresUrl } from '../utils/parseDbUrl.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import masterDb from '../db/master.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a new PostgreSQL database (for a tenant). Uses same host/user/pass as master, new database name.
 * @param {string} masterUrl - MASTER_DATABASE_URL
 * @param {string} tenantDbName - Database name to create (e.g. tenant_acme_corp)
 * @returns {Promise<string>} Connection URL for the new database
 */
export async function createTenantDatabase(masterUrl, tenantDbName) {
  const parsed = parsePostgresUrl(masterUrl);
  const serverUrl = buildPostgresUrl({
    ...parsed,
    database: 'postgres', // connect to default DB to run CREATE DATABASE
  });
  const client = new pg.Client({ connectionString: serverUrl });
  try {
    await client.connect();
    const safeName = tenantDbName.replace(/[^a-zA-Z0-9_]/g, '_');
    await client.query(`CREATE DATABASE "${safeName.replace(/"/g, '""')}"`);
    logger.info('Tenant database created', { database: safeName });
    return buildPostgresUrl({ ...parsed, database: safeName });
  } finally {
    await client.end();
  }
}

/**
 * Run tenant schema migrations against a given database URL (child process).
 * @param {string} tenantDatabaseUrl
 */
export async function runTenantMigrations(tenantDatabaseUrl) {
  const tenantSchemaPath = path.join(__dirname, '..', '..', 'prisma', 'tenant', 'schema.prisma');
  try {
    execSync(`npx prisma migrate deploy --schema=${tenantSchemaPath}`, {
      env: {
        ...process.env,
        TENANT_DATABASE_URL: tenantDatabaseUrl,
      },
      stdio: 'inherit',
    });
  } catch (err) {
    logger.error('Tenant migration failed', { message: err.message });
    throw ApiError.internal('Failed to initialize tenant database', err.message);
  }
}

/**
 * Create a new tenant: create DB, run migrations, insert Tenant row and optionally link user as owner.
 * @param {{ name: string, slug: string }} input
 * @param {string} [ownerUserId] - If provided, add UserTenant with role owner
 * @returns {Promise<{ id, name, slug, databaseUrl, status }>}
 */
export async function provisionTenant(input, ownerUserId = null) {
  const { name, slug } = input;
  if (!name || !slug) {
    throw ApiError.badRequest('name and slug are required');
  }
  const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!normalizedSlug) {
    throw ApiError.badRequest('Invalid slug');
  }
  const masterUrl = config.database?.masterUrl;
  if (!masterUrl) {
    throw ApiError.internal('MASTER_DATABASE_URL not configured');
  }
  const existing = await masterDb.tenant.findUnique({ where: { slug: normalizedSlug } });
  if (existing) {
    throw ApiError.conflict('Tenant with this slug already exists');
  }
  const tenantDbName = `tenant_${normalizedSlug}`;
  const databaseUrl = await createTenantDatabase(masterUrl, tenantDbName);
  await runTenantMigrations(databaseUrl);
  const tenant = await masterDb.tenant.create({
    data: {
      name: name.trim(),
      slug: normalizedSlug,
      databaseUrl,
      status: 'active',
    },
  });
  if (ownerUserId) {
    await masterDb.userTenant.create({
      data: {
        userId: ownerUserId,
        tenantId: tenant.id,
        role: 'owner',
      },
    });
  }
  logger.info('Tenant provisioned', { tenantId: tenant.id, slug: normalizedSlug });
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    databaseUrl: tenant.databaseUrl,
    status: tenant.status,
  };
}

/**
 * List tenants the user has access to.
 * @param {string} userId
 */
export async function listTenantsForUser(userId) {
  const userTenants = await masterDb.userTenant.findMany({
    where: { userId },
    include: { tenant: true },
  });
  return userTenants.map((ut) => ({
    id: ut.tenant.id,
    name: ut.tenant.name,
    slug: ut.tenant.slug,
    status: ut.tenant.status,
    role: ut.role,
  }));
}

/**
 * Assert user has access to tenant and return tenant record.
 */
export async function getTenantForUser(userId, tenantId) {
  const ut = await masterDb.userTenant.findFirst({
    where: { userId, tenantId },
    include: { tenant: true },
  });
  if (!ut || ut.tenant.status !== 'active') {
    throw ApiError.forbidden('Access to this tenant is not allowed');
  }
  return ut.tenant;
}
