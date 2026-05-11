import { requireHospitalAccess } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-permissions";
import { redirect } from "next/navigation";
import AvailabilityClient from "./AvailabilityClient";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const ctx = await requireHospitalAccess(slug, "VIEW_AVAILABILITY");
    const canManage = hasPermission(ctx.membership.role, "MANAGE_AVAILABILITY");
    return <AvailabilityClient slug={slug} canManage={canManage} role={ctx.membership.role} />;
  } catch {
    redirect("/admin/request-access");
  }
}
