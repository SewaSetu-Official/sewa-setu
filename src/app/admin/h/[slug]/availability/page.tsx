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
  let ctx: Awaited<ReturnType<typeof requireHospitalAccess>>;

  try {
    ctx = await requireHospitalAccess(slug, "VIEW_AVAILABILITY");
  } catch {
    redirect("/admin/request-access");
  }

  const canManage = hasPermission(ctx.membership.role, "MANAGE_AVAILABILITY");
  return <AvailabilityClient slug={slug} canManage={canManage} role={ctx.membership.role} />;
}
