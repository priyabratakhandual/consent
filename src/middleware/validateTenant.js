import { ApiError } from '../utils/ApiError.js';

const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function validateCreateTenant(req, res, next) {
  const { name, slug } = req.body ?? {};
  const errors = [];
  if (!name || typeof name !== 'string') errors.push('name is required');
  else if (name.trim().length === 0) errors.push('name cannot be empty');
  if (!slug || typeof slug !== 'string') errors.push('slug is required');
  else {
    const normalized = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (normalized.length < 2) errors.push('slug must be at least 2 characters');
    if (!slugRegex.test(normalized)) errors.push('slug must be lowercase alphanumeric and hyphens only');
  }
  if (errors.length) {
    return next(ApiError.badRequest('Validation failed', errors));
  }
  next();
}

export default validateCreateTenant;
