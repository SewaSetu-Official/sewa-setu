"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { HospitalCard } from "@/components/hospital-card";
import { AISearchModal } from "@/components/ai-search-modal";
import {
  Search, MapPin, X, Siren, ChevronDown, Sparkles, Star, Check,
  SlidersHorizontal, ShieldCheck, ArrowDown,
} from "lucide-react";
import type { ApiHospital } from "@/types/hospital";

type HospitalType = "ALL" | "HOSPITAL" | "CLINIC" | "LAB";
type SortOption = "recent" | "name" | "price-low" | "price-high";

const TYPE_OPTIONS: { key: HospitalType; label: string }[] = [
  { key: "ALL", label: "All providers" },
  { key: "HOSPITAL", label: "Hospital" },
  { key: "CLINIC", label: "Clinic" },
  { key: "LAB", label: "Lab" },
];

const SPECIALTIES = ["Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Dermatology", "Radiology"];

const RATINGS: { value: number; label: string }[] = [
  { value: 4.5, label: "4.5+" },
  { value: 4.0, label: "4.0+" },
  { value: 0, label: "Any" },
];

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Most recent",
  name: "A – Z",
  "price-low": "Price: low to high",
  "price-high": "Price: high to low",
};

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [selectedType, setSelectedType] = useState<HospitalType>("ALL");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [priceMax, setPriceMax] = useState(200); // EUR; 200 = no max
  const [minRating, setMinRating] = useState(0); // client-side refine
  const [verifiedOnly, setVerifiedOnly] = useState(false); // mocked — no backing field yet
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showAISearch, setShowAISearch] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<ApiHospital[]>([]);
  const [typeCounts, setTypeCounts] = useState<{ all: number; HOSPITAL: number; CLINIC: number; LAB: number }>({ all: 0, HOSPITAL: 0, CLINIC: 0, LAB: 0 });
  const [error, setError] = useState<string | null>(null);

  // Seed the search box from the URL (?q=…) on first load — e.g. coming from the homepage hero
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setSearchQuery(initial);
  }, []);

  // ✅ Debounce: wait 400ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Build cities list from current DB results
  const cities = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach((h) => h.city && set.add(h.city));
    return Array.from(set).sort();
  }, [hospitals]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCity !== "All Cities") count++;
    if (selectedType !== "ALL") count++;
    if (emergencyOnly) count++;
    if (priceMax < 200) count++;
    if (minRating > 0) count++;
    if (verifiedOnly) count++;
    return count;
  }, [selectedCity, selectedType, emergencyOnly, priceMax, minRating, verifiedOnly]);

  // Reset to page 1 when any server-side filter changes
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [debouncedQuery, selectedCity, selectedType, emergencyOnly, priceMax, sortBy]);

  // ✅ Fetch when filters or page changes
  useEffect(() => {
    const load = async () => {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (selectedCity !== "All Cities") params.set("city", selectedCity);
        if (selectedType !== "ALL") params.set("type", selectedType);
        if (emergencyOnly) params.set("emergency", "true");
        if (priceMax < 200) params.set("maxPrice", String(priceMax));
        if (sortBy) params.set("sortBy", sortBy);
        params.set("page", String(page));

        const res = await fetch(`/api/hospitals?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to load hospitals (${res.status})`);
        }

        const data = await res.json();
        const incoming: ApiHospital[] = data?.hospitals ?? [];
        setTotal(data?.total ?? 0);
        setHasMore(data?.hasMore ?? false);
        if (data?.typeCounts) setTypeCounts(data.typeCounts);
        setHospitals((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong while loading hospitals.");
        if (page === 1) setHospitals([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    load();

  }, [page, debouncedQuery, selectedCity, selectedType, emergencyOnly, priceMax, sortBy]);

  // Client-side refine: minimum rating
  const displayed = useMemo(
    () => hospitals.filter((h) => minRating === 0 || (h.rating ?? 0) >= minRating),
    [hospitals, minRating]
  );

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCity("All Cities");
    setSelectedType("ALL");
    setEmergencyOnly(false);
    setPriceMax(200);
    setMinRating(0);
    setVerifiedOnly(false);
    setSortBy("recent");
    setPage(1);
  };

  const cycleSort = () => {
    const order: SortOption[] = ["recent", "name", "price-low", "price-high"];
    setSortBy((s) => order[(order.indexOf(s) + 1) % order.length]);
  };

  const toggleSpecialty = (s: string) => {
    setSearchQuery((q) => (q.trim().toLowerCase() === s.toLowerCase() ? "" : s));
  };

  return (
    <main className="min-h-screen bg-page">
      <Navbar />

      {/* ── Compact search bar ── */}
      <section className="mx-auto max-w-[1200px] px-5 pt-[100px] sm:px-9">
        <div className="mb-3.5 flex items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-[27px] font-bold leading-[1.1] tracking-[-0.025em] text-ink">Find the best care</h1>
            <p className="mt-1 text-sm text-ink-muted">Hospitals, clinics &amp; labs across Nepal — book online, skip the queue.</p>
          </div>
          <span className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(20,33,29,0.08)] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft sm:inline-flex">
            <span className="h-[7px] w-[7px] rounded-full bg-accent" />
            {total} verified providers
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[rgba(20,33,29,0.08)] bg-white p-1.5 shadow-[0_12px_30px_-22px_rgba(20,33,29,0.4)]">
          <div className="flex min-w-[180px] flex-1 items-center gap-2.5 px-1.5 pl-3">
            <Search className="h-[19px] w-[19px] shrink-0 text-ink-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hospitals, doctors, specialties…"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="shrink-0 rounded-full p-1 text-ink-muted hover:bg-page" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative flex items-center">
            <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-brand" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="Filter by city"
              className="h-10 cursor-pointer appearance-none rounded-[10px] bg-transparent pl-9 pr-8 text-[14px] font-semibold text-ink outline-none"
            >
              <option value="All Cities">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink-muted" />
          </div>

          <div className="mx-0.5 hidden h-7 w-px self-center bg-[rgba(20,33,29,0.1)] sm:block" />

          <button
            onClick={() => setShowAISearch(true)}
            className="flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] text-[14.5px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(224,145,58,0.9)] transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#E0913A,#cf7f29)" }}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Smart Search</span>
          </button>

          <button
            onClick={() => { setDebouncedQuery(searchQuery.trim()); setPage(1); }}
            className="rounded-[10px] bg-brand px-5 py-[11px] text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Search
          </button>
        </div>
      </section>

      {/* ── Body: filters + results ── */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-6 px-5 pb-12 pt-6 sm:px-9 lg:grid-cols-[248px_1fr]">

        {/* ── FILTER SIDEBAR ── */}
        <aside className="rounded-[18px] border border-[rgba(20,33,29,0.07)] bg-white p-[18px] shadow-[0_14px_34px_-28px_rgba(20,33,29,0.5)] lg:sticky lg:top-[84px]">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display flex items-center gap-2 text-[16px] font-bold text-ink">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </span>
            {activeFilterCount > 0 && (
              <button onClick={clearAllFilters} className="text-[12.5px] font-bold text-brand">Clear all</button>
            )}
          </div>

          {/* Provider type */}
          <div className="mt-[18px]">
            <div className="mb-2.5 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">Provider type</div>
            <div className="flex flex-col gap-2">
              {TYPE_OPTIONS.map((t) => {
                const active = selectedType === t.key;
                const count = t.key === "ALL" ? typeCounts.all : typeCounts[t.key];
                return (
                  <button key={t.key} onClick={() => setSelectedType(t.key)} className="flex items-center gap-2.5 text-left text-[13.5px] font-semibold text-[#2C3733]">
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px]" style={{ borderColor: active ? "#0C6B57" : "rgba(20,33,29,.25)", background: active ? "#0C6B57" : "#fff" }}>
                      {active && <Check className="h-[11px] w-[11px] text-white" strokeWidth={3} />}
                    </span>
                    {t.label}
                    <span className="ml-auto text-[12px] font-semibold text-[#9AA39E]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-[18px] h-px bg-[rgba(20,33,29,0.07)]" />

          {/* Specialty */}
          <div>
            <div className="mb-2.5 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">Specialty</div>
            <div className="flex flex-wrap gap-[7px]">
              {SPECIALTIES.map((s) => {
                const active = debouncedQuery.toLowerCase() === s.toLowerCase();
                return (
                  <button key={s} onClick={() => toggleSpecialty(s)} className="rounded-full border px-[11px] py-1.5 text-[12.5px] font-semibold transition-colors"
                    style={{ background: active ? "#E6F0EC" : "#F6F4EE", color: active ? "#0C6B57" : "#46524D", borderColor: active ? "rgba(12,107,87,.3)" : "rgba(20,33,29,.08)" }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-[18px] h-px bg-[rgba(20,33,29,0.07)]" />

          {/* Price */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">Price range</span>
              <span className="text-[13px] font-bold text-brand">{priceMax >= 200 ? "€18 – €200+" : `€18 – €${priceMax}`}</span>
            </div>
            <input type="range" min={18} max={200} step={2} value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="ss-range w-full" />
            <div className="mt-[7px] flex justify-between text-[11.5px] text-[#9AA39E]"><span>€0</span><span>€200+</span></div>
          </div>

          <div className="my-[18px] h-px bg-[rgba(20,33,29,0.07)]" />

          {/* Rating */}
          <div>
            <div className="mb-2.5 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">Minimum rating</div>
            <div className="flex gap-[7px]">
              {RATINGS.map((r) => {
                const active = minRating === r.value;
                return (
                  <button key={r.label} onClick={() => setMinRating(r.value)} className="flex items-center gap-1 rounded-[9px] border px-[11px] py-[7px] text-[12.5px] font-bold transition-colors"
                    style={{ background: active ? "#14211D" : "#F6F4EE", color: active ? "#fff" : "#46524D", borderColor: active ? "#14211D" : "rgba(20,33,29,.08)" }}>
                    <Star className="h-3 w-3" style={{ fill: active ? "#E0913A" : "#C4BFB4", color: active ? "#E0913A" : "#C4BFB4" }} />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-[18px] h-px bg-[rgba(20,33,29,0.07)]" />

          {/* Toggles */}
          <button onClick={() => setEmergencyOnly((v) => !v)} className="mb-3.5 flex w-full items-center justify-between text-[13.5px] font-semibold text-[#2C3733]">
            <span className="flex items-center gap-2.5"><Siren className="h-4 w-4 text-[#C0556B]" /> Emergency 24/7</span>
            <span className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors" style={{ background: emergencyOnly ? "#0C6B57" : "rgba(20,33,29,.16)" }}>
              <span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: emergencyOnly ? "18px" : "2px" }} />
            </span>
          </button>
          <button onClick={() => setVerifiedOnly((v) => !v)} className="flex w-full items-center justify-between text-[13.5px] font-semibold text-[#2C3733]">
            <span className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-brand" /> Verified only</span>
            <span className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors" style={{ background: verifiedOnly ? "#0C6B57" : "rgba(20,33,29,.16)" }}>
              <span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: verifiedOnly ? "18px" : "2px" }} />
            </span>
          </button>
        </aside>

        {/* ── RESULTS ── */}
        <div>
          {/* results header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[14.5px] text-ink-soft">
              <strong className="font-bold text-ink">{displayed.length} providers</strong>
              {selectedCity !== "All Cities" && <> in {selectedCity}</>}
              {debouncedQuery && <> · matching “{debouncedQuery}”</>}
            </div>
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-[#3C4742]">
              Sort:
              <button onClick={cycleSort} className="flex items-center gap-1.5 rounded-[10px] border border-[rgba(20,33,29,0.12)] bg-white px-3 py-2 text-[13.5px] font-bold text-ink">
                {SORT_LABELS[sortBy]}
                <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
              </button>
            </span>
          </div>

          {loading ? (
            <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-[22px] border border-[rgba(20,33,29,0.07)] bg-white">
                  <div className="h-52 bg-[rgba(20,33,29,0.06)]" />
                  <div className="space-y-3 p-5">
                    <div className="h-5 w-3/4 rounded-lg bg-[rgba(20,33,29,0.08)]" />
                    <div className="h-4 w-1/2 rounded-lg bg-[rgba(20,33,29,0.05)]" />
                    <div className="h-px bg-[rgba(20,33,29,0.05)]" />
                    <div className="flex items-center justify-between">
                      <div className="h-6 w-16 rounded-lg bg-[rgba(20,33,29,0.08)]" />
                      <div className="h-9 w-28 rounded-xl bg-[rgba(20,33,29,0.08)]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[22px] border border-[rgba(192,85,107,0.2)] bg-white py-20 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBEAEE]">
                <X className="h-6 w-6 text-[#C0556B]" />
              </div>
              <h3 className="font-display text-base font-bold text-ink">Something went wrong</h3>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
              <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[#FBEAEE] px-5 py-2 text-sm font-semibold text-[#C0556B] transition-colors hover:bg-[#f7dbe2]">
                Try again
              </button>
            </div>
          ) : displayed.length > 0 ? (
            <>
              <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
                {displayed.map((hospital, index) => (
                  <HospitalCard key={hospital.id} hospital={hospital} index={index} />
                ))}
              </div>

              {hasMore && minRating === 0 && (
                <div className="mt-7 flex justify-center">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loadingMore}
                    className="flex items-center gap-2 rounded-[12px] border border-[rgba(20,33,29,0.14)] bg-white px-[26px] py-3 text-[14.5px] font-bold text-ink transition-colors hover:bg-page disabled:opacity-60"
                  >
                    {loadingMore ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-brand border-r-transparent" />
                        Loading…
                      </>
                    ) : (
                      <>
                        Load more providers
                        <ArrowDown className="h-4 w-4 text-brand" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[22px] border-[1.5px] border-dashed border-[rgba(12,107,87,0.25)] bg-white py-24 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="font-display text-base font-bold text-ink">
                {debouncedQuery || activeFilterCount > 0 ? "No results found" : "Search for care"}
              </h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-ink-muted">
                {debouncedQuery || activeFilterCount > 0
                  ? "Try a different search term or remove some filters."
                  : "Find hospitals, clinics and labs across Nepal."}
              </p>
              {(debouncedQuery || activeFilterCount > 0) && (
                <button onClick={clearAllFilters} className="mt-5 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Search Modal */}
      <AISearchModal isOpen={showAISearch} onCloseAction={() => setShowAISearch(false)} />
    </main>
  );
}
