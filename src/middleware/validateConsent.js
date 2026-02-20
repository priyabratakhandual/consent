import { ApiError } from '../utils/ApiError.js';

export function validateCreateConsent(req, res, next) {
  const { type, granted, userId, metadata } = req.body ?? {};
  const errors = [];
  if (!type || typeof type !== 'string') {
    errors.push('type is required and must be a string');
  } else if (type.trim().length === 0) {
    errors.push('type cannot be empty');
  }
  if (granted !== undefined && granted !== null && typeof granted !== 'boolean') {
    errors.push('granted must be a boolean');
  }
  if (userId !== undefined && userId !== null && typeof userId !== 'string') {
    errors.push('userId must be a string');
  }
  if (metadata !== undefined && metadata !== null && typeof metadata !== 'object') {
    errors.push('metadata must be an object');
  }
  if (errors.length) {
    return next(ApiError.badRequest('Validation failed', errors));
  }
  next();
}
