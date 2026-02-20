import { getTenantClientByTenantId } from '../db/tenant.js';
import masterDb from '../db/master.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Require tenant context: resolve tenantId from JWT or X-Tenant-Id header,
 * verify user has access, attach req.tenant and req.tenantClient.
 * Must run after authenticate.
 */
export async function requireTenant(req, res, next) {
  try {
    const tenantId = req.user?.tenantId ?? req.headers['x-tenant-id'];
    if (!tenantId) {
      throw ApiError.badRequest('Tenant context required. Set X-Tenant-Id header or login with tenantId.');
    }
    const ut = await masterDb.userTenant.findFirst({
      where: { userId: req.user.sub, tenantId },
      include: { tenant: true },
    });
    if (!ut || ut.tenant.status !== 'active') {
      throw ApiError.forbidden('Access to this tenant is not allowed');
    }
    req.tenant = ut.tenant;
    req.tenantRole = ut.role;
    req.tenantClient = await getTenantClientByTenantId(masterDb, tenantId);
    next();
  } catch (err) {
    next(err);
  }
}

export default requireTenant;
