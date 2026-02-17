import { ApiError } from '../utils/ApiError.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(req, res, next) {
  const { email, password, name } = req.body ?? {};
  const errors = [];
  if (!email || typeof email !== 'string') errors.push('email is required');
  else if (!emailRegex.test(email.trim())) errors.push('email must be valid');
  if (!password || typeof password !== 'string') errors.push('password is required');
  else if (password.length < 8) errors.push('password must be at least 8 characters');
  if (name !== undefined && name !== null && typeof name !== 'string') errors.push('name must be a string');
  if (errors.length) {
    return next(ApiError.badRequest('Validation failed', errors));
  }
  next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body ?? {};
  const errors = [];
  if (!email || typeof email !== 'string') errors.push('email is required');
  if (!password || typeof password !== 'string') errors.push('password is required');
  if (errors.length) {
    return next(ApiError.badRequest('Validation failed', errors));
  }
  next();
}

export function validateRefresh(req, res, next) {
  const token = req.body?.refreshToken ?? req.headers['x-refresh-token'];
  if (!token || typeof token !== 'string') {
    return next(ApiError.badRequest('refreshToken is required (body or x-refresh-token header)'));
  }
  next();
}
