import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import masterDb from '../db/master.js';
import * as tenantService from '../services/tenant.service.js';
import { getTenantClientByTenantId } from '../db/tenant.js';

/** GET /admin/stats */
export const getStats = asyncHandler(async (req, res) => {
  const [tenantCount, userCount] = await Promise.all([
    masterDb.tenant.count(),
    masterDb.user.count(),
  ]);
  res.json({
    success: true,
    data: { tenantCount, userCount },
  });
});

/** GET /admin/tenants – full tenant details + consent count per tenant */
export const listTenants = asyncHandler(async (req, res) => {
  const tenants = await tenantService.listAllTenants();
  const withConsentCount = await Promise.all(
    tenants.map(async (t) => {
      let consentCount = 0;
      if (t.databaseUrl) {
        try {
          const client = await getTenantClientByTenantId(masterDb, t.id);
          consentCount = await client.consent.count({ where: { deletedAt: null } });
        } catch {
          // tenant DB may be unavailable
        }
      }
      const { databaseUrl, ...rest } = t;
      return { ...rest, hasDatabase: !!databaseUrl, consentCount };
    })
  );
  res.json({ success: true, data: { tenants: withConsentCount } });
});

/** PATCH /admin/tenants/:tenantId – update tenant status (ACTIVE, SUSPENDED, TERMINATED) */
export const updateTenantStatus = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const { status } = req.body ?? {};
  const allowed = ['ACTIVE', 'SUSPENDED', 'TERMINATED'];
  if (!status || !allowed.includes(status)) {
    throw ApiError.badRequest('status must be one of: ACTIVE, SUSPENDED, TERMINATED');
  }
  const tenant = await masterDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  const updated = await masterDb.tenant.update({
    where: { id: tenantId },
    data: { status },
  });
  res.json({
    success: true,
    data: {
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    },
  });
});

/** GET /admin/tenants/:tenantId/users – users belonging to this tenant */
export const listTenantUsers = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = await masterDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  const users = await masterDb.user.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  res.json({
    success: true,
    data: {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      users,
    },
  });
});

/** GET /admin/tenants/:tenantId/consents */
export const listTenantConsents = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = await masterDb.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) {
    throw ApiError.notFound('Tenant not found');
  }
  if (!tenant.databaseUrl) {
    return res.json({
      success: true,
      data: {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        consents: [],
      },
    });
  }
  const client = await getTenantClientByTenantId(masterDb, tenantId);
  const consents = await client.consent.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      lifecycleState: true,
      createdAt: true,
      _count: { select: { acceptances: true, shareLinks: true } },
    },
  });
  res.json({
    success: true,
    data: {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      consents,
    },
  });
});
