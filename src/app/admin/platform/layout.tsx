import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import PlatformShell from "./PlatformShell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

  return <PlatformShell user={user}>{children}</PlatformShell>;
}
