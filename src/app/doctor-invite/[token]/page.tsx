import { createHash } from "crypto";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/admin-auth";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";
import { db } from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function MessageCard({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8a96e]">Doctor invite</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#0f1e38]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
        {href && action && (
          <Link
            href={href}
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#142746] px-4 text-sm font-bold text-[#d8b975] no-underline"
          >
            {action}
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function DoctorInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const invite = await db.doctorInvite.findUnique({
    where: { tokenHash },
    include: {
      doctor: { select: { id: true, fullName: true, userId: true } },
      hospital: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!invite) {
    return <MessageCard title="Invite not found" body="This invite link is invalid. Please ask the hospital admin to send a new one." />;
  }

  if (invite.status !== "PENDING") {
    return <MessageCard title="Invite already used" body="This invite has already been accepted or revoked." />;
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    await db.doctorInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return <MessageCard title="Invite expired" body="This invite has expired. Please ask the hospital admin to send a new one." />;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/doctor-invite/${token}`)}`);
  }

  const user = await ensureClerkUserInDb(clerkId);
  if (!user) {
    return <MessageCard title="Account sync failed" body="We could not prepare your account. Please try signing out and signing in again." />;
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
    return (
      <MessageCard
        title="Email does not match"
        body={`This invite was sent to ${invite.email}. Please sign in with that email address to accept it.`}
        href="/sign-in"
        action="Switch account"
      />
    );
  }

  if (invite.doctor.userId && invite.doctor.userId !== user.id) {
    return <MessageCard title="Doctor already linked" body="This doctor profile is already linked to another account." />;
  }

  const existingDoctorForUser = await db.doctor.findFirst({
    where: { userId: user.id, id: { not: invite.doctorId } },
    select: { fullName: true },
  });

  if (existingDoctorForUser) {
    return (
      <MessageCard
        title="Account already linked"
        body={`This user account is already linked to ${existingDoctorForUser.fullName}. Please contact the hospital admin.`}
      />
    );
  }

  await db.$transaction(async (tx) => {
    await tx.doctor.update({
      where: { id: invite.doctorId },
      data: { userId: user.id },
    });

    await tx.hospitalMembership.upsert({
      where: { userId_hospitalId: { userId: user.id, hospitalId: invite.hospitalId } },
      create: {
        userId: user.id,
        hospitalId: invite.hospitalId,
        role: "DOCTOR",
        status: "APPROVED",
        invitedBy: invite.invitedById,
        approvedAt: new Date(),
        approvedById: invite.invitedById,
      },
      update: {
        role: "DOCTOR",
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: invite.invitedById,
      },
    });

    await tx.doctorInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedById: user.id,
        acceptedAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    actorUserId: user.id,
    hospitalId: invite.hospitalId,
    action: "DOCTOR_INVITE_ACCEPTED",
    entity: "Doctor",
    entityId: invite.doctorId,
    after: { doctorName: invite.doctor.fullName, email: invite.email },
  });

  return (
    <MessageCard
      title="Doctor account linked"
      body={`Your account is now linked to ${invite.doctor.fullName} at ${invite.hospital.name}.`}
      href={`/admin/h/${invite.hospital.slug}/dashboard`}
      action="Go to doctor dashboard"
    />
  );
}
