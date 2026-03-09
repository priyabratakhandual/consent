#!/usr/bin/env node
/**
 * Create System tenant and a SUPER_ADMIN user (if not already present).
 * Usage: node scripts/seed-superadmin.js
 * Env:   SUPERADMIN_EMAIL (default: superadmin@system.local)
 *        SUPERADMIN_PASSWORD (default: SuperAdmin123! - change in production)
 *
 * Requires: MASTER_DATABASE_URL in .env
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import config from '../src/config/index.js';
import masterDb from '../src/db/master.js';

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'superadmin@system.local').trim().toLowerCase();
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
const BCRYPT_ROUNDS = config.bcryptRounds || 10;

async function main() {
  if (!config.database?.masterUrl) {
    console.error('MASTER_DATABASE_URL is not set.');
    process.exit(1);
  }

  await masterDb.$connect();

  let tenant = await masterDb.tenant.findUnique({
    where: { slug: 'system' },
  });

  if (!tenant) {
    tenant = await masterDb.tenant.create({
      data: {
        name: 'System',
        slug: 'system',
        status: 'ACTIVE',
        databaseUrl: null,
      },
    });
    console.log('Created System tenant:', tenant.id);
  } else {
    console.log('System tenant already exists:', tenant.id);
  }

  const existing = await masterDb.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: SUPERADMIN_EMAIL } },
  });

  if (existing) {
    if (existing.role === 'SUPER_ADMIN') {
      console.log('Superadmin user already exists:', SUPERADMIN_EMAIL);
    } else {
      await masterDb.user.update({
        where: { id: existing.id },
        data: { role: 'SUPER_ADMIN' },
      });
      console.log('Updated user role to SUPER_ADMIN:', SUPERADMIN_EMAIL);
    }
  } else {
    const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_ROUNDS);
    await masterDb.user.create({
      data: {
        tenantId: tenant.id,
        email: SUPERADMIN_EMAIL,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log('Created superadmin user:', SUPERADMIN_EMAIL);
  }

  await masterDb.$disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
