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
 * Create a new tenant: create DB, run migrations, insert Tenant row.
 * If ownerUserId is provided, create a User in the new tenant with same email/password as owner (so they can switch to it).
 * @param {{ name: string, slug: string }} input
 * @param {string} [ownerUserId] - If provided, clone this user into the new tenant (same email, role TENANT_ADMIN)
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
  // Database name pattern:
  //   0001_tenant_rahul
  // where:
  //   - 0001 is a zero-padded sequential-ish number (based on current tenant count)
  //   - rahul comes from the slug (usually derived from username/email)
  //
  // This is good enough for development / moderate scale. For very high
  // concurrency you'd switch to a dedicated serial column or sequence.
  const tenantCount = await masterDb.tenant.count();
  const serial = String(tenantCount + 1).padStart(4, '0');
  // strip leading prefix like \"biz-\" and take first token as username-ish part
  const slugParts = normalizedSlug.replace(/^biz-/, '').split('-');
  const usernamePart = slugParts[0] || 'tenant';
  const safeUser = usernamePart.replace(/[^a-z0-9_]/g, '') || 'tenant';
  const tenantDbName = `${serial}_tenant_${safeUser}`;
  const databaseUrl = await createTenantDatabase(masterUrl, tenantDbName);
  await runTenantMigrations(databaseUrl);
  const tenant = await masterDb.tenant.create({
    data: {
      name: name.trim(),
      slug: normalizedSlug,
      databaseUrl,
      status: 'ACTIVE',
    },
  });
  if (ownerUserId) {
    const owner = await masterDb.user.findUnique({
      where: { id: ownerUserId },
      select: { email: true, passwordHash: true },
    });
    if (owner) {
      await masterDb.user.create({
        data: {
          tenantId: tenant.id,
          email: owner.email,
          passwordHash: owner.passwordHash,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
        },
      });
    }
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
 * List tenants the user has access to (same email in multiple tenants = multiple User rows).
 * @param {string} userId - current user id (from JWT sub)
 */
export async function listTenantsForUser(userId) {
  const current = await masterDb.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!current) return [];
  const users = await masterDb.user.findMany({
    where: { email: current.email },
    include: { tenant: true },
  });
  return users
    .filter((u) => u.tenant?.status === 'ACTIVE')
    .map((u) => ({
      id: u.tenant.id,
      name: u.tenant.name,
      slug: u.tenant.slug,
      status: u.tenant.status,
      role: u.role,
    }));
}

/**
 * List all tenants with full details (for SUPER_ADMIN only). Excludes webhookSecret.
 */
export async function listAllTenants() {
  return masterDb.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      databaseUrl: true,
      defaultConsentValidityDays: true,
      retentionPolicyDays: true,
      webhookUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } },
    },
  });
}

/**
 * Assert user has access to tenant and return tenant record.
 * User belongs to one tenant per row; for "switch" we check same email in target tenant.
 */
export async function getTenantForUser(userId, tenantId) {
  const user = await masterDb.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!user) throw ApiError.forbidden('User not found');
  if (user.tenantId === tenantId) {
    if (user.tenant?.status !== 'ACTIVE') throw ApiError.forbidden('Tenant is not active');
    return user.tenant;
  }
  const other = await masterDb.user.findFirst({
    where: { email: user.email, tenantId },
    include: { tenant: true },
  });
  if (!other || other.tenant?.status !== 'ACTIVE') {
    throw ApiError.forbidden('Access to this tenant is not allowed');
  }
  return other.tenant;
}
