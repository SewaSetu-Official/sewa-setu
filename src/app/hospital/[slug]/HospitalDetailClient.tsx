"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { ApiHospitalDetails } from "@/types/hospital-details";
import { HospitalTabs } from "./HospitalTabs";

type UiPackage = {
  id: string;
  name: string;
  price: number;
  currency: string;
  discount?: string;
  features: string[];
  description?: string;
};

type Props = {
  hospital: ApiHospitalDetails;
  packages: UiPackage[];
};

export function HospitalDetailClient({ hospital, packages }: Props) {
  const searchParams = useSearchParams();
  const selectedDepartmentId = searchParams.get("department");
  const showAIBadge = searchParams.get("from") === "ai";

  // Handle deep linking from AI chatbot
  useEffect(() => {
    if (!selectedDepartmentId) return;

    const timeoutId = window.setTimeout(() => {
      const deptSection = document.getElementById("departments-section");
      if (deptSection) {
        deptSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [selectedDepartmentId]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');

        .hdc-root {
          --navy:         #0C6B57;
          --navy-mid:     #0A5446;
          --navy-soft:    #0A5446;
          --navy-ghost:   rgba(20,33,29,.06);
          --gold:         #E0913A;
          --gold-lt:      #EBB36B;
          --gold-dim:     #B8731F;
          --gold-pale:    rgba(224,145,58,.10);
          --gold-border:  rgba(224,145,58,.28);
          --cream:        #F6F4EE;
          --white:        #ffffff;
          --ink:          #14211D;
          --ink-mid:      #46524D;
          --ink-soft:     #7B857F;
          --ink-ghost:    #9AA39E;
          --border:       rgba(20,33,29,.09);
          --sh-sm:        0 2px 10px rgba(20,33,29,.06);
          --sh-md:        0 6px 28px rgba(20,33,29,.10);
          --sh-lg:        0 20px 64px rgba(20,33,29,.16);
          --r:            20px;
          --r-sm:         12px;
          --r-xs:         8px;
          --page-max:     1160px;
          --page-pad:     clamp(1rem, 4vw, 3rem);

          font-family: 'Inter', sans-serif;
          color: var(--ink);
          background: transparent;
          -webkit-font-smoothing: antialiased;

          min-height: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .hdc-root::before {
          content: none;
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 70% 45% at 15% 8%, rgba(224,145,58,.05) 0%, transparent 55%),
            radial-gradient(ellipse 55% 35% at 85% 92%, rgba(20,33,29,.04) 0%, transparent 55%);
          pointer-events: none; z-index: 0;
        }

        .hdc-shell {
          flex: 1;
          width: 100%;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
        }

        .hdc-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
          box-shadow: none;
        }

        /* AI Recommendation Badge */
        .hdc-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, rgba(224,145,58,0.15), rgba(20,33,29,0.05));
          border: 1px solid var(--gold-border);
          border-radius: 100px;
          padding: 8px 16px;
          margin-bottom: 20px;
          font-size: 14px;
          color: var(--gold-dim);
          animation: fadeIn 0.5s ease-out;
        }

        .hdc-ai-badge svg {
          color: var(--gold);
        }

        .hdc-ai-badge span {
          font-weight: 600;
          color: var(--gold);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hdc-cta {
          position: relative; overflow: hidden;
          background: linear-gradient(118deg, var(--navy) 0%, var(--navy-mid) 48%, var(--navy-soft) 100%);
          padding: 1.75rem var(--page-pad);
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 1.5rem; flex-wrap: wrap;
        }
        .hdc-cta-inner {
          width: 100%;
          max-width: var(--page-max);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
          position: relative;
          z-index: 1;
        }

        .hdc-cta::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px);
          background-size: 36px 36px;
          pointer-events: none;
        }
        .hdc-g1, .hdc-g2 {
          position: absolute; border-radius: 50%; pointer-events: none;
        }
        .hdc-g1 {
          width:320px; height:320px; top:-150px; right:80px;
          background: radial-gradient(circle, rgba(224,145,58,.17) 0%, transparent 65%);
        }
        .hdc-g2 {
          width:160px; height:160px; bottom:-90px; left:12%;
          background: radial-gradient(circle, rgba(224,145,58,.09) 0%, transparent 65%);
        }
        .hdc-cta-rule {
          position: absolute; top:0; left:0; right:0; height:1px;
          background: linear-gradient(90deg,
            transparent 0%, rgba(224,145,58,.7) 35%,
            rgba(224,145,58,.7) 65%, transparent 100%);
        }
        .hdc-cta-id {
          display:flex; flex-direction:column; gap:.3rem;
        }
        .hdc-eyebrow {
          display:flex; align-items:center; gap:.5rem;
          font-size:.6rem; font-weight:600;
          letter-spacing:.2em; text-transform:uppercase;
          color:var(--gold); opacity:.85;
        }
        .hdc-eyebrow::before {
          content:''; display:inline-block;
          width:18px; height:1px; background:var(--gold); opacity:.5;
        }
        .hdc-hospname {
          font-family:'Plus Jakarta Sans', sans-serif;
          font-size: clamp(1rem, 2.4vw, 1.3rem);
          font-weight:700; color:var(--white);
          line-height:1.25; letter-spacing:-.01em;
        }

        .hdc-cta button,
        .hdc-cta a[role="button"] {
          font-family:'DM Sans', sans-serif !important;
          font-weight:500 !important;
          border-radius: var(--r-xs) !important;
          transition: all .2s cubic-bezier(.22,1,.36,1) !important;
          position: relative !important;
          z-index: 1 !important;
        }
        .hdc-cta button:first-of-type {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%) !important;
          color: var(--navy) !important;
          border: none !important;
          box-shadow: 0 4px 16px rgba(224,145,58,.40), 0 1px 2px rgba(0,0,0,.18) !important;
        }
        .hdc-cta button:first-of-type:hover {
          background: linear-gradient(135deg, var(--gold-lt) 0%, var(--gold) 100%) !important;
          box-shadow: 0 6px 24px rgba(224,145,58,.52) !important;
          transform: translateY(-1px) !important;
        }
        .hdc-cta button:last-of-type {
          background: rgba(224,145,58,.08) !important;
          color: var(--gold-lt) !important;
          border: 1px solid var(--gold-border) !important;
          box-shadow: none !important;
        }
        .hdc-cta button:last-of-type:hover {
          background: rgba(224,145,58,.16) !important;
          border-color: rgba(224,145,58,.55) !important;
          transform: translateY(-1px) !important;
        }

        .hdc-body {
          flex: 1;
          position: relative;
          background: transparent;
        }
        .hdc-body::before {
          content:none; position:absolute;
          top:0; left:0; bottom:0; width:3px;
          background: linear-gradient(180deg, var(--gold) 0%, rgba(224,145,58,.18) 55%, transparent 100%);
          pointer-events:none; z-index:1;
        }
        .hdc-body::after {
          content:none; position:absolute;
          top:0; left:0; right:0; height:52px;
          background: linear-gradient(180deg, rgba(20,33,29,.025) 0%, transparent 100%);
          pointer-events:none;
        }
        .hdc-body-inner {
          position: relative; z-index: 1;
          max-width: var(--page-max);
          margin: 0 auto;
          padding: 1.25rem var(--page-pad) 4rem;
          width: 100%;
        }

        .hdc-divider {
          display:flex; align-items:center; gap:1rem;
          margin-bottom:2rem;
        }
        .hdc-div-l {
          flex:1; height:1px;
          background:linear-gradient(90deg, rgba(224,145,58,.4) 0%, transparent 100%);
        }
        .hdc-div-r {
          flex:1; height:1px;
          background:linear-gradient(90deg, transparent 0%, rgba(224,145,58,.4) 100%);
        }
        .hdc-div-mid {
          display:flex; flex-direction:column; align-items:center; gap:.3rem;
        }
        .hdc-div-label {
          font-size:.58rem; font-weight:600;
          letter-spacing:.22em; text-transform:uppercase;
          color:var(--gold-dim);
        }
        .hdc-div-gem {
          width:5px; height:5px;
          background:var(--gold); transform:rotate(45deg); opacity:.5;
        }

        @media (max-width:660px) {
          .hdc-body-inner { padding: 1.75rem 1.25rem 3rem; }
        }
      `}</style>

      <div className="hdc-root">
        <div className="hdc-shell">
          <div className="hdc-card">

            {/* AI Recommendation Badge */}
            {showAIBadge && (
              <div className="hdc-ai-badge">
                <span aria-hidden="true">✦</span>
                <span>Recommended by Sewa-Setu AI</span>
              </div>
            )}

            {/* Body */}
            <div className="hdc-body">
              <div className="hdc-body-inner" id="services-section">
                <HospitalTabs
                  hospital={hospital}
                  packages={packages}
                  onBookDoctorAction={() => {}}
                  initialDepartmentId={selectedDepartmentId}
                  showAIBadge={showAIBadge}
                  hospitalId={hospital.id}
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
