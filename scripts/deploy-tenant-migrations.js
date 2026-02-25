#!/usr/bin/env node
/**
 * Deploy tenant schema migrations to every tenant database listed in the master DB.
 * Reads tenants from consent_master.tenants (where database_url IS NOT NULL) and
 * runs `prisma migrate deploy --schema=prisma/tenant/schema.prisma` for each URL.
 *
 * Usage: node scripts/deploy-tenant-migrations.js
 * Or:    npm run prisma:deploy:all-tenants
 *
 * Requires: MASTER_DATABASE_URL in .env
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '../src/generated/master/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tenantSchemaPath = path.join(__dirname, '..', 'prisma', 'tenant', 'schema.prisma');

async function main() {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) {
    console.error('MASTER_DATABASE_URL is not set. Cannot read tenants.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: masterUrl } },
  });

  try {
    const tenants = await prisma.tenant.findMany({
      where: { databaseUrl: { not: null } },
      select: { id: true, name: true, slug: true, databaseUrl: true },
    });

    if (tenants.length === 0) {
      console.log('No tenants with database_url found in master DB. Nothing to deploy.');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`Found ${tenants.length} tenant(s) with database_url. Deploying tenant migrations to each...\n`);

    let failed = 0;
    for (const tenant of tenants) {
      const url = tenant.databaseUrl;
      if (!url) continue;

      process.stdout.write(`  [${tenant.slug}] ${tenant.name} ... `);
      try {
        execSync(`npx prisma migrate deploy --schema=${tenantSchemaPath}`, {
          env: { ...process.env, TENANT_DATABASE_URL: url },
          stdio: 'pipe',
        });
        console.log('OK');
      } catch (err) {
        console.log('FAILED');
        console.error(`    Error: ${err.message || err}`);
        failed++;
      }
    }

    await prisma.$disconnect();

    if (failed > 0) {
      console.error(`\n${failed} tenant(s) failed.`);
      process.exit(1);
    }
    console.log('\nAll tenant databases are up to date.');
  } catch (err) {
    console.error('Error:', err.message || err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
