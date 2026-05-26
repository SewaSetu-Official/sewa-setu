"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutDashboard, CalendarCheck, Stethoscope, Clock,
  Package, Star, Users, BarChart2, Settings, CreditCard,
  Menu, Building2, ChevronRight, LogOut, ClipboardList,
} from "lucide-react";
import type { HospitalRole } from "@prisma/client";
import { hasPermission } from "@/lib/admin-permissions";
import { HOSPITAL_ROLE_LABELS } from "@/lib/admin-roles";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  permission?: Parameters<typeof hasPermission>[1];
};

function SidebarContent({
  mobile = false,
  backLink,
  hospital,
  navItems,
  pathname,
  role,
  setSidebarOpen,
  user,
}: {
  mobile?: boolean;
  backLink?: { href: string; label: string } | null;
  hospital: { name: string; slug: string; type: string; verified: boolean };
  navItems: NavItem[];
  pathname: string;
  role: HospitalRole;
  setSidebarOpen: (open: boolean) => void;
  user: { fullName: string; email: string };
}) {
  return (
    <div
      className={`flex flex-col h-full ${mobile ? "" : "hidden lg:flex"}`}
      style={{ width: 240, background: "#0f1e38", flexShrink: 0 }}
    >
      {backLink && (
        <div className="px-4 pt-3 pb-1">
          <Link
            href={backLink.href}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
            style={{ color: "rgba(255,255,255,.35)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c8a96e"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.35)"; }}
          >
            <ChevronRight size={11} className="rotate-180 flex-shrink-0" />
            {backLink.label}
          </Link>
        </div>
      )}

      <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,.08)" }}>
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(200,169,110,.15)", border: "1px solid rgba(200,169,110,.25)" }}
          >
            <Building2 size={16} className="text-[#c8a96e]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{hospital.name}</p>
            <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,.35)" }}>
              {hospital.type}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
              style={{
                background: active ? "rgba(200,169,110,.15)" : "transparent",
                borderLeft: active ? "3px solid #c8a96e" : "3px solid transparent",
              }}
            >
              <span
                style={{ color: active ? "#c8a96e" : "rgba(255,255,255,.45)" }}
                className="group-hover:text-[#c8a96e] transition-colors flex-shrink-0"
              >
                {item.icon}
              </span>
              <span
                className="text-sm font-medium flex-1"
                style={{ color: active ? "#c8a96e" : "rgba(255,255,255,.65)" }}
              >
                {item.label}
              </span>
              {item.badge ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#c8a96e", color: "#0f1e38" }}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,.08)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: "rgba(200,169,110,.2)", color: "#c8a96e" }}
          >
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
            <p className="text-[10px] capitalize" style={{ color: "rgba(255,255,255,.35)" }}>
              {HOSPITAL_ROLE_LABELS[role] ?? role}
            </p>
          </div>
        </div>
        <SignOutButton redirectUrl="/">
          <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ color: "rgba(255,255,255,.35)", background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,.35)"; e.currentTarget.style.background = "transparent" }}
        >
            <LogOut size={13} /> Sign Out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}

export default function HospitalAdminShell({
  hospital,
  user,
  role,
  pendingCount,
  backLink,
  children,
}: {
  hospital: { name: string; slug: string; type: string; verified: boolean };
  user: { fullName: string; email: string };
  role: HospitalRole;
  pendingCount: number;
  backLink?: { href: string; label: string } | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const base = `/admin/h/${hospital.slug}`;

  const navItems = ([
    { label: "Dashboard",    href: `${base}/dashboard`,     icon: <LayoutDashboard size={17} /> },
    { label: "Bookings",     href: `${base}/bookings`,      icon: <CalendarCheck size={17} />,   badge: pendingCount || undefined, permission: "VIEW_BOOKINGS" },
    { label: "Doctors",      href: `${base}/doctors`,       icon: <Stethoscope size={17} />,     permission: "VIEW_DOCTORS" },
    { label: "Schedules",    href: `${base}/availability`,  icon: <Clock size={17} />,            permission: "VIEW_AVAILABILITY" },
    { label: "Packages",     href: `${base}/packages`,      icon: <Package size={17} />,          permission: "MANAGE_PACKAGES" },
    { label: "Reviews",      href: `${base}/reviews`,       icon: <Star size={17} />,             permission: "MODERATE_REVIEWS" },
    { label: "Team",         href: `${base}/team`,          icon: <Users size={17} />,            permission: "VIEW_TEAM" },
    { label: "Tasks",        href: `${base}/tasks`,         icon: <ClipboardList size={17} />,    permission: "VIEW_STAFF_TASKS" },
    { label: "Reports",      href: `${base}/reports`,       icon: <BarChart2 size={17} />,        permission: "VIEW_REPORTS" },
    { label: "Business",     href: `${base}/business`,      icon: <CreditCard size={17} />,       permission: "VIEW_OWNER_BUSINESS" },
    { label: "Settings",     href: `${base}/settings`,      icon: <Settings size={17} />,         permission: "MANAGE_PUBLIC_PROFILE" },
  ] as NavItem[]).filter((item) => !item.permission || hasPermission(role, item.permission));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f7f4ef" }}>
      {/* Desktop sidebar */}
      <SidebarContent
        backLink={backLink}
        hospital={hospital}
        navItems={navItems}
        pathname={pathname}
        role={role}
        setSidebarOpen={setSidebarOpen}
        user={user}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col" style={{ width: 240 }}>
            <SidebarContent
              mobile
              backLink={backLink}
              hospital={hospital}
              navItems={navItems}
              pathname={pathname}
              role={role}
              setSidebarOpen={setSidebarOpen}
              user={user}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: "#f7f4ef" }}
            >
              <Menu size={17} className="text-[#0f1e38]" />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-400 font-medium hidden sm:block">{hospital.name}</span>
              <ChevronRight size={13} className="text-gray-300 hidden sm:block" />
              <span className="font-bold text-[#0f1e38] capitalize">
                {pathname.split("/").pop()?.replace(/-/g, " ") ?? "Dashboard"}
              </span>
            </div>
          </div>

          {hospital.verified && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(34,197,94,.1)", color: "#16a34a" }}>
              ✓ Verified
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="admin-content flex-1 overflow-y-auto p-6">
          <div className="admin-page-frame">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
