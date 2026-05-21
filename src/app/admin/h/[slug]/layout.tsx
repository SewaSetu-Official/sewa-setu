import { redirect } from "next/navigation";
import { requireHospitalAccess } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import HospitalAdminShell from "./HospitalAdminShell";
import { isPlatformAdmin } from "@/lib/admin-roles";

export default async function HospitalAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let ctx;
  try {
    ctx = await requireHospitalAccess(slug);
  } catch {
    redirect("/admin/request-access");
  }

  const hospital = await db.hospital.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, type: true, verified: true },
  });

  if (!hospital) redirect("/admin");

  // Role-aware booking badge for the sidebar.
  const pendingCount = await getBookingBadgeCount({
    hospitalId: hospital.id,
    role: ctx.membership.role,
    userId: ctx.user.id,
  });

  // Back link — platform admins go to platform dashboard
  // Staff with multiple hospitals go to select-hospital
  // Staff with one hospital have no back link
  let backLink: { href: string; label: string } | null = null;

  if (isPlatformAdmin(ctx.user.role)) {
    backLink = { href: "/admin/platform/dashboard", label: "Platform Admin" };
  } else {
    const membershipCount = await db.hospitalMembership.count({
      where: { userId: ctx.user.id, status: "APPROVED" },
    });
    if (membershipCount > 1) {
      backLink = { href: "/admin/select-hospital", label: "Switch Hospital" };
    }
  }

  return (
    <HospitalAdminShell
      hospital={hospital}
      user={ctx.user}
      role={ctx.membership.role}
      pendingCount={pendingCount}
      backLink={backLink}
    >
      {children}
    </HospitalAdminShell>
  );
}

async function getBookingBadgeCount({
  hospitalId,
  role,
  userId,
}: {
  hospitalId: string;
  role: string;
  userId: string;
}) {
  if (role === "STAFF") return 0;

  if (role === "DOCTOR") {
    const doctorProfile = await db.doctor.findFirst({
      where: {
        userId,
        hospitals: { some: { hospitalId } },
      },
      select: { id: true },
    });

    if (!doctorProfile) return 0;

    return db.booking.count({
      where: {
        hospitalId,
        doctorId: doctorProfile.id,
        status: "CONFIRMED",
        checkedInAt: { not: null },
      },
    });
  }

  return db.booking.count({
    where: { hospitalId, status: "REQUESTED" },
  });
}
