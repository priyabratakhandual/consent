import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { masterDb } from '../db/index.js';
import { getTenantClientByTenantId } from '../db/tenant.js';

/**
 * GET /api/public/share/:token – resolve consent + link by token (no auth).
 * Returns consent form data and link status for public share page.
 */
export const getByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const registry = await masterDb.shareLinkRegistry.findUnique({
    where: { token },
    include: { tenant: true },
  });
  if (!registry) {
    throw ApiError.notFound('Share link not found');
  }
  const tenantClient = await getTenantClientByTenantId(masterDb, registry.tenantId);
  const link = await tenantClient.consentShareLink.findUnique({
    where: { token },
    include: { consent: true },
  });
  if (!link || !link.consent) {
    throw ApiError.notFound('Share link not found');
  }
  if (link.consent.deletedAt) {
    throw ApiError.notFound('Consent no longer available');
  }
  if (link.status !== 'ACTIVE') {
    throw ApiError.badRequest('This share link is not active (revoked or expired)');
  }
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    throw ApiError.badRequest('This share link has expired');
  }
  if (link.visibility !== 'PUBLIC') {
    throw ApiError.badRequest('This link requires an API key');
  }
  const consent = link.consent;
  res.json({
    success: true,
    data: {
      consent: {
        id: consent.id,
        type: consent.type,
        name: consent.name,
        description: consent.description,
        metadata: consent.metadata,
      },
      link: {
        id: link.id,
        token: link.token,
        usageCount: link.usageCount,
        usageLimit: link.usageLimit,
      },
    },
  });
});

/**
 * POST /api/public/share/:token/accept – record acceptance via share link (no auth).
 * Body: ipAddress?, deviceInfo?, signatureData?, otpVerified?, receiptUrl?
 */
export const acceptByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { ipAddress: bodyIp, deviceInfo, signatureData, otpVerified, receiptUrl } = req.body || {};
  const ipAddress = bodyIp ?? req.ip ?? req.socket?.remoteAddress ?? undefined;
  const registry = await masterDb.shareLinkRegistry.findUnique({
    where: { token },
  });
  if (!registry) {
    throw ApiError.notFound('Share link not found');
  }
  const tenantClient = await getTenantClientByTenantId(masterDb, registry.tenantId);
  const link = await tenantClient.consentShareLink.findUnique({
    where: { token },
    include: { consent: true },
  });
  if (!link || !link.consent) {
    throw ApiError.notFound('Share link not found');
  }
  if (link.consent.deletedAt) {
    throw ApiError.notFound('Consent no longer available');
  }
  if (link.status !== 'ACTIVE') {
    throw ApiError.badRequest('Share link is not active (revoked or expired)');
  }
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    throw ApiError.badRequest('Share link has expired');
  }
  if (link.visibility !== 'PUBLIC') {
    throw ApiError.badRequest('This link requires an API key');
  }
  const [acceptance] = await tenantClient.$transaction([
    tenantClient.consentAcceptance.create({
      data: {
        consentId: link.consentId,
        shareLinkId: link.id,
        ipAddress,
        deviceInfo: deviceInfo ?? undefined,
        signatureData: signatureData ?? undefined,
        otpVerified: Boolean(otpVerified),
        receiptUrl: receiptUrl ?? undefined,
      },
    }),
    tenantClient.consentShareLink.update({
      where: { id: link.id },
      data: { usageCount: { increment: 1 } },
    }),
  ]);
  res.status(201).json({
    success: true,
    data: { acceptance: { id: acceptance.id, acceptedAt: acceptance.acceptedAt } },
  });
});
