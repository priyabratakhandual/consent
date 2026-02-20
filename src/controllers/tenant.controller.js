import * as tenantService from '../services/tenant.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const create = asyncHandler(async (req, res) => {
  const { name, slug } = req.body;
  const tenant = await tenantService.provisionTenant({ name, slug }, req.user.sub);
  res.status(201).json({
    success: true,
    message: 'Tenant created',
    data: { tenant },
  });
});

export const list = asyncHandler(async (req, res) => {
  const tenants = await tenantService.listTenantsForUser(req.user.sub);
  res.json({
    success: true,
    data: { tenants },
  });
});

export const switchTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.body;
  if (!tenantId) {
    throw ApiError.badRequest('tenantId is required');
  }
  await tenantService.getTenantForUser(req.user.sub, tenantId);
  const authService = await import('../services/auth.service.js');
  const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
  if (!refreshToken) {
    return res.json({
      success: true,
      message: 'Tenant access verified. Use refresh token with body.tenantId to get new access token.',
      data: { tenantId },
    });
  }
  const result = await authService.refreshAccessToken(refreshToken, tenantId);
  res.json({
    success: true,
    data: result,
  });
});

export default { create, list, switchTenant };
