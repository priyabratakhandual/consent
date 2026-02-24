import crypto from 'crypto';
import logger from '../utils/logger.js';

const ENTITY_CONSENT = 'CONSENT';
const ACTION_CREATED = 'CONSENT_CREATED';
const ACTION_UPDATED = 'CONSENT_UPDATED';
const ACTION_DELETED = 'CONSENT_DELETED';

/**
 * Compute hash for audit chain. Uses SHA-256(previousHash + payload).
 * @param {string} previousHash - previous event hash or 'genesis' for first event
 * @param {object} payload - event payload (entityType, entityId, action, etc.)
 * @returns {string} hex hash
 */
function computeAuditHash(previousHash, payload) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update((previousHash || 'genesis') + payloadStr).digest('hex');
}

/**
 * Record an audit event for consent (or other entity) with hash chaining.
 * Call this on every consent create/update so template/consent changes are audited.
 * @param {import('../generated/tenant/index.js').PrismaClient} tenantClient - tenant Prisma client
 * @param {object} params
 * @param {string} params.entityType - e.g. 'CONSENT'
 * @param {string} params.entityId - consent id
 * @param {string} params.action - e.g. 'CONSENT_CREATED', 'CONSENT_UPDATED'
 * @param {string} [params.performedBy] - user id (req.user.sub)
 * @param {object} [params.oldData] - previous state (for updates)
 * @param {object} [params.newData] - new state
 * @param {string} [params.ipAddress] - client IP
 */
export async function recordConsentAudit(tenantClient, params) {
  try {
    const { entityType, entityId, action, performedBy, oldData, newData, ipAddress } = params;
    const id = crypto.randomUUID();

    const lastEvent = await tenantClient.auditEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });
    const previousHash = lastEvent?.hash ?? null;

    const payload = {
      id,
      entityType: entityType || ENTITY_CONSENT,
      entityId,
      action,
      performedBy: performedBy ?? null,
      oldData: oldData ?? null,
      newData: newData ?? null,
      ipAddress: ipAddress ?? null,
      createdAt: new Date().toISOString(),
    };
    const hash = computeAuditHash(previousHash, payload);

    await tenantClient.auditEvent.create({
      data: {
        id,
        entityType: entityType || ENTITY_CONSENT,
        entityId,
        action,
        performedBy: performedBy ?? null,
        oldData: oldData ?? undefined,
        newData: newData ?? undefined,
        ipAddress: ipAddress ?? null,
        hash,
        previousHash,
      },
    });
    logger.debug('Audit event recorded', { entityType, entityId, action });
  } catch (err) {
    logger.warn('Audit event skipped (table may not exist)', { message: err?.message, action: params?.action });
  }
}

export { ENTITY_CONSENT, ACTION_CREATED, ACTION_UPDATED, ACTION_DELETED };
