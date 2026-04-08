/**
 * One-time script: creates a PLATFORM_ADMIN user in the DB.
 *
 * Usage:
 *   npx tsx prisma/seed-admin.ts <clerkId> <email> <fullName>
 *
 * Example:
 *   npx tsx prisma/seed-admin.ts user_2abc123 you@email.com "Your Name"
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [, , clerkId, email, fullName] = process.argv;

  if (!clerkId || !email || !fullName) {
    console.error("Usage: npx tsx prisma/seed-admin.ts <clerkId> <email> <fullName>");
    process.exit(1);
  }

  const user = await db.user.upsert({
    where: { clerkId },
    update: { role: "PLATFORM_ADMIN", email, fullName },
    create: { clerkId, email, fullName, role: "PLATFORM_ADMIN", country: "NP" },
  });

  console.log(`✅ Platform admin created: ${user.fullName} (${user.email})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
