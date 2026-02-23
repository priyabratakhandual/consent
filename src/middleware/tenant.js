import { getTenantClientByTenantId } from '../db/tenant.js';
import masterDb from '../db/master.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Require tenant context: resolve tenantId from JWT or X-Tenant-Id header,
 * verify user has access (User.tenantId or same email in target tenant), attach req.tenant and req.tenantClient.
 * Must run after authenticate.
 */
export async function requireTenant(req, res, next) {
  try {
    const tenantId = req.user?.tenantId ?? req.headers['x-tenant-id'];
    if (!tenantId) {
      throw ApiError.badRequest('Tenant context required. Set X-Tenant-Id header or login with tenantId.');
    }
    const user = await masterDb.user.findUnique({
      where: { id: req.user.sub },
      include: { tenant: true },
    });
    if (!user) throw ApiError.forbidden('User not found');
    let tenant = null;
    let role = user.role;
    if (user.tenantId === tenantId) {
      if (user.tenant?.status !== 'ACTIVE') throw ApiError.forbidden('Tenant is not active');
      tenant = user.tenant;
    } else {
      const other = await masterDb.user.findFirst({
        where: { email: user.email, tenantId },
        include: { tenant: true },
      });
      if (other?.tenant?.status === 'ACTIVE') {
        tenant = other.tenant;
        role = other.role;
      }
    }
    if (!tenant) throw ApiError.forbidden('Access to this tenant is not allowed');
    req.tenant = tenant;
    req.tenantRole = role;
    req.tenantClient = await getTenantClientByTenantId(masterDb, tenantId);
    next();
  } catch (err) {
    next(err);
  }
}

export default requireTenant;
