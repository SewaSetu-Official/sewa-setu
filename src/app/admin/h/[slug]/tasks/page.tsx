import { requireHospitalAccess } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import TasksClient from "./TasksClient";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    await requireHospitalAccess(slug, "VIEW_STAFF_TASKS");
  } catch {
    redirect("/admin/request-access");
  }

  return <TasksClient slug={slug} />;
}
