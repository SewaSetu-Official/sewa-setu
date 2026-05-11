import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

type ClerkUser = Awaited<ReturnType<typeof getClerkUser>>;

function resolveDisplayName(user: ClerkUser) {
  const parts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return user.fullName || parts || user.username || user.primaryEmailAddress?.emailAddress || "Unknown";
}

async function getClerkUser(clerkId: string) {
  const client = await clerkClient();
  return client.users.getUser(clerkId);
}

export async function ensureClerkUserInDb(clerkId: string) {
  try {
    const existingByClerkId = await db.user.findUnique({
      where: { clerkId },
    });

    if (existingByClerkId) {
      return existingByClerkId;
    }

    const clerkUser = await getClerkUser(clerkId);
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      return null;
    }

    const data = {
      email,
      fullName: resolveDisplayName(clerkUser),
      phone: clerkUser.phoneNumbers[0]?.phoneNumber ?? null,
    };

    const existingUser = await db.user.findFirst({
      where: { OR: [{ clerkId }, { email }] },
      select: { id: true },
    });

    if (existingUser) {
      return db.user.update({
        where: { id: existingUser.id },
        data: { ...data, clerkId },
      });
    }

    return db.user.create({
      data: {
        clerkId,
        ...data,
        country: "NP",
      },
    });
  } catch (error) {
    console.error("Failed to sync Clerk user to Prisma:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function syncCurrentClerkUserToDb() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return ensureClerkUserInDb(clerkId);
}
