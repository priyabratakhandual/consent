/**
 * Seed consent form templates into the master DB. Run after migrations:
 *   npm run seed:templates
 *   (or: node scripts/seed-templates.js)
 *
 * Uses MASTER_DATABASE_URL. Templates live in the master DB "templates" table (not in tenant DBs).
 * Re-running this script replaces all existing templates with the full set below.
 */
import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/master/index.js';

function uuid() {
  return crypto.randomUUID();
}

/** Build form content for builder: { form: { title?, description?, blocks } } */
function formContent(title, description, blocks) {
  return { form: { title, description, blocks } };
}

const templates = [
  {
    title: 'Marketing Communications Consent',
    subtitle: 'Marketing',
    description: 'GDPR/CCPA-ready consent for email, SMS, and promotional communications. Used across e‑commerce, SaaS, and retail.',
    image: '📧',
    content: formContent(
      'Marketing Communications Consent',
      'We would like to send you updates and offers. You can change your preferences at any time.',
      [
        { id: uuid(), type: 'heading', label: 'Marketing Communications Consent', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'We would like to keep you informed about new products, offers, and events. Please select how you are happy to be contacted. You can withdraw consent or update preferences at any time.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'heading_h2', label: 'Contact preferences', size: 'H2', alignment: 'left', color: '#000000' },
        { id: uuid(), type: 'checkboxes', label: 'I agree to receive communications via:', required: true, options: ['Email', 'SMS', 'Post', 'Phone', 'Push notifications'] },
        { id: uuid(), type: 'email', label: 'Email address', required: true },
        { id: uuid(), type: 'short_answer', label: 'Phone number (optional)', required: false },
        { id: uuid(), type: 'checkbox', label: 'I have read the Privacy Notice and agree to the processing of my data for marketing purposes.', required: true },
      ]
    ),
  },
  {
    title: 'Analytics & Usage Data Consent',
    subtitle: 'Analytics',
    description: 'Consent for analytics, usage data, and product improvement. Common in SaaS, apps, and digital products.',
    image: '📊',
    content: formContent(
      'Analytics & Usage Data Consent',
      'Help us improve our product and services by allowing anonymous usage and analytics data collection.',
      [
        { id: uuid(), type: 'heading', label: 'Analytics & Usage Data Consent', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'We use analytics to understand how our product is used, fix issues, and improve your experience. Data is aggregated and anonymized where possible. You can withdraw consent at any time.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'heading_h2', label: 'Your choices', size: 'H2', alignment: 'left', color: '#000000' },
        { id: uuid(), type: 'switch', label: 'Allow usage analytics (e.g. page views, feature usage)', required: false },
        { id: uuid(), type: 'switch', label: 'Allow performance and error reporting', required: false },
        { id: uuid(), type: 'checkbox', label: 'I consent to the collection and use of analytics and usage data as described in the Privacy Policy.', required: true },
      ]
    ),
  },
  {
    title: 'Cookie Preferences',
    subtitle: 'Cookies',
    description: 'ePrivacy/GDPR cookie consent for non-essential cookies. Standard for websites and EU-facing apps.',
    image: '🍪',
    content: formContent(
      'Cookie Preferences',
      'Manage your cookie preferences. Essential cookies are always active; you can choose optional categories below.',
      [
        { id: uuid(), type: 'heading', label: 'Cookie Preferences', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'We use cookies to provide the service, improve experience, and for analytics and marketing. Essential cookies are required for the site to work. You can enable or disable optional categories below.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'heading_h2', label: 'Cookie categories', size: 'H2', alignment: 'left', color: '#000000' },
        { id: uuid(), type: 'checkboxes', label: 'I agree to the following types of cookies:', required: false, options: ['Strictly necessary (always on)', 'Analytics and performance', 'Marketing and advertising', 'Functional and preferences'] },
        { id: uuid(), type: 'checkbox', label: 'I have read the Cookie Policy and consent to my chosen cookie settings.', required: true },
      ]
    ),
  },
  {
    title: 'Terms of Service Acceptance',
    subtitle: 'Legal',
    description: 'Explicit acceptance of terms of service. Used at sign-up, checkout, or before accessing a service.',
    image: '📋',
    content: formContent(
      'Terms of Service',
      'Please read and accept our Terms of Service before continuing.',
      [
        { id: uuid(), type: 'heading', label: 'Terms of Service', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'By using this service you agree to be bound by our Terms of Service. Please read the full document via the link below before accepting.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'paragraph', label: 'Summary: You agree to use the service in accordance with applicable law, not to misuse the platform, and to comply with our acceptable use policy. We may update the terms; continued use after changes constitutes acceptance.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'checkbox', label: 'I have read and agree to the Terms of Service.', required: true },
        { id: uuid(), type: 'date_time', label: 'Date of acceptance', required: false },
      ]
    ),
  },
  {
    title: 'Privacy Policy Acceptance',
    subtitle: 'Legal',
    description: 'Consent and acknowledgment for processing personal data as described in the Privacy Policy.',
    image: '🔒',
    content: formContent(
      'Privacy Policy Acceptance',
      'We process your data as described in our Privacy Policy. Please confirm your acceptance below.',
      [
        { id: uuid(), type: 'heading', label: 'Privacy Policy Acceptance', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'Our Privacy Policy explains what personal data we collect, how we use it, who we share it with, and your rights (access, rectification, erasure, portability, objection, withdrawal of consent). We process data on the basis of consent, contract, or legitimate interest as set out in the policy.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'heading_h2', label: 'Your consent', size: 'H2', alignment: 'left', color: '#000000' },
        { id: uuid(), type: 'checkbox', label: 'I have read and understood the Privacy Policy and consent to the processing of my personal data as described therein.', required: true },
        { id: uuid(), type: 'email', label: 'Email (for consent record)', required: false },
      ]
    ),
  },
  {
    title: 'Health & Research Consent',
    subtitle: 'Healthcare',
    description: 'Consent for health-related data or participation in research. Used in health tech and clinical contexts.',
    image: '🏥',
    content: formContent(
      'Health & Research Consent',
      'Your participation is voluntary. You may withdraw consent at any time.',
      [
        { id: uuid(), type: 'heading', label: 'Health & Research Consent', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'This form records your consent to provide health-related information and/or participate in research. Data will be used only as described and in line with applicable regulations. You can withdraw consent at any time without affecting prior use.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'radio', label: 'I consent to:', required: true, options: ['Use of my health data for the stated purpose only', 'Use of my anonymized data for research', 'Contact regarding follow-up or related studies'] },
        { id: uuid(), type: 'checkbox', label: 'I have been informed of my rights and voluntarily give my consent.', required: true },
      ]
    ),
  },
  {
    title: 'Data Sharing & Third Parties',
    subtitle: 'Compliance',
    description: 'Consent to share data with partners or third parties. Used in B2B, integrations, and data ecosystems.',
    image: '🤝',
    content: formContent(
      'Data Sharing & Third Parties',
      'We may share your data with trusted partners to deliver the service. You can opt in or out below.',
      [
        { id: uuid(), type: 'heading', label: 'Data Sharing & Third Parties', size: 'H1', alignment: 'center', color: '#000000' },
        { id: uuid(), type: 'paragraph', label: 'To provide our services we may share relevant data with service providers and partners (e.g. payment, hosting, analytics). We require them to protect your data and use it only for the purposes we specify. You may withdraw consent for non-essential sharing at any time.', alignment: 'left', color: '#374151' },
        { id: uuid(), type: 'checkboxes', label: 'I consent to sharing my data with:', required: false, options: ['Payment and fraud prevention providers', 'Analytics and improvement partners', 'Support and communication tools', 'No third-party sharing beyond what is essential'] },
        { id: uuid(), type: 'checkbox', label: 'I have read the list of partners and consent to the selected data sharing.', required: true },
      ]
    ),
  },
];

const prisma = new PrismaClient();

async function main() {
  // Master DB (MASTER_DATABASE_URL) - templates table lives here
  const countBefore = await prisma.template.count();
  if (countBefore > 0) {
    const deleted = await prisma.template.deleteMany({});
    console.log('Removed', deleted.count, 'existing template(s) from master DB.');
  }
  for (const t of templates) {
    await prisma.template.create({
      data: {
        title: t.title,
        subtitle: t.subtitle ?? null,
        description: t.description,
        image: t.image ?? null,
        content: t.content ?? null,
      },
    });
  }
  console.log('Seeded', templates.length, 'templates into master DB (templates table).');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
