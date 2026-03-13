import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { recordConsentAudit, ACTION_CREATED, ACTION_UPDATED, ACTION_DELETED } from '../services/audit.service.js';
import { masterDb } from '../db/index.js';

function hashApiKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export const list = asyncHandler(async (req, res) => {
  const consents = await req.tenantClient.consent.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      _count: { select: { acceptances: true } },
    },
  });
  res.json({
    success: true,
    data: { consents },
  });
});

/** GET /consents/analytics – dashboard stats: totals, acceptances by day, top consents */
export const getAnalytics = asyncHandler(async (req, res) => {
  const client = req.tenantClient;
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [totalConsents, totalShareLinks, totalAcceptances, acceptancesLast14, consentsWithCounts] = await Promise.all([
    client.consent.count({ where: { deletedAt: null } }),
    client.consentShareLink.count(),
    client.consentAcceptance.count(),
    client.consentAcceptance.findMany({
      where: { acceptedAt: { gte: fourteenDaysAgo } },
      select: { acceptedAt: true },
    }),
    client.consent.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { acceptances: true } },
      },
      take: 100,
    }),
  ]);

  const byDay = {};
  for (let d = 0; d < 14; d++) {
    const day = new Date(fourteenDaysAgo);
    day.setDate(day.getDate() + d);
    const key = day.toISOString().slice(0, 10);
    byDay[key] = 0;
  }
  for (const a of acceptancesLast14) {
    const key = new Date(a.acceptedAt).toISOString().slice(0, 10);
    if (byDay[key] !== undefined) byDay[key]++;
  }
  const acceptancesByDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const topConsents = consentsWithCounts
    .map((c) => ({ id: c.id, name: c.name, type: c.type, acceptanceCount: c._count.acceptances }))
    .sort((a, b) => b.acceptanceCount - a.acceptanceCount)
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      totalConsents,
      totalShareLinks,
      totalAcceptances,
      acceptancesByDay,
      topConsents,
    },
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
  const { type, granted = true, metadata, name, description, lifecycleState, expiryDate } = req.body;
  const typeVal = typeof type === 'string' ? type.trim() : type;
  const grantedVal = Boolean(granted);
  const nameVal = typeof name === 'string' && name.trim() ? name.trim() : (typeVal || 'Consent');
  const lifecycleVal = lifecycleState === 'PUBLISHED' || lifecycleState === 'ARCHIVED' ? lifecycleState : 'DRAFT';

  const consent = await req.tenantClient.consent.create({
    data: {
      tenantId: req.tenant?.id,
      type: typeVal,
      granted: grantedVal,
      name: nameVal,
      description: description ?? undefined,
      lifecycleState: lifecycleVal,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      metadata: metadata ?? undefined,
    },
  });

  // Create one default share link so user can share immediately
  const defaultToken = crypto.randomBytes(18).toString('base64url');
  const defaultLink = await req.tenantClient.consentShareLink.create({
    data: {
      consentId: consent.id,
      token: defaultToken,
      visibility: 'PUBLIC',
      status: 'ACTIVE',
    },
  });
  const tenantId = req.tenant?.id;
  if (tenantId) {
    await masterDb.shareLinkRegistry.upsert({
      where: { token: defaultToken },
      create: { token: defaultToken, tenantId },
      update: { tenantId },
    });
  }

  await recordConsentAudit(req.tenantClient, {
    entityId: consent.id,
    action: ACTION_CREATED,
    performedBy: req.user?.sub ?? null,
    newData: { id: consent.id, type: consent.type, granted: consent.granted, metadata: consent.metadata, createdAt: consent.createdAt },
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  });

  res.status(201).json({
    success: true,
    data: { consent },
  });
});

// ---------------------------------------------------------------------------
// Share links: DB-backed; public or private (API key); revoke; usage limit; stats
// ---------------------------------------------------------------------------

export const listLinks = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consent = await req.tenantClient.consent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const links = await req.tenantClient.consentShareLink.findMany({
    where: { consentId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      apiKeys: {
        select: { id: true, name: true, status: true, usageCount: true, usageLimit: true, createdAt: true, expiresAt: true },
      },
      _count: { select: { acceptances: true } },
    },
  });
  res.json({
    success: true,
    data: { links },
  });
});

export const createLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expiresAt = null, usageLimit = null, nickname = null } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const token = crypto.randomBytes(18).toString('base64url');
  const link = await req.tenantClient.consentShareLink.create({
    data: {
      consentId: id,
      token,
      nickname: typeof nickname === 'string' && nickname.trim() ? nickname.trim() : undefined,
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      usageLimit: typeof usageLimit === 'number' && usageLimit > 0 ? usageLimit : undefined,
    },
  });
  const tenantId = req.tenant?.id;
  if (tenantId) {
    await masterDb.shareLinkRegistry.upsert({
      where: { token },
      create: { token, tenantId },
      update: { tenantId },
    });
  }
  res.status(201).json({
    success: true,
    data: { link },
  });
});

export const updateLink = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const { visibility, status, expiresAt, usageLimit, nickname } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const link = await req.tenantClient.consentShareLink.findFirst({
    where: { id: linkId, consentId: id },
  });
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  const updated = await req.tenantClient.consentShareLink.update({
    where: { id: linkId },
    data: {
      ...(visibility === 'PUBLIC' || visibility === 'PRIVATE' ? { visibility } : {}),
      ...(status === 'ACTIVE' || status === 'REVOKED' || status === 'EXPIRED' ? { status } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(usageLimit !== undefined ? { usageLimit: usageLimit > 0 ? usageLimit : null } : {}),
      ...(nickname !== undefined ? { nickname: typeof nickname === 'string' && nickname.trim() ? nickname.trim() : null } : {}),
    },
  });
  res.json({
    success: true,
    data: { link: updated },
  });
});

export const createApiKey = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const { name = '', expiresAt = null, usageLimit = null } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const link = await req.tenantClient.consentShareLink.findFirst({
    where: { id: linkId, consentId: id },
  });
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  if (link.visibility !== 'PRIVATE') {
    throw ApiError.badRequest('API keys can only be created for PRIVATE share links');
  }
  const keyValue = crypto.randomBytes(24).toString('base64url');
  const valueHash = hashApiKey(keyValue);
  const apiKey = await req.tenantClient.consentShareApiKey.create({
    data: {
      linkId,
      name: name?.trim() || 'API key',
      valueHash,
      status: 'ACTIVE',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      usageLimit: typeof usageLimit === 'number' && usageLimit > 0 ? usageLimit : undefined,
    },
  });
  res.status(201).json({
    success: true,
    data: {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        status: apiKey.status,
        usageLimit: apiKey.usageLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        value: keyValue, // returned only once
      },
    },
  });
});

export const updateApiKey = asyncHandler(async (req, res) => {
  const { id, linkId, keyId } = req.params;
  const { name, status, expiresAt, usageLimit } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const link = await req.tenantClient.consentShareLink.findFirst({
    where: { id: linkId, consentId: id },
  });
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  const key = await req.tenantClient.consentShareApiKey.findFirst({
    where: { id: keyId, linkId },
  });
  if (!key) {
    throw ApiError.notFound('API key not found');
  }
  const updated = await req.tenantClient.consentShareApiKey.update({
    where: { id: keyId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(status === 'ACTIVE' || status === 'REVOKED' || status === 'EXPIRED' ? { status } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(usageLimit !== undefined ? { usageLimit: usageLimit > 0 ? usageLimit : null } : {}),
    },
  });
  res.json({
    success: true,
    data: { apiKey: updated },
  });
});

/** GET /consents/:id/links/:linkId/stats – acceptances count, usage, limit for this share link */
export const getLinkStats = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const link = await req.tenantClient.consentShareLink.findFirst({
    where: { id: linkId, consentId: id },
    include: {
      apiKeys: { select: { id: true, name: true, status: true, usageCount: true, usageLimit: true } },
    },
  });
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  const acceptancesCount = await req.tenantClient.consentAcceptance.count({
    where: { shareLinkId: linkId },
  });
  res.json({
    success: true,
    data: {
      linkId: link.id,
      token: link.token,
      visibility: link.visibility,
      status: link.status,
      usageCount: link.usageCount,
      usageLimit: link.usageLimit,
      acceptancesCount,
      apiKeys: link.apiKeys,
    },
  });
});

/** GET /consents/:id/links/:linkId/acceptances – list acceptances (device, IP) for this share link */
export const getLinkAcceptances = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const link = await req.tenantClient.consentShareLink.findFirst({
    where: { id: linkId, consentId: id },
  });
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  const acceptances = await req.tenantClient.consentAcceptance.findMany({
    where: { shareLinkId: linkId },
    orderBy: { acceptedAt: 'desc' },
    select: {
      id: true,
      acceptedAt: true,
      ipAddress: true,
      deviceInfo: true,
      signatureData: true,
      status: true,
      revokedAt: true,
      consentSigner: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  res.json({
    success: true,
    data: { acceptances },
  });
});

/** POST /consents/:id/links/:linkId/accept – record acceptance via share link; enforces usage limit */
export const acceptViaLink = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const { ipAddress, deviceInfo, signatureData, otpVerified, receiptUrl } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const link = await req.tenantClient.consentShareLink.findFirst({
    where: { id: linkId, consentId: id },
  });
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  if (link.status !== 'ACTIVE') {
    throw ApiError.badRequest('Share link is not active (revoked or expired)');
  }
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    throw ApiError.badRequest('Share link has expired');
  }
  const [acceptance] = await req.tenantClient.$transaction([
    req.tenantClient.consentAcceptance.create({
      data: {
        consentId: id,
        shareLinkId: linkId,
        ipAddress: ipAddress ?? undefined,
        deviceInfo: deviceInfo ?? undefined,
        signatureData: signatureData ?? undefined,
        otpVerified: Boolean(otpVerified),
        receiptUrl: receiptUrl ?? undefined,
      },
    }),
    req.tenantClient.consentShareLink.update({
      where: { id: linkId },
      data: { usageCount: { increment: 1 } },
    }),
  ]);
  res.status(201).json({
    success: true,
    data: { acceptance },
  });
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { granted, type, metadata, name, description, lifecycleState, expiryDate } = req.body ?? {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }

  const data = {};
  if (typeof granted === 'boolean') data.granted = granted;
  if (typeof type === 'string' && type.trim()) data.type = type.trim();
  if (metadata !== undefined) data.metadata = metadata;
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (description !== undefined) data.description = description ?? null;
  if (lifecycleState === 'DRAFT' || lifecycleState === 'PUBLISHED' || lifecycleState === 'ARCHIVED') data.lifecycleState = lifecycleState;
  if (expiryDate !== undefined) data.expiryDate = expiryDate ? new Date(expiryDate) : null;

  const updated = await req.tenantClient.consent.update({
    where: { id },
    data: Object.keys(data).length ? data : undefined,
  });

  await recordConsentAudit(req.tenantClient, {
    entityId: id,
    action: ACTION_UPDATED,
    performedBy: req.user?.sub ?? null,
    oldData: { id: consent.id, type: consent.type, granted: consent.granted, metadata: consent.metadata, updatedAt: consent.updatedAt },
    newData: { id: updated.id, type: updated.type, granted: updated.granted, metadata: updated.metadata, updatedAt: updated.updatedAt },
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  });

  res.json({
    success: true,
    data: { consent: updated },
  });
});

/** POST /consents/:id/revoke – application-triggered revocation; immediate status update */
export const revokeConsent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const userId = req.user?.sub ?? null;
  await req.tenantClient.consentRevocation.create({
    data: {
      consentId: id,
      revokedByType: 'APPLICATION',
      revokedBy: userId,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : undefined,
    },
  });
  res.json({
    success: true,
    data: { revoked: true, consentId: id },
  });
});

export const softDelete = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  await recordConsentAudit(req.tenantClient, {
    entityId: id,
    action: ACTION_DELETED,
    performedBy: req.user?.sub ?? null,
    oldData: { id: consent.id, type: consent.type, granted: consent.granted, metadata: consent.metadata, updatedAt: consent.updatedAt },
    newData: { deleted: true },
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  });
  await req.tenantClient.consent.delete({
    where: { id },
  });
  res.json({
    success: true,
    data: { id, deleted: true },
  });
});

export const getVersions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consent = await req.tenantClient.consent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  res.json({
    success: true,
    data: { versions: [] },
  });
});

export default {
  list,
  getById,
  create,
  update,
  softDelete,
  getVersions,
  listLinks,
  createLink,
  updateLink,
  createApiKey,
  updateApiKey,
  getLinkStats,
  getLinkAcceptances,
  acceptViaLink,
  revokeConsent,
};
