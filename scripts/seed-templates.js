/**
 * Seed consent form templates into the master DB. Run after migrations:
 *   node scripts/seed-templates.js
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/master/index.js';

const templates = [
  { title: 'Marketing communications', subtitle: 'Marketing', description: 'Consent for email, SMS and promotional content', image: '📧' },
  { title: 'Analytics & usage', subtitle: 'Analytics', description: 'Consent for analytics and usage data collection', image: '📊' },
  { title: 'Cookie preferences', subtitle: 'Cookies', description: 'Consent for non-essential cookies', image: '🍪' },
  { title: 'Terms of service', subtitle: 'Legal', description: 'Acceptance of terms of service', image: '📋' },
  { title: 'Privacy policy', subtitle: 'Legal', description: 'Acceptance of privacy policy', image: '🔒' },
];

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.template.count();
  if (count > 0) {
    console.log('Templates already exist, skipping seed.');
    return;
  }
  for (const t of templates) {
    await prisma.template.create({ data: { ...t, content: null } });
  }
  console.log('Seeded', templates.length, 'templates.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
