import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { recordConsentAudit, ACTION_CREATED, ACTION_UPDATED, ACTION_DELETED } from '../services/audit.service.js';

function getConsentMetadata(consent) {
  const base = consent.metadata && typeof consent.metadata === 'object' ? consent.metadata : {};
  if (!Array.isArray(base.links)) {
    base.links = [];
  }
  return base;
}

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
  const uid = userId ?? req.user?.sub;
  const typeVal = typeof type === 'string' ? type.trim() : type;
  const grantedVal = Boolean(granted);

  const consent = await req.tenantClient.consent.create({
    data: {
      userId: uid,
      type: typeVal,
      granted: grantedVal,
      metadata: metadata ?? undefined,
    },
  });

  await recordConsentAudit(req.tenantClient, {
    entityId: consent.id,
    action: ACTION_CREATED,
    performedBy: req.user?.sub ?? null,
    newData: { id: consent.id, userId: consent.userId, type: consent.type, granted: consent.granted, metadata: consent.metadata, createdAt: consent.createdAt },
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  });

  res.status(201).json({
    success: true,
    data: { consent },
  });
});

// ---------------------------------------------------------------------------
// Link management stored inside consent.metadata.links (no extra tables)
// ---------------------------------------------------------------------------

export const listLinks = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const metadata = getConsentMetadata(consent);
  res.json({
    success: true,
    data: { links: metadata.links },
  });
});

export const createLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { visibility = 'PUBLIC', expiresAt = null } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const metadata = getConsentMetadata(consent);
  const nowIso = new Date().toISOString();
  const linkId = crypto.randomUUID();
  const token = crypto.randomBytes(18).toString('base64url');
  const link = {
    id: linkId,
    token,
    visibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    status: 'ACTIVE',
    expiresAt: expiresAt || null,
    createdAt: nowIso,
    apiKeys: [],
  };
  metadata.links = [...metadata.links, link];
  const updated = await req.tenantClient.consent.update({
    where: { id },
    data: { metadata },
  });
  res.status(201).json({
    success: true,
    data: { consent: updated, link },
  });
});

export const updateLink = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const { visibility, status, expiresAt } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const metadata = getConsentMetadata(consent);
  const idx = metadata.links.findIndex((l) => l.id === linkId);
  if (idx === -1) {
    throw ApiError.notFound('Link not found');
  }
  const current = metadata.links[idx];
  const next = {
    ...current,
    visibility:
      visibility && (visibility === 'PUBLIC' || visibility === 'PRIVATE')
        ? visibility
        : current.visibility,
    status:
      status && (status === 'ACTIVE' || status === 'REVOKED' || status === 'EXPIRED')
        ? status
        : current.status,
    expiresAt: expiresAt !== undefined ? expiresAt || null : current.expiresAt,
  };
  metadata.links[idx] = next;
  const updated = await req.tenantClient.consent.update({
    where: { id },
    data: { metadata },
  });
  res.json({
    success: true,
    data: { consent: updated, link: next },
  });
});

export const createApiKey = asyncHandler(async (req, res) => {
  const { id, linkId } = req.params;
  const { name = '', expiresAt = null } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const metadata = getConsentMetadata(consent);
  const link = metadata.links.find((l) => l.id === linkId);
  if (!link) {
    throw ApiError.notFound('Link not found');
  }
  const keyId = crypto.randomUUID();
  const keyValue = crypto.randomBytes(24).toString('base64url');
  const apiKey = {
    id: keyId,
    name: name || 'API key',
    value: keyValue,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
  };
  link.apiKeys = Array.isArray(link.apiKeys) ? [...link.apiKeys, apiKey] : [apiKey];
  const updated = await req.tenantClient.consent.update({
    where: { id },
    data: { metadata },
  });
  res.status(201).json({
    success: true,
    data: { consent: updated, apiKey },
  });
});

export const updateApiKey = asyncHandler(async (req, res) => {
  const { id, linkId, keyId } = req.params;
  const { name, status, expiresAt } = req.body || {};
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }
  const metadata = getConsentMetadata(consent);
  const link = metadata.links.find((l) => l.id === linkId);
  if (!link || !Array.isArray(link.apiKeys)) {
    throw ApiError.notFound('API key not found');
  }
  const idx = link.apiKeys.findIndex((k) => k.id === keyId);
  if (idx === -1) {
    throw ApiError.notFound('API key not found');
  }
  const current = link.apiKeys[idx];
  const next = {
    ...current,
    name: name !== undefined ? name : current.name,
    status:
      status && (status === 'ACTIVE' || status === 'REVOKED' || status === 'EXPIRED')
        ? status
        : current.status,
    expiresAt: expiresAt !== undefined ? expiresAt || null : current.expiresAt,
  };
  link.apiKeys[idx] = next;
  const updated = await req.tenantClient.consent.update({
    where: { id },
    data: { metadata },
  });
  res.json({
    success: true,
    data: { consent: updated, apiKey: next },
  });
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { granted, type, metadata } = req.body;
  const consent = await req.tenantClient.consent.findUnique({ where: { id } });
  if (!consent) {
    throw ApiError.notFound('Consent not found');
  }

  const newGranted = typeof granted === 'boolean' ? granted : consent.granted;
  const newType = typeof type === 'string' && type.trim() ? type.trim() : consent.type;
  const newMetadata = metadata !== undefined ? metadata : consent.metadata;

  const updated = await req.tenantClient.consent.update({
    where: { id },
    data: { granted: newGranted, type: newType, metadata: newMetadata ?? undefined },
  });

  await recordConsentAudit(req.tenantClient, {
    entityId: id,
    action: ACTION_UPDATED,
    performedBy: req.user?.sub ?? null,
    oldData: { id: consent.id, userId: consent.userId, type: consent.type, granted: consent.granted, metadata: consent.metadata, updatedAt: consent.updatedAt },
    newData: { id: updated.id, userId: updated.userId, type: updated.type, granted: updated.granted, metadata: updated.metadata, updatedAt: updated.updatedAt },
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  });

  res.json({
    success: true,
    data: { consent: updated },
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
    oldData: { id: consent.id, userId: consent.userId, type: consent.type, granted: consent.granted, metadata: consent.metadata, updatedAt: consent.updatedAt },
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
};
