"use client";

import { useMemo, useState, useEffect } from "react";
import type { ApiDoctor } from "@/types/hospital";
import type { ApiHospitalDetails } from "@/types/hospital-details";
import { PackageAccordion } from "@/components/package-accordion";
import { PackageCard } from "@/components/package-card";
import { DoctorCard } from "@/components/doctor-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewsSection } from "@/components/reviews-section";
import * as lucideReact from "lucide-react";
type TabKey = "overview" | "services" | "doctors" | "departments" | "contact";

type UiPackage = {
  id: string;
  name: string;
  price: number;
  discount?: string;
  features: string[];
};

type Props = {
  hospital: ApiHospitalDetails;
  packages: UiPackage[];
  onBookDoctorAction: (doctorId: string) => void;
  initialDepartmentId?: string | null;
  showAIBadge?: boolean;
  hospitalId?: string;
};

export function HospitalTabs({
  hospital,
  packages,
  onBookDoctorAction,
  initialDepartmentId,
  showAIBadge = false,
  hospitalId,
}: Props) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(initialDepartmentId || null);
  const [highlightedDeptId, setHighlightedDeptId] = useState<string | null>(initialDepartmentId || null);

  // Handle initial department selection
  useEffect(() => {
    if (initialDepartmentId) {
      setTab("departments");
      setSelectedDeptId(initialDepartmentId);
      setHighlightedDeptId(initialDepartmentId);
      
      const timer = setTimeout(() => {
        setHighlightedDeptId(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [initialDepartmentId]);

  const selectedDept = useMemo(() => {
    if (!selectedDeptId) return null;
    return hospital.departments?.find((d) => d.id === selectedDeptId) ?? null;
  }, [hospital.departments, selectedDeptId]);

  const deptDoctorIdSet = useMemo(() => {
    if (!selectedDept) return new Set<string>();
    const ids = (selectedDept.doctors ?? []).map((x) => x.doctorId);
    return new Set(ids);
  }, [selectedDept]);

  const deptDoctors = useMemo(() => {
    if (!selectedDept) return [];
    return hospital.doctors.filter((d) => deptDoctorIdSet.has(d.id));
  }, [hospital.doctors, deptDoctorIdSet, selectedDept]);

  const [doctorQuery, setDoctorQuery] = useState("");
  const [specialty, setSpecialty] = useState<string>("ALL");
  const [sort, setSort] = useState<"FEE_ASC" | "FEE_DESC">("FEE_ASC");

  // Map doctorId → department name (database order)
  const doctorDeptMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const dept of (hospital.departments ?? [])) {
      for (const link of (dept.doctors ?? [])) {
        if (!map.has(link.doctorId)) {
          map.set(link.doctorId, dept.name);
        }
      }
    }
    return map;
  }, [hospital.departments]);

  // Department name order for stable group sorting
  const deptOrder = useMemo(() => {
    const order = new Map<string, number>();
    (hospital.departments ?? []).forEach((d, i) => order.set(d.name, i));
    return order;
  }, [hospital.departments]);

  // Filter dropdown lists all department names in order
  const allSpecialties = useMemo(() => {
    return (hospital.departments ?? []).map((d) => d.name);
  }, [hospital.departments]);

  const filteredDoctors = useMemo(() => {
    let docs = [...hospital.doctors];
    const q = doctorQuery.trim().toLowerCase();
    if (q) docs = docs.filter((d) => d.fullName.toLowerCase().includes(q));
    if (specialty !== "ALL") docs = docs.filter((d) => doctorDeptMap.get(d.id) === specialty);
    if (sort === "FEE_ASC") docs.sort((a, b) => (a.feeMin ?? 0) - (b.feeMin ?? 0));
    else docs.sort((a, b) => (b.feeMin ?? 0) - (a.feeMin ?? 0));
    return docs;
  }, [hospital.doctors, doctorQuery, specialty, sort, doctorDeptMap]);

  const groupedDoctors = useMemo(() => {
    const groups = new Map<string, ApiDoctor[]>();
    for (const d of filteredDoctors) {
      const key = doctorDeptMap.get(d.id) ?? "Other";
      const arr = groups.get(key) ?? [];
      arr.push(d);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const ia = deptOrder.get(a[0]) ?? 999;
      const ib = deptOrder.get(b[0]) ?? 999;
      return ia !== ib ? ia - ib : a[0].localeCompare(b[0]);
    });
  }, [filteredDoctors, doctorDeptMap, deptOrder]);

  const TABS: { k: TabKey; label: string }[] = [
    { k: "overview",     label: "Overview" },
    { k: "services",     label: "Services & Packages" },
    { k: "doctors",      label: "Doctors" },
    { k: "departments",  label: "Departments" },
    { k: "contact",      label: "Contact" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Interstate:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');

        .ht-nav {
          display: flex; flex-wrap: nowrap; gap: .45rem;
          padding-bottom: 1.4rem;
          border-bottom: 1px solid rgba(15,30,56,.08);
          margin-bottom: 1.75rem;
        }
        .ht-tab-btn {
          flex: 1;
          padding: .75rem 1rem;
          border-radius: 8px;
          font-size: .9rem; font-weight: 500;
          cursor: pointer; white-space: nowrap;
          text-align: center;
          border: 1px solid rgba(15,30,56,.12);
          background: transparent; color: #6b7a96;
          transition: all .18s ease;
          font-family: 'Interstate', sans-serif;
        }
        .ht-tab-btn:hover {
          border-color: rgba(200,169,110,.4);
          color: #a88b50;
          background: rgba(200,169,110,.05);
        }
        .ht-tab-btn.active {
          background: #0f1e38; color: #c8a96e;
          border-color: #0f1e38;
          font-weight: 600;
          box-shadow: 0 2px 12px rgba(15,30,56,.2);
        }

        .ht-head { display:flex; align-items:center; gap:.8rem; margin-bottom:1.25rem; }
        .ht-icon {
          width:40px; height:40px; border-radius:10px;
          background:#0f1e38; display:flex; align-items:center; justify-content:center;
          flex-shrink:0; box-shadow:0 3px 12px rgba(15,30,56,.22);
        }
        .ht-icon svg { color:#c8a96e !important; }
        .ht-title {
          font-family:'Plus Jakarta Sans',sans-serif;
          font-size:1.1rem; font-weight:700; color:#0f1e38; line-height:1.2;
        }
        .ht-sub { font-size:.78rem; color:#6b7a96; margin-top:.12rem; }

        .ht-card {
          background:#f7f4ef;
          border:1px solid rgba(15,30,56,.08);
          border-radius:14px; padding:1.4rem;
          margin-bottom:1rem;
        }
        .ht-card-white {
          background:#fff;
          border:1px solid rgba(15,30,56,.08);
          border-radius:14px; padding:1.4rem;
          margin-bottom:1rem;
          box-shadow:0 2px 10px rgba(15,30,56,.05);
        }

        .ht-stats {
          display:grid; gap:.75rem;
          grid-template-columns:repeat(auto-fit, minmax(140px,1fr));
          margin-top:1.1rem;
        }
        .ht-stat {
          background:#fff; border:1px solid rgba(15,30,56,.09);
          border-radius:12px; padding:1rem .9rem;
          transition:all .2s;
        }
        .ht-stat:hover { box-shadow:0 5px 18px rgba(15,30,56,.09); transform:translateY(-2px); }
        .ht-stat-ico {
          width:32px; height:32px; border-radius:8px;
          background:rgba(200,169,110,.1);
          border:1px solid rgba(200,169,110,.2);
          display:flex; align-items:center; justify-content:center;
          margin-bottom:.4rem;
        }
        .ht-stat-ico svg { color:#a88b50 !important; }
        .ht-stat-lbl { font-size:.7rem; color:#6b7a96; font-weight:500; }
        .ht-stat-val {
          font-family:'Plus Jakarta Sans',sans-serif;
          font-size:1.4rem; font-weight:700; color:#0f1e38; line-height:1.05;
        }

        .ht-badges { display:flex; flex-wrap:wrap; gap:.45rem; margin-bottom:1rem; }
        .ht-badge {
          display:inline-flex; align-items:center; gap:.3rem;
          padding:.28rem .7rem; border-radius:100px;
          font-size:.7rem; font-weight:600; border:1px solid;
        }
        .ht-badge-green { background:rgba(74,222,128,.08); color:#15803d; border-color:rgba(74,222,128,.25); }
        .ht-badge-red   { background:rgba(239,68,68,.07);  color:#b91c1c; border-color:rgba(239,68,68,.2); }
        .ht-badge-gold  { background:rgba(200,169,110,.1);  color:#a88b50; border-color:rgba(200,169,110,.28); }

        .ht-prose { font-size:.875rem; line-height:1.7; color:#3d506e; }

        .ht-actions { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1.2rem; }
        .ht-btn {
          display:inline-flex; align-items:center; gap:.38rem;
          padding:.5rem 1.05rem; border-radius:8px;
          font-size:.8rem; font-weight:600; cursor:pointer;
          font-family:'Interstate',sans-serif;
          transition:all .18s ease;
        }
        .ht-btn-navy {
          background:#0f1e38; color:#c8a96e; border:none;
          box-shadow:0 3px 12px rgba(15,30,56,.22);
        }
        .ht-btn-navy:hover { background:#1a3059; transform:translateY(-1px); }
        .ht-btn-ghost {
          background:transparent; color:#3d506e;
          border:1px solid rgba(15,30,56,.18);
        }
        .ht-btn-ghost:hover {
          border-color:rgba(200,169,110,.45); color:#a88b50;
          background:rgba(200,169,110,.05);
        }

        .ht-filter {
          background:#fff; border:1px solid rgba(15,30,56,.09);
          border-radius:14px; padding:1.1rem 1.35rem;
          margin-bottom:1.4rem;
          box-shadow:0 2px 10px rgba(15,30,56,.05);
        }
        .ht-filter-grid {
          display:grid; gap:.6rem;
          grid-template-columns:repeat(auto-fit, minmax(155px,1fr));
          margin-top:.75rem;
        }
        .ht-select {
          height:37px; border-radius:8px; padding:0 .7rem;
          border:1px solid rgba(15,30,56,.14);
          background:#f7f4ef; font-size:.8rem; color:#0f1e38;
          outline:none; font-family:'Interstate',sans-serif;
          transition:border-color .18s;
          width:100%; min-width:0;
        }
        .ht-select:focus {
          border-color:rgba(200,169,110,.5);
          box-shadow:0 0 0 2px rgba(200,169,110,.1);
        }
        .ht-filter-foot {
          display:flex; justify-content:space-between; align-items:center;
          margin-top:.75rem; padding-top:.75rem;
          border-top:1px solid rgba(15,30,56,.07);
        }
        .ht-check-label {
          display:flex; align-items:center; gap:.4rem;
          font-size:.8rem; color:#3d506e; cursor:pointer;
        }
        .ht-pill {
          font-size:.75rem; font-weight:600; color:#a88b50;
          background:rgba(200,169,110,.1);
          border:1px solid rgba(200,169,110,.22);
          border-radius:100px; padding:.18rem .65rem;
        }

        .ht-group { display:flex; align-items:center; gap:.6rem; margin:1.6rem 0 .75rem; }
        .ht-group-bar { width:3px; height:20px; border-radius:2px; background:linear-gradient(180deg,#c8a96e,#a88b50); }
        .ht-group-name { font-family:'Plus Jakarta Sans',sans-serif; font-size:.95rem; font-weight:700; color:#0f1e38; }
        .ht-group-ct { font-size:.7rem; font-weight:600; color:#a88b50; background:rgba(200,169,110,.1); border:1px solid rgba(200,169,110,.22); border-radius:100px; padding:.18rem .6rem; }

        .ht-doc-grid { display:grid; gap:.75rem; grid-template-columns:repeat(auto-fill, minmax(275px,1fr)); }

        .ht-dept-grid { display:grid; gap:.85rem; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); }
        .ht-dept-card {
          background:#fff; border:1px solid rgba(15,30,56,.09);
          border-radius:14px; padding:1.25rem; text-align:left; cursor:pointer;
          transition:all .3s ease; box-shadow:0 2px 8px rgba(15,30,56,.05);
          display:flex; flex-direction:column;
          position:relative; overflow:hidden;
        }
        .ht-dept-card:hover { border-color:#c8a96e; box-shadow:0 16px 40px rgba(15,30,56,.13); transform:translateY(-3px); }
        .ht-dept-card.highlighted {
          border-color: #c8a96e;
          box-shadow: 0 0 0 2px #c8a96e, 0 16px 40px rgba(200,169,110,0.2);
          animation: pulseHighlight 2s ease-in-out;
        }
        
        @keyframes pulseHighlight {
          0%, 100% { box-shadow: 0 0 0 2px #c8a96e, 0 16px 40px rgba(200,169,110,0.2); }
          50% { box-shadow: 0 0 0 4px #c8a96e, 0 20px 48px rgba(200,169,110,0.3); }
        }

        .ht-recommended-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: #c8a96e;
          color: #0f1e38;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 100px;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 2;
          box-shadow: 0 2px 8px rgba(200,169,110,0.3);
        }

        .ht-dept-overlay {
          position:absolute; top:0; left:0; right:0; height:80px;
          background:linear-gradient(135deg, rgba(200,169,110,.12), rgba(200,169,110,.05) 60%, transparent);
          opacity:0; transition:opacity .3s;
          pointer-events:none;
        }
        .ht-dept-card:hover .ht-dept-overlay { opacity:1; }
        .ht-dept-ico {
          width:42px; height:42px; border-radius:10px; background:#0f1e38;
          display:flex; align-items:center; justify-content:center; margin-bottom:.9rem;
          transition:background .3s;
        }
        .ht-dept-card:hover .ht-dept-ico { background:#1a3059; }
        .ht-dept-ico svg { color:#c8a96e !important; }
        .ht-dept-name { font-family:'Plus Jakarta Sans',sans-serif; font-size:.92rem; font-weight:700; color:#0f1e38; margin-bottom:.35rem; line-height:1.35; transition:color .3s; }
        .ht-dept-card:hover .ht-dept-name { color:#a88b50; }
        .ht-dept-text { font-size:.76rem; color:#6b7a96; line-height:1.55; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; flex:1; }
        .ht-dept-foot {
          display:flex; justify-content:space-between; align-items:center;
          margin-top:.9rem; padding-top:.7rem;
          border-top:1px solid rgba(15,30,56,.07);
        }
        .ht-dept-ct { font-size:.7rem; font-weight:600; color:#a88b50; background:rgba(200,169,110,.1); border:1px solid rgba(200,169,110,.2); border-radius:100px; padding:.17rem .58rem; }
        .ht-dept-arrow { color:#9aaac0; transition:transform .2s, color .2s; }
        .ht-dept-card:hover .ht-dept-arrow { transform:translateX(4px); color:#c8a96e; }

        .ht-back {
          display:inline-flex; align-items:center; gap:.38rem;
          font-size:.8rem; font-weight:600; color:#6b7a96;
          background:none; border:none; cursor:pointer; padding:0;
          margin-bottom:.9rem; font-family:'Interstate',sans-serif;
          transition:color .18s;
        }
        .ht-back:hover { color:#a88b50; }

        .ht-contact-grid { display:grid; gap:.6rem; grid-template-columns:repeat(auto-fit, minmax(195px,1fr)); }
        .ht-contact-item {
          display:flex; align-items:center; gap:.7rem;
          background:#fff; border:1px solid rgba(15,30,56,.09);
          border-radius:10px; padding:.85rem .9rem;
          text-decoration:none; transition:all .18s;
        }
        .ht-contact-item.link:hover { border-color:rgba(200,169,110,.4); box-shadow:0 4px 14px rgba(15,30,56,.08); }
        .ht-contact-ico {
          width:34px; height:34px; border-radius:8px;
          background:rgba(200,169,110,.1); border:1px solid rgba(200,169,110,.2);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .ht-contact-ico svg { color:#a88b50 !important; }
        .ht-contact-key { font-size:.66rem; font-weight:500; color:#9aaac0; text-transform:uppercase; letter-spacing:.1em; }
        .ht-contact-val { font-size:.8rem; font-weight:600; color:#0f1e38; margin-top:.08rem; }
        .ht-contact-val.gold { color:#a88b50; }

        .ht-info {
          display:flex; gap:.8rem; align-items:flex-start;
          background:rgba(200,169,110,.06);
          border:1px solid rgba(200,169,110,.2);
          border-radius:12px; padding:1rem 1.15rem; margin-top:1.1rem;
        }
        .ht-info-ico {
          width:32px; height:32px; border-radius:8px;
          background:rgba(200,169,110,.14);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .ht-info-ico svg { color:#a88b50 !important; }
        .ht-info-title { font-size:.83rem; font-weight:600; color:#0f1e38; margin-bottom:.45rem; }
        .ht-info-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.38rem; }
        .ht-info-list li { display:flex; gap:.45rem; align-items:flex-start; font-size:.78rem; color:#3d506e; line-height:1.5; }
        .ht-info-list li svg { color:#a88b50 !important; flex-shrink:0; margin-top:2px; }

        .ht-top-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:.9rem; }
        .ht-view-all {
          display:inline-flex; align-items:center; gap:.35rem;
          font-size:.75rem; font-weight:600; color:#a88b50;
          background:rgba(200,169,110,.08); border:1px solid rgba(200,169,110,.22);
          border-radius:100px; padding:.28rem .8rem;
          cursor:pointer; font-family:'Outfit',sans-serif; transition:all .18s;
        }
        .ht-view-all:hover { background:rgba(200,169,110,.16); border-color:rgba(200,169,110,.42); }

        .ht-empty {
          display:flex; flex-direction:column; align-items:center;
          padding:3.5rem 2rem; background:#fff;
          border:1.5px dashed rgba(15,30,56,.13);
          border-radius:14px; text-align:center; gap:.6rem;
          color:#9aaac0;
        }
        .ht-empty svg { opacity:.3; }
        .ht-empty-t { font-size:.92rem; font-weight:600; color:#6b7a96; }
        .ht-empty-s { font-size:.78rem; color:#9aaac0; }
      `}</style>

      <div style={{ marginTop: ".25rem" }}>

        {/* Tab nav */}
        <nav className="ht-nav">
          {TABS.map(({ k, label }) => (
            <button
              key={k}
              className={`ht-tab-btn${tab === k ? " active" : ""}`}
              onClick={() => { setTab(k); if (k !== "departments") setSelectedDeptId(null); }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div>
            <div className="ht-card">
              <div className="ht-badges">
                {hospital.verified && (
                  <span className="ht-badge ht-badge-green"><lucideReact.CheckCircle2 size={11} /> Verified</span>
                )}
                {hospital.emergencyAvailable && (
                  <span className="ht-badge ht-badge-red"><lucideReact.Siren size={11} /> Emergency</span>
                )}
                {hospital.openingHours && (
                  <span className="ht-badge ht-badge-gold"><lucideReact.Clock size={11} /> {hospital.openingHours}</span>
                )}
                {hospital.tags?.slice(0, 6).map((t) => (
                  <span key={t} className="ht-badge ht-badge-gold">{t}</span>
                ))}
              </div>

              <div className="ht-head" style={{ marginBottom: ".4rem" }}>
                <div className="ht-icon"><lucideReact.Sparkles size={17} /></div>
                <div className="ht-title">Hospital's Vision</div>
              </div>
              <p className="ht-prose">{hospital.servicesSummary || "More details will be added soon."}</p>

              <div className="ht-stats">
                <div className="ht-stat">
                  <div className="ht-stat-ico"><lucideReact.Banknote size={15} /></div>
                  <div className="ht-stat-lbl">Starting from</div>
                  <div className="ht-stat-val">
                    {(() => {
                      const min = Math.min(...hospital.doctors.map(d => d.feeMin ?? Infinity).filter(f => f !== Infinity));
                      return min !== Infinity ? `€${Math.round(min / 100)}` : "—";
                    })()}
                  </div>
                </div>
                <div className="ht-stat">
                  <div className="ht-stat-ico"><lucideReact.Users size={15} /></div>
                  <div className="ht-stat-lbl">Doctors</div>
                  <div className="ht-stat-val">{hospital.doctors.length}</div>
                </div>
                <div className="ht-stat">
                  <div className="ht-stat-ico"><lucideReact.Building2 size={15} /></div>
                  <div className="ht-stat-lbl">Departments</div>
                  <div className="ht-stat-val">{hospital.departments?.length ?? 0}</div>
                </div>
                <div className="ht-stat">
                  <div className="ht-stat-ico"><lucideReact.MapPin size={15} /></div>
                  <div className="ht-stat-lbl">City</div>
                  <div className="ht-stat-val" style={{ fontSize:"1rem" }}>{hospital.location.city}</div>
                </div>
              </div>
            </div>

            {/* Top doctors */}
            <div className="ht-card-white">
              <div className="ht-top-row">
                <div className="ht-head" style={{ marginBottom:0 }}>
                  <div className="ht-icon"><lucideReact.Star size={17} /></div>
                  <div>
                    <div className="ht-title">Top Doctors</div>
                    <div className="ht-sub">Most experienced specialists</div>
                  </div>
                </div>
                <button className="ht-view-all" onClick={() => setTab("doctors")}>
                  View all <lucideReact.ArrowRight size={11} />
                </button>
              </div>
              <div className="ht-doc-grid" style={{ marginTop:".8rem" }}>
                {hospital.doctors.slice(0, 3).map((d) => (
                  <DoctorCard
                    key={d.id} doctor={d}
                    slots={hospital.availability}
                    onSelectSlotAction={() => onBookDoctorAction(d.id)}
                  />
                ))}
              </div>
            </div>

            {/* Reviews */}
            <ReviewsSection
              hospitalId={hospitalId ?? hospital.id}
              initialAverage={hospital.rating}
              initialCount={hospital.reviewCount}
            />
          </div>
        )}

        {/* SERVICES */}
        {tab === "services" && (
          <div>
            <div className="ht-card" style={{ marginBottom:"1.25rem" }}>
              <div className="ht-head">
                <div className="ht-icon"><lucideReact.Package size={17} /></div>
                <div>
                  <div className="ht-title">Health Packages</div>
                  <div className="ht-sub">Choose the perfect plan for your needs</div>
                </div>
              </div>
              <p className="ht-prose" style={{ marginTop:0 }}>
                Comprehensive packages providing complete care at competitive prices, including
                specialist consultations and necessary diagnostic tests.
              </p>
            </div>

            {packages.length ? (
              <div style={{ display:"grid", gap:".75rem", gridTemplateColumns:"repeat(auto-fill, minmax(255px,1fr))" }}>
                {packages.map((pkg, i) => (
                  <PackageCard key={pkg.id} pkg={pkg as any} hospitalName={hospital.name} hospitalId={hospital.id} featured={i === 1} />
                ))}
              </div>
            ) : (
              <div className="ht-empty">
                <lucideReact.Package size={50} />
                <div className="ht-empty-t">No packages available yet</div>
                <div className="ht-empty-s">Check back soon.</div>
              </div>
            )}

            <div className="ht-info">
              <div className="ht-info-ico"><lucideReact.Info size={15} /></div>
              <div>
                <div className="ht-info-title">Package Information</div>
                <ul className="ht-info-list">
                  <li><lucideReact.Check size={12} /> Valid for 3 months from booking date</li>
                  <li><lucideReact.Check size={12} /> Advance booking required for consultations</li>
                  <li><lucideReact.Check size={12} /> Reports available within 24–48 hours</li>
                  <li><lucideReact.Check size={12} /> Free follow-up within 7 days</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* DEPARTMENTS */}
        {tab === "departments" && (
          <div id="departments-section">
            {!selectedDept ? (
              <>
                <div className="ht-card" style={{ marginBottom:"1.1rem" }}>
                  <div className="ht-head" style={{ marginBottom:0 }}>
                    <div className="ht-icon"><lucideReact.Building2 size={17} /></div>
                    <div>
                      <div className="ht-title">Medical Departments</div>
                      <div className="ht-sub">Select a department to view specialists</div>
                    </div>
                  </div>
                </div>

                {hospital.departments?.length ? (
                  <div className="ht-dept-grid">
                    {hospital.departments.map((d) => (
                      <button 
                        key={d.id} 
                        className={`ht-dept-card ${d.id === highlightedDeptId ? 'highlighted' : ''}`} 
                        onClick={() => setSelectedDeptId(d.id)}
                      >
                        <div className="ht-dept-overlay" />
                        {d.id === initialDepartmentId && showAIBadge && (
                          <div className="ht-recommended-badge">
                            <lucideReact.Sparkles size={12} />
                            <span>AI Recommended</span>
                          </div>
                        )}
                        <div className="ht-dept-ico"><lucideReact.Stethoscope size={17} /></div>
                        <div className="ht-dept-name">{d.name}</div>
                        <div className="ht-dept-text">{d.overview || "Department details coming soon."}</div>
                        <div className="ht-dept-foot">
                          <span className="ht-dept-ct">{d.doctorCount} doctors</span>
                          <lucideReact.ArrowRight size={14} className="ht-dept-arrow" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ht-empty">
                    <lucideReact.Building2 size={50} />
                    <div className="ht-empty-t">No departments yet</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <button className="ht-back" onClick={() => setSelectedDeptId(null)}>
                  <lucideReact.ChevronLeft size={14} /> Back to departments
                </button>
                <div className="ht-card" style={{ marginBottom:"1.1rem" }}>
                  <div className="ht-head">
                    <div className="ht-icon"><lucideReact.Stethoscope size={17} /></div>
                    <div>
                      <div className="ht-title">{selectedDept.name}</div>
                      <div className="ht-sub">{deptDoctors.length} specialists available</div>
                    </div>
                  </div>
                  <p className="ht-prose" style={{ marginTop:0 }}>{selectedDept.overview || "Details coming soon."}</p>
                </div>
                {deptDoctors.length ? (
                  <div className="ht-doc-grid">
                    {deptDoctors.map((d) => (
                      <DoctorCard key={d.id} doctor={d} slots={hospital.availability}
                        departmentName={selectedDept.name}
                        onSelectSlotAction={() => onBookDoctorAction(d.id)} />
                    ))}
                  </div>
                ) : (
                  <div className="ht-empty">
                    <lucideReact.Users size={44} />
                    <div className="ht-empty-t">No doctors in this department</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* DOCTORS */}
        {tab === "doctors" && (
          <div>
            <div className="ht-filter">
              <div className="ht-head" style={{ marginBottom:".6rem" }}>
                <div className="ht-icon" style={{ width:35, height:35, borderRadius:8 }}>
                  <lucideReact.Filter size={14} />
                </div>
                <div className="ht-title" style={{ fontSize:".9rem" }}>Find Your Doctor</div>
                <span className="ht-pill" style={{ whiteSpace:"nowrap", marginLeft:"auto" }}>{filteredDoctors.length} doctors</span>
              </div>

              <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                <div style={{ flex:"0 0 50%", position:"relative", minWidth:0 }}>
                  <lucideReact.Search size={13} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#9aaac0", pointerEvents:"none" }} />
                  <Input
                    value={doctorQuery}
                    onChange={(e) => setDoctorQuery(e.target.value)}
                    placeholder="Search by name…"
                    style={{
                      paddingLeft:"1.9rem", height:37, borderRadius:8, fontSize:".8rem",
                      border:"1px solid rgba(15,30,56,.14)", background:"#f7f4ef",
                      fontFamily:"'Outfit',sans-serif", color:"#0f1e38", width:"100%",
                    }}
                  />
                </div>
                <select className="ht-select" style={{ flex:1 }} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                  <option value="ALL">All Departments</option>
                  {allSpecialties.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="ht-select" style={{ flex:1 }} value={sort} onChange={(e) => setSort(e.target.value as any)}>
                  <option value="FEE_ASC">Fee: Low → High</option>
                  <option value="FEE_DESC">Fee: High → Low</option>
                </select>
              </div>
            </div>

            {groupedDoctors.length ? (
              <div>
                {groupedDoctors.map(([groupName, docs]) => (
                  <div key={groupName}>
                    <div className="ht-group">
                      <div className="ht-group-bar" />
                      <span className="ht-group-name">{groupName}</span>
                      <span className="ht-group-ct">{docs.length}</span>
                    </div>
                    <div className="ht-doc-grid">
                      {docs.map((d) => (
                        <DoctorCard key={d.id} doctor={d} slots={hospital.availability}
                          departmentName={groupName}
                          onSelectSlotAction={() => onBookDoctorAction(d.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ht-empty">
                <lucideReact.UserX size={50} />
                <div className="ht-empty-t">No doctors match your filters</div>
                <div className="ht-empty-s">Try adjusting your search criteria</div>
              </div>
            )}
          </div>
        )}

        {/* CONTACT */}
        {tab === "contact" && (
          <div>
            <div className="ht-card" style={{ marginBottom:"1.1rem" }}>
              <div className="ht-head">
                <div className="ht-icon"><lucideReact.Phone size={17} /></div>
                <div>
                  <div className="ht-title">Contact Information</div>
                  <div className="ht-sub">Get in touch with us</div>
                </div>
              </div>
              <div className="ht-contact-grid">
                <a href={hospital.phone ? `tel:${hospital.phone}` : undefined}
                  className={`ht-contact-item${hospital.phone ? " link" : ""}`}>
                  <div className="ht-contact-ico"><lucideReact.Phone size={15} /></div>
                  <div>
                    <div className="ht-contact-key">Phone</div>
                    <div className={`ht-contact-val${hospital.phone ? " gold" : ""}`}>
                      {hospital.phone || "Will be added soon"}
                    </div>
                  </div>
                </a>
                <div className="ht-contact-item">
                  <div className="ht-contact-ico"><lucideReact.Mail size={15} /></div>
                  <div>
                    <div className="ht-contact-key">Email</div>
                    <div className="ht-contact-val">{hospital.email || "Will be added soon"}</div>
                  </div>
                </div>
                <div className="ht-contact-item">
                  <div className="ht-contact-ico"><lucideReact.Globe size={15} /></div>
                  <div>
                    <div className="ht-contact-key">Website</div>
                    <div className="ht-contact-val">{hospital.website || "Will be added soon"}</div>
                  </div>
                </div>
                <div className="ht-contact-item">
                  <div className="ht-contact-ico"><lucideReact.Clock size={15} /></div>
                  <div>
                    <div className="ht-contact-key">Hours</div>
                    <div className="ht-contact-val">{hospital.openingHours || "Will be added soon"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ht-card-white">
              <div className="ht-head">
                <div className="ht-icon"><lucideReact.MapPin size={17} /></div>
                <div className="ht-title">Address</div>
              </div>
              <p className="ht-prose" style={{ marginTop:0 }}>
                {[
                  hospital.location.addressLine,
                  hospital.location.area,
                  hospital.location.city,
                  hospital.location.district,
                  hospital.location.country,
                  hospital.location.postalCode,
                ].filter(Boolean).join(", ") || "Will be added soon"}
              </p>
              {hospital.location.lat && hospital.location.lng ? (
                <div style={{ marginTop:".9rem", borderRadius:9, overflow:"hidden", border:"1px solid rgba(15,30,56,.09)" }}>
                  <iframe
                    src={`https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3000!2d${hospital.location.lng}!3d${hospital.location.lat}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${hospital.location.lat}%2C${hospital.location.lng}!5e0!3m2!1sen!2snp!4v1`}
                    width="100%"
                    height="300"
                    style={{ border:0, display:"block" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`${hospital.name} Location`}
                  />
                  <div style={{ padding:".6rem .95rem", display:"flex", alignItems:"center", gap:".45rem" }}>
                    <a
                      href={`https://www.google.com/maps/dir//${encodeURIComponent(hospital.name)}+${encodeURIComponent(hospital.location.area || hospital.location.city)}/@${hospital.location.lat},${hospital.location.lng},15z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display:"inline-flex", alignItems:"center", gap:".4rem", background:"#0f1e38", color:"#c8a96e", padding:".55rem 1rem", borderRadius:8, fontSize:".82rem", fontWeight:600, textDecoration:"none" }}
                    >
                      <lucideReact.Navigation size={14} />
                      Get Directions
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{
                  marginTop:".9rem", background:"#f7f4ef",
                  border:"1px solid rgba(15,30,56,.09)",
                  borderRadius:9, padding:".8rem .95rem",
                  display:"flex", alignItems:"center", gap:".45rem",
                  fontSize:".78rem", color:"#9aaac0",
                }}>
                  <lucideReact.Map size={14} />
                  Interactive map coming soon.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}