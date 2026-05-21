import { requireHospitalAccess } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import BusinessClient from "./BusinessClient";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    await requireHospitalAccess(slug, "VIEW_OWNER_BUSINESS");
  } catch {
    redirect("/admin/request-access");
  }

  return <BusinessClient slug={slug} />;
}
