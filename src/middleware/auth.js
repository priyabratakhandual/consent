import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/**
 * Verify JWT access token and attach user payload to req.user.
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token required');
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      logger.debug('Auth failed: invalid or expired token');
      return next(ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
    next(err);
  }
};

/**
 * Optional auth: attach user if valid token present, don't fail if missing.
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
  } catch {
    // ignore invalid/expired for optional auth
  }
  next();
};

export default authenticate;
