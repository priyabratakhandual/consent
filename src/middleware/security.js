import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Apply Helmet for secure HTTP headers.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: config.env === 'production',
  crossOriginEmbedderPolicy: false,
});

/**
 * CORS configuration.
 */
export const corsMiddleware = cors({
  origin: config.cors.origin === '*' ? true : config.cors.origin.split(',').map((o) => o.trim()),
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

/**
 * General API rate limiter.
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json(options.message);
  },
});

/**
 * Stricter rate limit for auth routes (login/register).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Sanitize user input to prevent NoSQL injection.
 */
export const sanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
});

export default {
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  authRateLimiter,
  sanitizeMiddleware,
};
