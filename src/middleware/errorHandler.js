import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import config from '../config/index.js';

/**
 * 404 handler - must be after all routes.
 */
export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Global error handler. Centralizes error logging and response shape.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details ?? null;

  // Log error
  const logMeta = {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    stack: err.stack,
  };
  if (statusCode >= 500) {
    logger.error(message, logMeta);
  } else {
    logger.warn(message, { path: req.originalUrl, method: req.method, statusCode });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Prisma / database errors – hide low-level details from API consumers
  // Detect by common Prisma properties: error code and clientVersion.
  if (!err.statusCode && (typeof err.code === 'string' || err.clientVersion)) {
    statusCode = 500;
    message = 'Database error';
    // In non-production, expose minimal structured details to help debugging
    if (config.env !== 'production') {
      details = {
        ...(details || {}),
        prismaCode: err.code ?? undefined,
      };
    } else {
      details = null;
    }
  }

  // Validation / schema errors (e.g. from libraries)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    details = err.errors || null;
  }

  // Hide internal details in production
  const response = {
    success: false,
    message,
    ...(details && { details }),
    ...(config.env !== 'production' && err.stack && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

export default errorHandler;
