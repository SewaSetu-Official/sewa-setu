"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, Star,
  TrendingUp, Settings, Menu, X, Shield, LogOut, ChevronRight,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const NAV: NavItem[] = [
  { label: "Dashboard",  href: "/admin/platform/dashboard",  icon: <LayoutDashboard size={17} /> },
  { label: "Hospitals",  href: "/admin/platform/hospitals",  icon: <Building2 size={17} /> },
  { label: "Users",      href: "/admin/platform/users",      icon: <Users size={17} /> },
  { label: "Reviews",    href: "/admin/platform/reviews",    icon: <Star size={17} /> },
  { label: "Revenue",    href: "/admin/platform/revenue",    icon: <TrendingUp size={17} /> },
  { label: "Settings",   href: "/admin/platform/settings",   icon: <Settings size={17} /> },
];

export default function PlatformShell({
  user,
  children,
}: {
  user: { fullName: string; email: string };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : "hidden lg:flex"}`}
      style={{ width: 240, background: "#0f1e38", flexShrink: 0 }}>

      {/* Identity */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,.08)" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(200,169,110,.15)", border: "1px solid rgba(200,169,110,.25)" }}>
            <Shield size={16} className="text-[#c8a96e]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Sewa-Setu</p>
            <p className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,.35)" }}>Platform Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
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
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,.35)" }}>Super Admin</p>
          </div>
        </div>
        <a href="/api/auth/sign-out"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ color: "rgba(255,255,255,.35)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,.35)"; e.currentTarget.style.background = "transparent"; }}>
          <LogOut size={13} /> Sign Out
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f7f4ef" }}>
      <Sidebar />

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col" style={{ width: 240 }}>
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 px-4 h-14 border-b lg:hidden"
          style={{ background: "#0f1e38", borderColor: "rgba(255,255,255,.08)" }}>
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu size={20} />
          </button>
          <p className="text-sm font-bold text-white flex-1">Platform Admin</p>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="text-white">
              <X size={20} />
            </button>
          )}
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
