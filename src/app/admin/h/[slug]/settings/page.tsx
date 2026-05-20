import { requireHospitalAccess } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let ctx;
  try {
    ctx = await requireHospitalAccess(slug, "MANAGE_PUBLIC_PROFILE");
  } catch {
    redirect("/admin/request-access");
  }

  return <SettingsClient slug={slug} role={ctx.membership.role} />;
}
