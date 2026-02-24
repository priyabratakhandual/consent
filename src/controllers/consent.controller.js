import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { recordConsentAudit, ACTION_CREATED, ACTION_UPDATED, ACTION_DELETED } from '../services/audit.service.js';

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

  // Immutable version (v1) and audit on every consent action
  await req.tenantClient.consentVersion.create({
    data: {
      consentId: consent.id,
      versionNumber: 1,
      userId: uid,
      type: typeVal,
      granted: grantedVal,
      metadata: metadata ?? undefined,
      changedBy: null,
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

  const nextVersion = await req.tenantClient.consentVersion
    .aggregate({ where: { consentId: id }, _max: { versionNumber: true } })
    .then((r) => (r._max?.versionNumber ?? 0) + 1);

  await req.tenantClient.consentVersion.create({
    data: {
      consentId: id,
      versionNumber: nextVersion,
      userId: consent.userId,
      type: updated.type,
      granted: updated.granted,
      metadata: updated.metadata ?? undefined,
      changedBy: req.user?.sub ?? null,
    },
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
  const versions = await req.tenantClient.consentVersion.findMany({
    where: { consentId: id },
    orderBy: { versionNumber: 'desc' },
  });
  res.json({
    success: true,
    data: { versions },
  });
});

export default { list, getById, create, update, softDelete, getVersions };
