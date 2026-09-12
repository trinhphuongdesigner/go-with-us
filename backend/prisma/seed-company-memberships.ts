/**
 * One-off backfill: creates a CompanyMembership row for every existing User
 * that already has a companyId, so multi-company support (CompanyMembership)
 * doesn't regress any single-company user — they end up with exactly the
 * membership they already implicitly had via User.companyId.
 *
 * Idempotent via skipDuplicates (CompanyMembership has @@unique([userId, companyId])),
 * so running this again is a no-op.
 *
 * Run with: npx ts-node prisma/seed-company-memberships.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { companyId: { not: null } },
    select: { id: true, companyId: true },
  });

  const result = await prisma.companyMembership.createMany({
    data: users.map((user) => ({
      userId: user.id,
      companyId: user.companyId as string,
    })),
    skipDuplicates: true,
  });

  console.log(`Backfilled ${result.count} CompanyMembership row(s) for ${users.length} user(s) with a companyId.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
