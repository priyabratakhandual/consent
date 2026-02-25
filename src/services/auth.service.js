import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import masterDb from '../db/master.js';
import { provisionTenant } from './tenant.service.js';

/**
 * Register: create one tenant (isolated DB) and one user in that tenant so they can use the app immediately.
 * User model is tenant-scoped (one row per user per tenant).
 */
export async function register(email, password, name = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const displayName = name?.trim() || normalizedEmail.split('@')[0] || 'Workspace';
  const slug = `biz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let tenant;
  try {
    tenant = await provisionTenant({ name: `${displayName}'s Workspace`, slug });
  } catch (err) {
    if (err.code === 'P2002' || err.message?.includes('exists')) {
      throw ApiError.conflict('Tenant slug already exists; try again.');
    }
    logger.error('Auto-provision tenant failed at signup', { message: err.message });
    throw ApiError.internal('Workspace setup failed. Please contact support.');
  }
  const existingInTenant = await masterDb.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: normalizedEmail } },
  });
  if (existingInTenant) {
    throw ApiError.conflict('User with this email already exists in this workspace');
  }
  const user = await masterDb.user.create({
    data: {
      tenantId: tenant.id,
      email: normalizedEmail,
      passwordHash,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
    },
  });
  logger.info('User registered and tenant provisioned', { email: normalizedEmail, userId: user.id, tenantId: tenant.id });
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, tenantId: tenant.id },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessExpiry,
    tenantId: tenant.id,
  };
}

/**
 * Login: find User by email (and optional tenantId). User is tenant-scoped; same email can exist in multiple tenants.
 * Returns access + refresh tokens with tenantId in payload when applicable.
 */
export async function login(email, password, tenantId = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  const where = tenantId
    ? { email: normalizedEmail, tenantId }
    : { email: normalizedEmail };
  const user = await masterDb.user.findFirst({
    where,
    include: { tenant: true },
  });
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account is not active');
  }
  if (user.tenant?.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Tenant is not active');
  }
  const resolvedTenantId = user.tenantId;
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      tenantId: resolvedTenantId,
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
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug } : null,
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessExpiry,
    tenantId: resolvedTenantId,
  };
}

/**
 * Refresh access token. Optionally scope to a different tenant (user must have same email in that tenant).
 */
export async function refreshAccessToken(refreshToken, tenantId = null) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }
  const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  if (decoded.type !== 'refresh') {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const currentUser = await masterDb.user.findUnique({
    where: { id: decoded.sub },
    include: { tenant: true },
  });
  if (!currentUser) {
    throw ApiError.unauthorized('User not found');
  }
  if (currentUser.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account is not active');
  }
  let user = currentUser;
  if (tenantId && tenantId !== currentUser.tenantId) {
    const other = await masterDb.user.findFirst({
      where: { email: currentUser.email, tenantId },
      include: { tenant: true },
    });
    if (other?.tenant?.status === 'ACTIVE') {
      user = other;
    }
  }
  const resolvedTenantId = user.tenantId;
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      tenantId: resolvedTenantId,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
  return {
    accessToken,
    expiresIn: config.jwt.accessExpiry,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug } : null,
    tenantId: resolvedTenantId,
  };
}

/**
 * Get user by id from master DB (for protected routes).
 * Returns user and tenant info for /me and tenant-scoped UI.
 */
export async function getUserById(id) {
  const user = await masterDb.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      tenantId: true,
      role: true,
      status: true,
      createdAt: true,
      tenant: { select: { id: true, name: true, slug: true, status: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug, status: user.tenant.status } : null,
  };
}
