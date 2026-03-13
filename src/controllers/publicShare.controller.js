import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { masterDb } from '../db/index.js';
import { getTenantClientByTenantId } from '../db/tenant.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

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
 * If signer exists (by email or phone): link acceptance to them.
 * If new: require name + phone, create ConsentSigner with temp password, return credentials, send email (stub).
 * Body: email?, phone?, name?, ipAddress?, deviceInfo?, signatureData?, otpVerified?, receiptUrl?
 */
export const acceptByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const {
    ipAddress: bodyIp,
    deviceInfo,
    signatureData,
    otpVerified,
    receiptUrl,
    email: bodyEmail,
    phone: bodyPhone,
    name: bodyName,
  } = req.body || {};
  const ipAddress = bodyIp ?? req.ip ?? req.socket?.remoteAddress ?? undefined;
  const email = typeof bodyEmail === 'string' ? bodyEmail.trim() || null : null;
  const phone = typeof bodyPhone === 'string' ? bodyPhone.trim() || null : null;
  const name = typeof bodyName === 'string' ? bodyName.trim() || null : null;

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

  let consentSignerId = null;
  let newSignerPayload = null;

  if (email || phone) {
    const existing = await tenantClient.consentSigner.findFirst({
      where: email ? { email } : { phone },
    });
    if (existing) {
      consentSignerId = existing.id;
    }
  }

  if (!consentSignerId) {
    if (!name || (!phone && !email)) {
      throw ApiError.badRequest(
        'To create an account we need your name and phone number. If you already have an account, enter your email or phone above.'
      );
    }
    const temporaryPassword = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c] || '')).slice(0, 10);
    const passwordHash = await bcrypt.hash(temporaryPassword, config.bcryptRounds ?? 10);
    const signer = await tenantClient.consentSigner.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        passwordHash,
      },
    });
    consentSignerId = signer.id;
    newSignerPayload = {
      email: signer.email,
      phone: signer.phone,
      name: signer.name,
      temporaryPassword,
      emailSent: true,
    };
    logger.info('Consent signer created; email stub', {
      consentId: link.consentId,
      signerId: signer.id,
      email: signer.email,
    });
  }

  const [acceptance] = await tenantClient.$transaction([
    tenantClient.consentAcceptance.create({
      data: {
        consentId: link.consentId,
        shareLinkId: link.id,
        consentSignerId,
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
    data: {
      acceptance: { id: acceptance.id, acceptedAt: acceptance.acceptedAt },
      newSigner: newSignerPayload ?? undefined,
    },
  });
});

/**
 * POST /api/public/share/:token/revoke – user-initiated revocation.
 * Body: email, password, acceptanceId? (optional; if omitted, revoke latest active acceptance for this link + email).
 */
export const revokeByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { acceptanceId, email, password } = req.body || {};
  const emailTrim = typeof email === 'string' ? email.trim() : '';
  if (!emailTrim || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  const registry = await masterDb.shareLinkRegistry.findUnique({ where: { token } });
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
  let acceptance = null;
  if (acceptanceId) {
    acceptance = await tenantClient.consentAcceptance.findFirst({
      where: { id: acceptanceId, consentId: link.consentId, status: 'ACTIVE' },
      include: { consentSigner: true },
    });
  }
  if (!acceptance) {
    const signer = await tenantClient.consentSigner.findFirst({
      where: { email: emailTrim },
    });
    if (signer) {
      acceptance = await tenantClient.consentAcceptance.findFirst({
        where: { consentId: link.consentId, consentSignerId: signer.id, status: 'ACTIVE' },
        orderBy: { acceptedAt: 'desc' },
        include: { consentSigner: true },
      });
    }
  }
  if (!acceptance) {
    throw ApiError.notFound('Acceptance not found or already revoked');
  }
  if (!acceptance.consentSignerId || !acceptance.consentSigner) {
    throw ApiError.badRequest('This acceptance cannot be revoked (no linked account)');
  }
  const signer = acceptance.consentSigner;
  if ((signer.email || '').toLowerCase() !== emailTrim.toLowerCase()) {
    throw ApiError.unauthorized('Email does not match');
  }
  if (!signer.passwordHash) {
    throw ApiError.badRequest('Account has no password set');
  }
  const valid = await bcrypt.compare(password, signer.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid password');
  }
  const now = new Date();
  await tenantClient.$transaction([
    tenantClient.consentRevocation.create({
      data: {
        consentId: link.consentId,
        acceptanceId: acceptance.id,
        revokedByType: 'USER',
        consentSignerId: signer.id,
        reason: 'User-initiated revocation',
      },
    }),
    tenantClient.consentAcceptance.update({
      where: { id: acceptance.id },
      data: { status: 'REVOKED', revokedAt: now },
    }),
  ]);
  res.json({
    success: true,
    data: { revoked: true, acceptanceId: acceptance.id, revokedAt: now },
  });
});

/**
 * POST /api/public/consentee/login – consentee (signer) login to see their consents and revocation status.
 * Body: { email?, phone?, password }. At least one of email or phone required. No workspace – signer is looked up across tenants.
 * Returns signer info and list of acceptances with consent name, status, revokedAt.
 */
export const consenteeLogin = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body || {};
  const emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const phoneTrim = typeof phone === 'string' ? phone.trim() : '';
  if (!password) {
    throw ApiError.badRequest('Password is required');
  }
  if (!emailTrim && !phoneTrim) {
    throw ApiError.badRequest('Email or phone is required');
  }
  const tenants = await masterDb.tenant.findMany({
    where: { status: 'ACTIVE', databaseUrl: { not: null } },
    select: { id: true },
  });
  const signerWhere = [];
  if (emailTrim) signerWhere.push({ email: emailTrim });
  if (phoneTrim) signerWhere.push({ phone: phoneTrim });
  const whereClause = signerWhere.length > 1 ? { OR: signerWhere } : signerWhere[0];

  let matchedSigner = null;
  let matchedClient = null;

  for (const t of tenants) {
    try {
      const tenantClient = await getTenantClientByTenantId(masterDb, t.id);
      const signer = await tenantClient.consentSigner.findFirst({
        where: whereClause,
      });
      if (!signer || !signer.passwordHash) continue;
      const valid = await bcrypt.compare(password, signer.passwordHash);
      if (valid) {
        matchedSigner = signer;
        matchedClient = tenantClient;
        break;
      }
    } catch {
      // tenant DB may be unavailable, skip
    }
  }

  if (!matchedSigner || !matchedClient) {
    throw ApiError.unauthorized('Invalid email/phone or password');
  }

  const acceptances = await matchedClient.consentAcceptance.findMany({
    where: { consentSignerId: matchedSigner.id },
    orderBy: { acceptedAt: 'desc' },
    include: {
      consent: {
        select: { id: true, name: true, type: true, metadata: true },
      },
    },
  });
  const list = acceptances.map((a) => ({
    acceptanceId: a.id,
    consentId: a.consentId,
    consentName: a.consent?.metadata?.form?.title || a.consent?.name || a.consent?.type || 'Consent',
    acceptedAt: a.acceptedAt,
    status: a.status || 'ACTIVE',
    revokedAt: a.revokedAt,
  }));
  res.json({
    success: true,
    data: {
      signer: { id: matchedSigner.id, name: matchedSigner.name, email: matchedSigner.email, phone: matchedSigner.phone },
      acceptances: list,
    },
  });
});
