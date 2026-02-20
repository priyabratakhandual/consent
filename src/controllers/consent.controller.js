import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const list = asyncHandler(async (req, res) => {
  const consents = await req.tenantClient.consent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({
    success: true,
    data: { consents },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consent = await req.tenantClient.consent.findUnique({
    where: { id },
  });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  res.json({
    success: true,
    data: { consent },
  });
});

export const create = asyncHandler(async (req, res) => {
  const { userId, type, granted = true, metadata } = req.body;
  const consent = await req.tenantClient.consent.create({
    data: {
      userId: userId ?? req.user.sub,
      type: typeof type === 'string' ? type.trim() : type,
      granted: Boolean(granted),
      metadata: metadata ?? undefined,
    },
  });
  res.status(201).json({
    success: true,
    data: { consent },
  });
});

export default { list, getById, create };
