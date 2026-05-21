"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import type { ApiAvailabilitySlot, ApiDoctor } from "@/types/hospital";
import type { ApiHospitalDetails } from "@/types/hospital-details";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Returns the YYYY-MM-DD string of the next occurrence of the given dayOfWeek
 * (0=Sun … 6=Sat), starting from today. If today is that day, returns today.
 */
function nextOccurrenceDateStr(dayOfWeek: number): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = (dayOfWeek - now.getDay() + 7) % 7;
  const target = new Date(now.getTime() + diff * 86400000);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Display fee stored in cents as a whole-number currency string (e.g. "€50"). */
function formatFee(feeMin: number | null | undefined, currency: string | null | undefined): string {
  if (feeMin == null) return "—";
  const sym = (currency ?? "eur").toLowerCase() === "eur" ? "€" : (currency ?? "");
  return `${sym}${Math.round(feeMin / 100)}`;
}

function normalizeSlotTime(value: string | null | undefined) {
  return value?.replace(/\s*-\s*/g, " - ").trim() ?? "";
}

type Step = "details" | "doctor" | "availability" | "review";

type Props = {
  hospital: ApiHospitalDetails;
  isOpen: boolean;
  onCloseAction: () => void;
  preselectedDoctor?: ApiDoctor | null;
};

export function HospitalBookingModal({ hospital, isOpen, onCloseAction, preselectedDoctor }: Props) {
  if (!isOpen) return null;

  return (
    <HospitalBookingModalDialog
      key={`${hospital.id}:${preselectedDoctor?.id ?? "default"}`}
      hospital={hospital}
      onCloseAction={onCloseAction}
      preselectedDoctor={preselectedDoctor}
    />
  );
}

type HospitalBookingModalDialogProps = Omit<Props, "isOpen">;

function HospitalBookingModalDialog({ hospital, onCloseAction, preselectedDoctor }: HospitalBookingModalDialogProps) {
  const [step, setStep] = useState<Step>(preselectedDoctor ? "availability" : "details");
  const [formData, setFormData] = useState({
    patientName: "",
    patientAge: "",
    patientPhone: "",
    buyerEmail: "",
  });

  const { isSignedIn } = useUser();
  const [selectedDoctor, setSelectedDoctor] = useState<ApiDoctor | null>(preselectedDoctor ?? null);
  const [selectedSlot, setSelectedSlot] = useState<ApiAvailabilitySlot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // booked slot sets: keys are `${slotId}::${date}::${slotTime}`
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [yourSet, setYourSet] = useState<Set<string>>(new Set());

  // ✅ Clean reset helper (used by close + modal unmount)
  // Fetch booked slots for selected doctor — keep all dates so we can check
  // against each slot's resolved next-occurrence date, not just today.
  useEffect(() => {
    if (!selectedDoctor) return;
    fetch(`/api/availability/booked?doctorId=${selectedDoctor.id}`)
      .then((r) => r.json())
      .then((data: { booked?: { slotId: string; date: string; slotTime: string; isYours: boolean }[] }) => {
        const booked = new Set<string>();
        const yours = new Set<string>();
        for (const b of data.booked ?? []) {
          const key = `${b.slotId}::${b.date}::${normalizeSlotTime(b.slotTime)}`;
          booked.add(key);
          if (b.isYours) yours.add(key);
        }
        setBookedSet(booked);
        setYourSet(yours);
      })
      .catch(() => {/* fail silently */});
  }, [selectedDoctor]);

  const closeModal = () => {
    onCloseAction();
  };

  // ✅ Only show slots that belong to this hospital (or global) + active
  const doctorSlots = useMemo(() => {
    if (!selectedDoctor) return [];
    return hospital.availability
      .filter((s) => s.isActive)
      .filter((s) => s.doctorId === selectedDoctor.id)
      .filter((s) => s.hospitalId === hospital.id || s.hospitalId == null)
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [hospital.availability, hospital.id, selectedDoctor]);

  const byDay = useMemo(() => {
    const map = new Map<number, ApiAvailabilitySlot[]>();
    for (const s of doctorSlots) {
      const arr = map.get(s.dayOfWeek) ?? [];
      arr.push(s);
      map.set(s.dayOfWeek, arr);
    }
    // ensure stable sorting inside each day
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.startTime.localeCompare(b.startTime));
      map.set(k, v);
    }
    return map;
  }, [doctorSlots]);

  const sortedTimes = useMemo(() => {
    const allTimes = new Set<string>();
    for (const s of doctorSlots) allTimes.add(s.startTime);
    return Array.from(allTimes).sort();
  }, [doctorSlots]);

  const canGoNext =
    (step === "details" &&
      !!formData.patientName &&
      !!formData.patientAge &&
      !!formData.patientPhone &&
      !!formData.buyerEmail) ||
    (step === "doctor" && !!selectedDoctor) ||
    (step === "availability" && !!selectedSlot);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNextStep = () => {
    if (
      step === "details" &&
      formData.patientName &&
      formData.patientAge &&
      formData.patientPhone &&
      formData.buyerEmail
    ) {
      setStep("doctor");
    } else if (step === "doctor" && selectedDoctor) {
      setStep("availability");
    } else if (step === "availability" && selectedSlot) {
      setStep("review");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor?.id,
          patientName: formData.patientName,
          patientAge: formData.patientAge,
          patientPhone: formData.patientPhone,
          buyerEmail: formData.buyerEmail,
          consultationMode: selectedSlot?.mode,
          slotId: selectedSlot?.id,
          slotTime: `${selectedSlot?.startTime}-${selectedSlot?.endTime}`,
          // Resolve the actual calendar date for the selected slot's day-of-week.
          // Sending T00:00:00.000Z avoids any local-timezone midnight-shift on parse.
          bookingDate: selectedSlot
            ? `${nextOccurrenceDateStr(selectedSlot.dayOfWeek)}T00:00:00.000Z`
            : new Date().toISOString(),
          hospitalId: hospital.id,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Booking failed to initialize.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Book Appointment</h2>
            <p className="text-sm text-slate-500 mt-1">{hospital.name}</p>
          </div>
          <button
            onClick={closeModal}
            className="rounded-full p-2 hover:bg-slate-100 transition-colors"
            aria-label="Close booking modal"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {(["details", "doctor", "availability", "review"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                step === s
                  ? "bg-[#c8a96e]"
                  : (["details", "doctor", "availability", "review"] as Step[]).indexOf(step) > i
                  ? "bg-green-500"
                  : "bg-[#0f1e38]/15"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Patient Details */}
        {step === "details" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Your Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <input
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  placeholder="Your name"
                  className="w-full h-10 rounded-xl border border-[#0f1e38]/15 px-3 text-sm outline-none focus:border-[#c8a96e]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Age</label>
                  <input
                    name="patientAge"
                    type="number"
                    value={formData.patientAge}
                    onChange={handleInputChange}
                    placeholder="30"
                    className="w-full h-10 rounded-xl border border-[#0f1e38]/15 px-3 text-sm outline-none focus:border-[#c8a96e]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input
                    name="patientPhone"
                    value={formData.patientPhone}
                    onChange={handleInputChange}
                    placeholder="98XXXXXXXX"
                    className="w-full h-10 rounded-xl border border-[#0f1e38]/15 px-3 text-sm outline-none focus:border-[#c8a96e]"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  name="buyerEmail"
                  type="email"
                  value={formData.buyerEmail}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="w-full h-10 rounded-xl border border-[#0f1e38]/15 px-3 text-sm outline-none focus:border-[#c8a96e]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Doctor Selection */}
        {step === "doctor" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Choose a Doctor</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {hospital.doctors.map((doctor) => (
                <button
                  key={doctor.id}
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setSelectedSlot(null);
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedDoctor?.id === doctor.id
                      ? "border-[#c8a96e] bg-[#c8a96e]/10"
                      : "border-[#0f1e38]/15 hover:border-[#c8a96e]/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{doctor.fullName}</p>
                      <p className="text-xs text-slate-600">
                        {doctor.specialties[0]?.name ?? "Doctor"} • {(doctor.experienceYears ?? 0)} yrs exp
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 shrink-0">
                      {formatFee(doctor.feeMin, doctor.currency)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Availability Selection */}
        {step === "availability" && selectedDoctor && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Select Time Slot</h3>

            {doctorSlots.length === 0 ? (
              <p className="text-slate-600">No available slots for this doctor.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {/* Day Headers */}
                  <div
                    className="grid gap-1 mb-4"
                    style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}
                  >
                    <div className="px-3 py-2 text-xs font-semibold text-slate-600">Time</div>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const dayHasSlots = (byDay.get(i)?.length ?? 0) > 0;
                      return (
                        <div
                          key={i}
                          className={`px-3 py-2 text-center rounded-t-lg text-xs font-semibold ${
                            dayHasSlots ? "bg-[#c8a96e]/15 text-[#a88b50]" : "bg-[#0f1e38]/5 text-[#0f1e38]/50"
                          }`}
                        >
                          {DAYS[i]}
                        </div>
                      );
                    })}
                  </div>

                  {/* Slots */}
                  {sortedTimes.map((time) => (
                    <div
                      key={time}
                      className="grid gap-1 mb-2"
                      style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}
                    >
                      <div className="px-3 py-2 text-xs font-mono text-slate-600">{time}</div>

                      {Array.from({ length: 7 }).map((_, dayOfWeek) => {
                        const slotsAtTime = (byDay.get(dayOfWeek) ?? []).filter(
                          (s) => s.startTime === time
                        );

                        if (slotsAtTime.length === 0) {
                          return (
                            <div
                              key={`${dayOfWeek}-${time}`}
                              className="px-2 py-2 bg-slate-50 rounded-lg"
                            />
                          );
                        }

                        return (
                          <div key={`${dayOfWeek}-${time}`} className="px-2 py-2 space-y-1">
                            {slotsAtTime.map((slot) => {
                              const resolvedDate = nextOccurrenceDateStr(slot.dayOfWeek);
                              const bookedKey = `${slot.id}::${resolvedDate}::${normalizeSlotTime(`${slot.startTime}-${slot.endTime}`)}`;
                              const isBooked = bookedSet.has(bookedKey);
                              const isYours = yourSet.has(bookedKey);

                              if (isYours) {
                                return (
                                  <div
                                    key={slot.id}
                                    className="w-full text-xs p-1.5 rounded-lg border-2 border-[#c8a96e] bg-[#c8a96e]/10"
                                  >
                                    <div className="font-bold text-[#a88b50]">✓ Booked</div>
                                    <div className="opacity-75">{slot.startTime}–{slot.endTime}</div>
                                  </div>
                                );
                              }

                              if (isBooked) {
                                return (
                                  <div
                                    key={slot.id}
                                    className="w-full text-xs p-1.5 rounded-lg border-2 border-slate-200 bg-slate-100 opacity-50"
                                  >
                                    <div className="font-semibold text-slate-400">Unavailable</div>
                                    <div className="opacity-75 text-slate-400">{slot.startTime}–{slot.endTime}</div>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`w-full text-xs p-1.5 rounded-lg border-2 transition-all ${
                                    selectedSlot?.id === slot.id
                                      ? slot.mode === "ONLINE"
                                        ? "border-[#c8a96e] bg-[#c8a96e]/15"
                                        : "border-emerald-500 bg-emerald-100"
                                      : slot.mode === "ONLINE"
                                      ? "border-[#c8a96e]/30 bg-white hover:bg-[#c8a96e]/10"
                                      : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                  }`}
                                >
                                  <div className="font-semibold">
                                    {slot.startTime}–{slot.endTime}
                                  </div>
                                  <div className="text-xs opacity-75">{slot.mode}</div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review & Pay */}
        {step === "review" && selectedDoctor && selectedSlot && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-[#c8a96e]/10 p-4 border border-[#c8a96e]/20 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#0f1e38]/70">Doctor:</span>
                <span className="font-semibold text-[#0f1e38]">{selectedDoctor.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f1e38]/70">Mode:</span>
                <span className="font-semibold text-[#0f1e38]">{selectedSlot.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f1e38]/70">Date & Time:</span>
                <span className="font-semibold text-[#0f1e38]">
                  {nextOccurrenceDateStr(selectedSlot.dayOfWeek)} ({DAYS[selectedSlot.dayOfWeek]}), {selectedSlot.startTime}–{selectedSlot.endTime}
                </span>
              </div>
              <div className="h-px bg-[#c8a96e]/30 my-2" />
              <div className="flex justify-between">
                <span className="text-[#a88b50] font-medium">Total to pay:</span>
                <span className="text-2xl font-bold text-[#a88b50]">
                  {formatFee(selectedDoctor.feeMin, selectedDoctor.currency)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep("availability")}
                variant="outline"
                className="flex-1 rounded-lg"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10 bg-[#0f1e38] hover:bg-[#1a3059] text-[#c8a96e] rounded-lg"
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Pay Securely"}
              </Button>
            </div>
          </form>
        )}

        {/* Navigation Buttons */}
        {(step === "details" || step === "doctor" || step === "availability") && (
          <div className="flex gap-3 mt-6">
            {step !== "details" && (
              <Button
                onClick={() => {
                  if (step === "doctor") setStep("details");
                  else if (step === "availability") setStep("doctor");
                }}
                variant="outline"
                className="flex-1 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            <Button
              onClick={handleNextStep}
              disabled={!canGoNext}
              className="flex-1 rounded-lg"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
