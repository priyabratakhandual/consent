import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// In-memory user store for demo. Replace with DB (e.g. MongoDB, PostgreSQL) in production.
const users = new Map();

/**
 * Register a new user.
 */
export async function register(email, password, name = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }
  if (users.has(normalizedEmail)) {
    throw ApiError.conflict('User with this email already exists');
  }
  const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    password: hashedPassword,
    name: name || null,
    createdAt: new Date().toISOString(),
  };
  users.set(normalizedEmail, user);
  logger.info('User registered', { email: normalizedEmail, userId: user.id });
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

/**
 * Login and return access + refresh tokens.
 */
export async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  const user = users.get(normalizedEmail);
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
  logger.info('User logged in', { email: normalizedEmail, userId: user.id });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessExpiry,
  };
}

/**
 * Refresh access token using refresh token.
 */
export function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }
  const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  if (decoded.type !== 'refresh') {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = [...users.values()].find((u) => u.id === decoded.sub);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
  return {
    accessToken,
    expiresIn: config.jwt.accessExpiry,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

/**
 * Get user by id (for protected routes).
 */
export function getUserById(id) {
  const user = [...users.values()].find((u) => u.id === id);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
