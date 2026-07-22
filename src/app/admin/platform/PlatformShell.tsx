"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutDashboard, Building2, Users, Inbox,
  CalendarDays, TrendingUp, ShieldCheck, Settings,
  Menu, X, Shield, LogOut, ChevronRight, UserCheck, ClipboardList,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { PLATFORM_ROLE_LABELS, isPlatformAdmin } from "@/lib/admin-roles";
import { hasPlatformPermission, type PlatformPermission } from "@/lib/admin-permissions";

type NavItem = { label: string; href: string; icon: React.ReactNode; permission: PlatformPermission };

// Each section is gated by a permission from the single platform matrix —
// no separate admin-only flags or path allow-lists to keep in sync.
const NAV: NavItem[] = [
  { label: "Dashboard",  href: "/admin/platform/dashboard",  icon: <LayoutDashboard size={17} />, permission: "VIEW_DASHBOARD" },
  { label: "Hospitals",  href: "/admin/platform/hospitals",  icon: <Building2 size={17} />,       permission: "VIEW_HOSPITALS" },
  { label: "Users",      href: "/admin/platform/users",      icon: <Users size={17} />,           permission: "VIEW_USERS" },
  { label: "Support",    href: "/admin/platform/support",    icon: <UserCheck size={17} />,       permission: "MANAGE_SUPPORT" },
  { label: "Inquiries",  href: "/admin/platform/inquiries",  icon: <Inbox size={17} />,           permission: "VIEW_INQUIRIES" },
  { label: "Setup",      href: "/admin/platform/onboarding", icon: <ClipboardList size={17} />,   permission: "VIEW_ONBOARDING" },
  { label: "Bookings",   href: "/admin/platform/bookings",   icon: <CalendarDays size={17} />,    permission: "VIEW_BOOKINGS" },
  { label: "Revenue",    href: "/admin/platform/revenue",    icon: <TrendingUp size={17} />,      permission: "VIEW_REVENUE" },
  { label: "Audit Logs", href: "/admin/platform/audit-logs", icon: <ShieldCheck size={17} />,     permission: "VIEW_AUDIT_LOGS" },
  { label: "Settings",   href: "/admin/platform/settings",   icon: <Settings size={17} />,         permission: "MANAGE_SETTINGS" },
];

function Sidebar({ user, pathname, mobile = false, onClose }: {
  user: { fullName: string; email: string; role: UserRole };
  pathname: string;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const isAdmin = isPlatformAdmin(user.role);
  const navItems = NAV.filter((item) => hasPlatformPermission(user.role, item.permission));

  return (
    <div className={`flex flex-col h-full ${mobile ? "" : "hidden lg:flex"}`}
      style={{ width: 240, background: "#0f1e38", flexShrink: 0 }}>

      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,.08)" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(200,169,110,.15)", border: "1px solid rgba(200,169,110,.25)" }}>
            <Shield size={16} className="text-[#c8a96e]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Sewa-Setu</p>
            <p className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,.35)" }}>
              {isAdmin ? "Platform Admin" : "Platform Support"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
              style={{
                background: active ? "rgba(200,169,110,.15)" : "transparent",
                borderLeft: active ? "3px solid #c8a96e" : "3px solid transparent",
              }}>
              <span style={{ color: active ? "#c8a96e" : "rgba(255,255,255,.45)" }}
                className="group-hover:text-[#c8a96e] transition-colors flex-shrink-0">
                {item.icon}
              </span>
              <span className="text-sm font-medium flex-1"
                style={{ color: active ? "#c8a96e" : "rgba(255,255,255,.65)" }}>
                {item.label}
              </span>
              {active && <ChevronRight size={12} className="text-[#c8a96e] opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,.08)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: "rgba(200,169,110,.2)", color: "#c8a96e" }}>
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,.35)" }}>
              {PLATFORM_ROLE_LABELS[user.role]}
            </p>
          </div>
        </div>
        <SignOutButton redirectUrl="/">
          <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ color: "rgba(255,255,255,.35)", background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,.35)"; e.currentTarget.style.background = "transparent" }}>
            <LogOut size={13} /> Sign Out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}

export default function PlatformShell({
  user, children,
}: {
  user: { fullName: string; email: string; role: UserRole };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const currentPageLabel = pathname === "/admin/platform/onboarding"
    ? "Hospital Setup"
    : pathname.split("/").pop()?.replace(/-/g, " ") ?? "Dashboard";

  // Access is derived from the same nav + matrix: if the current section maps to
  // a nav item this role can't access, bounce to the dashboard.
  const currentNav = NAV.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  const sectionAllowed = !currentNav || hasPlatformPermission(user.role, currentNav.permission);

  useEffect(() => {
    if (!sectionAllowed) {
      router.replace("/admin/platform/dashboard");
    }
  }, [sectionAllowed, router]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f7f4ef" }}>

      <Sidebar user={user} pathname={pathname} />

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col" style={{ width: 240 }}>
            <Sidebar user={user} pathname={pathname} mobile onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex-shrink-0 flex items-center gap-3 px-6 h-16 bg-white border-b border-gray-100">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "#f7f4ef" }}>
            {sidebarOpen ? <X size={17} className="text-[#0f1e38]" /> : <Menu size={17} className="text-[#0f1e38]" />}
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-400 font-medium hidden sm:block">Platform</span>
            <ChevronRight size={13} className="text-gray-300 hidden sm:block" />
            <span className="font-bold text-[#0f1e38] capitalize">
              {currentPageLabel}
            </span>
          </div>
        </header>

        <main className="admin-content flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
