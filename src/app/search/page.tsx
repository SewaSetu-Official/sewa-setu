"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { HospitalCard } from "@/components/hospital-card";
import { AISearchModal } from "@/components/ai-search-modal";
import { Search, MapPin, Filter, X, Siren, ChevronDown, Brain } from "lucide-react";
import type { ApiHospital } from "@/types/hospital";

type HospitalType = "ALL" | "HOSPITAL" | "CLINIC" | "LAB";
type SortOption = "recent" | "name" | "price-low" | "price-high";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [selectedType, setSelectedType] = useState<HospitalType>("ALL");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAISearch, setShowAISearch] = useState(false);

  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<ApiHospital[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    if (minPrice) count++;
    if (maxPrice) count++;
    return count;
  }, [selectedCity, selectedType, emergencyOnly, minPrice, maxPrice]);

  // ✅ Fetch when filters change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (selectedCity !== "All Cities") params.set("city", selectedCity);
        if (selectedType !== "ALL") params.set("type", selectedType);
        if (emergencyOnly) params.set("emergency", "true");
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        if (sortBy) params.set("sortBy", sortBy);

        const res = await fetch(`/api/hospitals?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to load hospitals (${res.status})`);
        }

        const data = await res.json();
        setHospitals(data?.hospitals ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong while loading hospitals.");
        setHospitals([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [debouncedQuery, selectedCity, selectedType, emergencyOnly, minPrice, maxPrice, sortBy]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCity("All Cities");
    setSelectedType("ALL");
    setEmergencyOnly(false);
    setMinPrice("");
    setMaxPrice("");
    setSortBy("recent");
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef]">
      <Navbar />

      {/* Header & Search Section */}
      <div
        className="sticky top-0 z-10 pt-24 pb-5 shadow-xl"
        style={{ background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)", borderBottom: "1px solid rgba(200,169,110,0.18)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          {/* ── Title left + search right ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">

            {/* Left: title */}
            <div className="flex-shrink-0 sm:w-56">
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
                Find the<br />Best Care
              </h1>
              <p className="text-[#c8a96e]/70 text-xs mt-1.5 leading-snug">Hospitals, clinics &amp; labs<br className="hidden sm:block" /> across Nepal</p>
            </div>

            {/* Right: search pill + filters + sort */}
            <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-3">

            {/* Combined search pill */}
            <div
              className="flex-1 flex items-stretch bg-white rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(10,18,35,.35)] min-w-0"
              style={{ border: "1.5px solid rgba(200,169,110,0.3)" }}
            >
              {/* Search input */}
              <div className="relative flex-1 flex items-center min-w-0">
                <Search className="absolute left-4 h-4 w-4 text-[#a88b50] flex-shrink-0 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by hospital name..."
                  className="w-full pl-11 pr-4 py-3.5 text-sm font-medium text-[#0f1e38] placeholder:text-gray-400 bg-transparent outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 h-5 w-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <X className="h-3 w-3 text-gray-600" />
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="w-px bg-[rgba(200,169,110,0.25)] my-3 flex-shrink-0" />

              {/* City dropdown */}
              <div className="relative flex items-center sm:w-40 flex-shrink-0">
                <MapPin className="absolute left-3 h-4 w-4 text-[#c8a96e] pointer-events-none flex-shrink-0" />
                <select
                  className="h-full w-full appearance-none pl-9 pr-8 text-sm font-medium text-[#0f1e38] bg-transparent outline-none cursor-pointer"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  aria-label="Filter by city"
                >
                  <option value="All Cities">All Cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 h-4 w-4 text-[#c8a96e] pointer-events-none" />
              </div>
            </div>

            {/* Smart Search button */}
            <button
              onClick={() => setShowAISearch(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-3.5 rounded-2xl border border-[#c8a96e] bg-gradient-to-r from-[#0f9580]/20 to-[#0f9580]/10 text-[#c8a96e] text-sm font-semibold transition-all whitespace-nowrap hover:bg-gradient-to-r hover:from-[#0f9580]/30 hover:to-[#0f9580]/20"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Smart Search</span>
            </button>

            {/* Filters button */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all whitespace-nowrap ${
                showAdvanced || activeFilterCount > 0
                  ? "border-[#c8a96e] bg-[rgba(200,169,110,0.18)] text-[#c8a96e]"
                  : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15 hover:border-white/30"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-[#c8a96e] text-[#0f1e38] text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort dropdown */}
            <div className="relative flex-shrink-0">
              <select
                className="h-[50px] appearance-none rounded-2xl border border-white/20 bg-white/10 text-white/80 pl-3 pr-8 text-sm font-semibold outline-none focus:border-[#c8a96e] transition-all cursor-pointer whitespace-nowrap"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="recent" className="bg-[#0f1e38] text-white">Most Recent</option>
                <option value="name" className="bg-[#0f1e38] text-white">A – Z</option>
                <option value="price-low" className="bg-[#0f1e38] text-white">Price ↑</option>
                <option value="price-high" className="bg-[#0f1e38] text-white">Price ↓</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50 pointer-events-none" />
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 font-medium transition-colors"
              >
                <X className="h-3 w-3" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>

          {/* ── Advanced Filters Panel ── */}
          {showAdvanced && (
            <div
              className="mt-1 p-5 rounded-2xl border border-[rgba(200,169,110,0.2)]"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr] gap-5">
                {/* Type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#c8a96e] mb-2">Type</label>
                  <div className="flex gap-1.5">
                    {(["ALL", "HOSPITAL", "CLINIC", "LAB"] as HospitalType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                          selectedType === type
                            ? "bg-[#c8a96e] text-[#0f1e38]"
                            : "bg-white/10 text-white/70 border border-white/15 hover:border-[rgba(200,169,110,0.4)]"
                        }`}
                      >
                        {type === "ALL" ? "All" : type.charAt(0) + type.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#c8a96e] mb-2">Price Range (NPR)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="flex-1 h-9 rounded-lg border border-[rgba(200,169,110,0.3)] bg-white text-[#0f1e38] placeholder:text-gray-400 px-3 text-xs font-medium outline-none focus:border-[#c8a96e] transition-all"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="flex-1 h-9 rounded-lg border border-[rgba(200,169,110,0.3)] bg-white text-[#0f1e38] placeholder:text-gray-400 px-3 text-xs font-medium outline-none focus:border-[#c8a96e] transition-all"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>

                {/* Emergency */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#c8a96e] mb-2">Services</label>
                  <button
                    onClick={() => setEmergencyOnly(!emergencyOnly)}
                    className={`w-full flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold transition-all border ${
                      emergencyOnly
                        ? "bg-red-500 border-red-400 text-white"
                        : "bg-white border-[rgba(200,169,110,0.3)] text-[#0f1e38] hover:border-[#c8a96e]"
                    }`}
                  >
                    <Siren className="h-3.5 w-3.5" />
                    Emergency
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>{/* end flex-col search side */}
          </div>{/* end title + search row */}
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#c8a96e] border-r-transparent"></div>
              <p className="mt-4 text-[#6b7a96] font-medium">Loading hospitals...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-red-200">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-red-900">{error}</h3>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-red-600 font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[#6b7a96] font-medium">
                Showing <span className="text-[#0f1e38] font-bold">{hospitals.length}</span> {hospitals.length === 1 ? 'hospital' : 'hospitals'}
                {selectedCity !== "All Cities" && ` in ${selectedCity}`}
                {selectedType !== "ALL" && ` (${selectedType.charAt(0) + selectedType.slice(1).toLowerCase()})`}
              </p>
            </div>

            {hospitals.length > 0 ? (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {hospitals.map((hospital, index) => (
                  <HospitalCard key={hospital.id} hospital={hospital} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[rgba(200,169,110,0.3)]">
                <div className="bg-[rgba(200,169,110,0.08)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-[#a88b50]" />
                </div>
                <h3 className="text-lg font-medium text-[#0f1e38]">No hospitals found</h3>
                <p className="text-[#6b7a96] mt-2">
                  {searchQuery || activeFilterCount > 0 
                    ? "Try adjusting your search or filters."
                    : "Start searching to find hospitals near you."}
                </p>
                {(searchQuery || activeFilterCount > 0) && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-4 px-4 py-2 bg-[#0f1e38] text-[#c8a96e] rounded-lg font-medium hover:bg-[#1a3059] transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Search Modal */}
      <AISearchModal isOpen={showAISearch} onCloseAction={() => setShowAISearch(false)} />
    </main>
  );
}