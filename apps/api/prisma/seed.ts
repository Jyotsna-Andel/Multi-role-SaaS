import { PrismaClient, ProjectStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'Password123!';

const STATUSES: ProjectStatus[] = ['ACTIVE', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
const ADJECTIVES = ['Apollo', 'Borealis', 'Cobalt', 'Delta', 'Echo', 'Falcon', 'Granite', 'Helix', 'Ion', 'Juno'];
const NOUNS = ['Migration', 'Dashboard', 'Billing', 'Onboarding', 'Search'];

async function seedOrg(name: string, slug: string, users: { email: string; name: string; role: Role }[], projectCount: number) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, slug } });
    const created = [];
    for (const u of users) {
      created.push(await tx.user.create({ data: { ...u, passwordHash, orgId: org.id } }));
    }
    const admin = created[0];

    await tx.project.createMany({
      data: Array.from({ length: projectCount }, (_, i) => ({
        name: `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[i % NOUNS.length]} ${Math.floor(i / 10) + 1}`,
        description: `Seeded demo project #${i + 1} for ${name}.`,
        status: STATUSES[i % STATUSES.length],
        orgId: org.id,
        createdById: admin.id,
        // Spread creation dates so sorting/pagination is visible.
        createdAt: new Date(Date.now() - (projectCount - i) * 3_600_000),
      })),
    });

    await tx.auditLog.create({
      data: { orgId: org.id, actorId: admin.id, action: 'org.seeded', entity: 'Organization', entityId: org.id, metadata: { users: users.length, projects: projectCount } },
    });
    return org;
  });
}

async function main() {
  // Order matters: children first.
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  await seedOrg(
    'Acme Inc',
    'acme',
    [
      { email: 'admin@acme.test', name: 'Ada Admin', role: 'ADMIN' },
      { email: 'manager@acme.test', name: 'Max Manager', role: 'MANAGER' },
      { email: 'member@acme.test', name: 'Mia Member', role: 'MEMBER' },
      { email: 'intern@acme.test', name: 'Ian Intern', role: 'MEMBER' },
    ],
    42,
  );

  await seedOrg('Globex Corp', 'globex', [{ email: 'admin@globex.test', name: 'Gus Globex', role: 'ADMIN' }], 7);

  console.log(`Seeded 2 orgs. Demo password for every user: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
