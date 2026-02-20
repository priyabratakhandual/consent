import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import masterDb from '../db/master.js';

/**
 * Register a new user in the master database.
 */
export async function register(email, password, name = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }
  const existing = await masterDb.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw ApiError.conflict('User with this email already exists');
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = await masterDb.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name?.trim() || null,
    },
  });
  logger.info('User registered', { email: normalizedEmail, userId: user.id });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

/**
 * Login against master DB and return access + refresh tokens.
 * Optionally include tenantId in token if user has exactly one tenant (or pass tenantId to scope to one).
 */
export async function login(email, password, tenantId = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  const user = await masterDb.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const ut = await masterDb.userTenant.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });
    if (ut?.tenant?.status === 'active') {
      resolvedTenantId = ut.tenant.id;
    }
  }
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      ...(resolvedTenantId && { tenantId: resolvedTenantId }),
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
  logger.info('User logged in', { email: normalizedEmail, userId: user.id, tenantId: resolvedTenantId });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessExpiry,
    ...(resolvedTenantId && { tenantId: resolvedTenantId }),
  };
}

/**
 * Refresh access token; optionally set tenantId for the new token.
 */
export async function refreshAccessToken(refreshToken, tenantId = null) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }
  const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  if (decoded.type !== 'refresh') {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await masterDb.user.findUnique({ where: { id: decoded.sub } });
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const ut = await masterDb.userTenant.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });
    if (ut?.tenant?.status === 'active') {
      resolvedTenantId = ut.tenant.id;
    }
  }
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      ...(resolvedTenantId && { tenantId: resolvedTenantId }),
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
  return {
    accessToken,
    expiresIn: config.jwt.accessExpiry,
    user: { id: user.id, email: user.email, name: user.name },
    ...(resolvedTenantId && { tenantId: resolvedTenantId }),
  };
}

/**
 * Get user by id from master DB (for protected routes).
 */
export async function getUserById(id) {
  const user = await masterDb.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return user;
}
