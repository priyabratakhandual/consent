import { asyncHandler } from '../utils/asyncHandler.js';

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

export const create = asyncHandler(async (req, res) => {
  const { userId, type, granted = true, metadata } = req.body;
  const consent = await req.tenantClient.consent.create({
    data: {
      userId: userId ?? req.user.sub,
      type,
      granted,
      metadata: metadata ?? undefined,
    },
  });
  res.status(201).json({
    success: true,
    data: { consent },
  });
});

export default { list, create };
