import masterDb from '../db/master.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Require authenticated user to have role SUPER_ADMIN only. No other role can access admin.
 * Must run after authenticate. Attaches full user (with role) to req.user.
 */
export async function requireSuperAdmin(req, res, next) {
  try {
    const user = await masterDb.user.findUnique({
      where: { id: req.user?.sub },
      include: { tenant: true },
    });
    if (!user) {
      throw ApiError.forbidden('User not found');
    }
    if (user.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Super admin access required');
    }
    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Account is not active');
    }
    req.user = { ...req.user, role: user.role };
    req.adminUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

export default requireSuperAdmin;
