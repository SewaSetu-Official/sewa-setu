import { hasPermission, requireHospitalAccess } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import DoctorsClient from "./DoctorsClient";

export default async function DoctorsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let ctx;
  try {
    ctx = await requireHospitalAccess(slug, "VIEW_DOCTORS");
  } catch {
    redirect("/admin/request-access");
  }

  return <DoctorsClient slug={slug} canManage={hasPermission(ctx.membership.role, "MANAGE_DOCTORS")} />;
}
