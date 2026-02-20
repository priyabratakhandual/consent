import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const user = await authService.register(email, password, name);
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { user },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, tenantId } = req.body;
  const result = await authService.login(email, password, tenantId);
  res.json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.headers['x-refresh-token'];
  const tenantId = req.body.tenantId ?? null;
  const result = await authService.refreshAccessToken(token, tenantId);
  res.json({
    success: true,
    data: result,
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.sub);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.json({
    success: true,
    data: { user },
  });
});

export default { register, login, refresh, me };
